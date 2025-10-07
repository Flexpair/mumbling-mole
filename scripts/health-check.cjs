#!/usr/bin/env node
/**
 * Health Check Script for Docker Compose Services
 * 
 * Validates that all services are healthy and ready for integration testing.
 * Supports both local docker-compose and CI environments.
 * 
 * Usage:
 *   node scripts/health-check.cjs
 *   node scripts/health-check.cjs --timeout=120
 *   COMPOSE_FILE=.devcontainer/docker-compose.ci.yml node scripts/health-check.cjs
 * 
 * Exit codes:
 *   0 - All services healthy
 *   1 - One or more services unhealthy or timeout
 *   2 - Docker/compose not available
 */

const { execSync, spawn } = require('child_process');
const http = require('http');
const https = require('https');
const net = require('net');

// Configuration
const TIMEOUT_SECONDS = parseInt(process.env.HEALTH_CHECK_TIMEOUT || '120', 10);
const CHECK_INTERVAL_MS = 2000;
const COMPOSE_FILE = process.env.COMPOSE_FILE || '.devcontainer/docker-compose.ci.yml';

// Service health checks configuration
const HEALTH_CHECKS = [
  {
    name: 'murmur',
    type: 'tcp',
    host: '127.0.0.1',
    port: 64738,
    description: 'Mumble Server (TCP)'
  },
  {
    name: 'mumble',
    type: 'http',
    url: 'http://127.0.0.1:8081/',
    description: 'Mumble Web Client',
    expectStatus: 200
  },
  {
    name: 'guacamole',
    type: 'http',
    url: 'http://127.0.0.1:8080/guacamole/',
    description: 'Guacamole Web',
    expectStatus: 200
  },
  {
    name: 'nginx',
    type: 'http',
    url: 'http://127.0.0.1:8000/',
    description: 'Nginx HTTP',
    expectStatus: [200, 301]
  },
  {
    name: 'nginx-ssl',
    type: 'https',
    url: 'https://127.0.0.1:8443/',
    description: 'Nginx HTTPS',
    expectStatus: 200,
    rejectUnauthorized: false
  }
];

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStatus(emoji, service, status, details = '') {
  const serviceStr = service.padEnd(20);
  const detailsStr = details ? ` - ${details}` : '';
  console.log(`${emoji} ${serviceStr} ${status}${detailsStr}`);
}

// Check if docker and docker-compose are available
function checkDockerAvailable() {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    execSync('docker compose version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    log('❌ Docker or docker-compose not available', colors.red);
    log('   Make sure Docker is installed and running', colors.yellow);
    return false;
  }
}

// Get container status from docker compose
function getComposeStatus() {
  try {
    const output = execSync(
      `docker compose -f ${COMPOSE_FILE} ps --format json`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    // Parse JSON output (one JSON object per line)
    const containers = output
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    return containers;
  } catch (error) {
    log(`⚠️  Could not get compose status: ${error.message}`, colors.yellow);
    return [];
  }
}

// TCP port check
function checkTcpPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve({ success: true });
    });
    
    socket.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, error: 'Connection timeout' });
    });
    
    socket.connect(port, host);
  });
}

// HTTP/HTTPS check
function checkHttp(url, options = {}) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      method: 'GET',
      timeout: 3000,
      rejectUnauthorized: options.rejectUnauthorized !== false
    };
    
    const req = client.get(url, requestOptions, (res) => {
      res.resume(); // Consume response data
      
      const expectStatus = Array.isArray(options.expectStatus) 
        ? options.expectStatus 
        : [options.expectStatus || 200];
      
      const success = expectStatus.includes(res.statusCode);
      resolve({
        success,
        status: res.statusCode,
        error: success ? null : `Expected ${expectStatus.join(' or ')}, got ${res.statusCode}`
      });
    });
    
    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });
  });
}

// Perform single health check
async function performHealthCheck(check) {
  switch (check.type) {
    case 'tcp':
      return await checkTcpPort(check.host, check.port);
    
    case 'http':
      return await checkHttp(check.url, {
        expectStatus: check.expectStatus
      });
    
    case 'https':
      return await checkHttp(check.url, {
        expectStatus: check.expectStatus,
        rejectUnauthorized: check.rejectUnauthorized
      });
    
    default:
      return { success: false, error: `Unknown check type: ${check.type}` };
  }
}

// Main health check loop
async function waitForHealthy() {
  const startTime = Date.now();
  const endTime = startTime + (TIMEOUT_SECONDS * 1000);
  
  log(`\n${'='.repeat(70)}`, colors.cyan);
  log('🏥 Service Health Check', colors.bright);
  log(`${'='.repeat(70)}`, colors.cyan);
  log(`Compose file: ${COMPOSE_FILE}`, colors.blue);
  log(`Timeout: ${TIMEOUT_SECONDS}s\n`, colors.blue);
  
  // Show container status
  const containers = getComposeStatus();
  if (containers.length > 0) {
    log('📦 Container Status:', colors.bright);
    containers.forEach(container => {
      const status = container.State === 'running' ? '✅' : '❌';
      const health = container.Health || 'no healthcheck';
      logStatus(status, container.Service, container.State, health);
    });
    log('');
  }
  
  const results = new Map();
  let allHealthy = false;
  
  while (Date.now() < endTime && !allHealthy) {
    const checks = await Promise.all(
      HEALTH_CHECKS.map(async (check) => {
        const result = await performHealthCheck(check);
        return { check, result };
      })
    );
    
    // Update results
    checks.forEach(({ check, result }) => {
      results.set(check.name, { check, result });
    });
    
    // Check if all are healthy
    allHealthy = Array.from(results.values()).every(({ result }) => result.success);
    
    if (!allHealthy) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      process.stdout.write(`\r⏳ Waiting for services... ${elapsed}/${TIMEOUT_SECONDS}s `);
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
    }
  }
  
  process.stdout.write('\r' + ' '.repeat(70) + '\r');
  
  // Display final results
  log('📊 Health Check Results:', colors.bright);
  log('');
  
  let hasFailures = false;
  results.forEach(({ check, result }) => {
    if (result.success) {
      logStatus('✅', check.description, 'HEALTHY', colors.green);
    } else {
      hasFailures = true;
      const error = result.error || 'Unknown error';
      logStatus('❌', check.description, 'UNHEALTHY', `${colors.red}${error}`);
    }
  });
  
  log('');
  log(`${'='.repeat(70)}`, colors.cyan);
  
  if (hasFailures) {
    log('❌ Health check FAILED - some services are unhealthy', colors.red);
    
    // Show container logs for debugging
    log('\n📋 Recent logs from unhealthy services:', colors.yellow);
    results.forEach(({ check, result }) => {
      if (!result.success) {
        try {
          const containerName = getContainerNameForService(check.name);
          if (containerName) {
            log(`\n--- ${check.name} logs (last 20 lines) ---`, colors.yellow);
            const logs = execSync(
              `docker logs --tail 20 ${containerName} 2>&1`,
              { encoding: 'utf8', stdio: 'pipe' }
            );
            console.log(logs);
          }
        } catch (err) {
          // Ignore errors getting logs
        }
      }
    });
    
    return false;
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`✅ All services HEALTHY (${duration}s)`, colors.green);
  log(`${'='.repeat(70)}`, colors.cyan);
  
  return true;
}

// Helper to get container name from service name
function getContainerNameForService(serviceName) {
  const mapping = {
    'murmur': 'murmur_ci',
    'mumble': 'mumble_web_ci',
    'guacamole': 'guacamole_ci',
    'nginx': 'nginx_ci',
    'nginx-ssl': 'nginx_ci'
  };
  return mapping[serviceName] || null;
}

// Main execution
async function main() {
  // Check Docker availability
  if (!checkDockerAvailable()) {
    process.exit(2);
  }
  
  // Wait for services to be healthy
  const healthy = await waitForHealthy();
  
  process.exit(healthy ? 0 : 1);
}

// Handle signals
process.on('SIGINT', () => {
  log('\n\n⚠️  Health check interrupted', colors.yellow);
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('\n\n⚠️  Health check terminated', colors.yellow);
  process.exit(143);
});

// Run
main().catch(err => {
  log(`\n❌ Unexpected error: ${err.message}`, colors.red);
  console.error(err);
  process.exit(1);
});
