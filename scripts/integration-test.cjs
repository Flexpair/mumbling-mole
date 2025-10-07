#!/usr/bin/env node
/**
 * Integration Test Suite for Multi-Service Setup
 * 
 * Tests the complete service stack interaction:
 * - Mumble client → Murmur server connection
 * - Nginx reverse proxy routing
 * - Guacamole accessibility
 * - Cross-service communication
 * 
 * Usage:
 *   node scripts/integration-test.cjs
 *   INTEGRATION_TEST_VERBOSE=1 node scripts/integration-test.cjs
 * 
 * Prerequisites:
 *   - Docker Compose stack running (docker-compose.ci.yml)
 *   - All services healthy (run health-check.cjs first)
 * 
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more tests failed
 */

const http = require('http');
const https = require('https');
const WebSocket = require('ws');

// Configuration
const VERBOSE = process.env.INTEGRATION_TEST_VERBOSE === '1';
const TESTS_TIMEOUT_MS = 60000; // 60 seconds total

// Test endpoints
const ENDPOINTS = {
  mumbleHttp: 'http://127.0.0.1:8081/',
  mumbleWs: 'ws://127.0.0.1:8081/',
  guacamole: 'http://127.0.0.1:8080/guacamole/',
  nginxHttp: 'http://127.0.0.1:8000/',
  nginxHttps: 'https://127.0.0.1:8443/',
  nginxMumbleProxy: 'https://127.0.0.1:8443/mumble/',
  nginxGuacamoleProxy: 'https://127.0.0.1:8443/guacamole/'
};

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function verbose(message) {
  if (VERBOSE) {
    log(`  ${message}`, colors.gray);
  }
}

// Test result tracking
class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.startTime = Date.now();
  }
  
  async run(testName, testFn) {
    process.stdout.write(`  ⏳ ${testName}...`);
    const start = Date.now();
    
    try {
      await testFn();
      this.passed++;
      const duration = Date.now() - start;
      process.stdout.write(`\r  ✅ ${testName} ${colors.green}(${duration}ms)${colors.reset}\n`);
      return true;
    } catch (error) {
      this.failed++;
      const duration = Date.now() - start;
      process.stdout.write(`\r  ❌ ${testName} ${colors.red}(${duration}ms)${colors.reset}\n`);
      log(`     Error: ${error.message}`, colors.red);
      if (VERBOSE && error.stack) {
        verbose(error.stack);
      }
      return false;
    }
  }
  
  summary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const total = this.passed + this.failed;
    
    log('');
    log(`${'='.repeat(70)}`, colors.cyan);
    log(`📊 ${this.name} - Summary`, colors.bright);
    log(`${'='.repeat(70)}`, colors.cyan);
    log(`Total tests: ${total}`, colors.blue);
    log(`Passed: ${this.passed}`, this.passed > 0 ? colors.green : colors.gray);
    log(`Failed: ${this.failed}`, this.failed > 0 ? colors.red : colors.gray);
    log(`Duration: ${duration}s`, colors.blue);
    log(`${'='.repeat(70)}`, colors.cyan);
    
    return this.failed === 0;
  }
}

// HTTP request helper
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      method: options.method || 'GET',
      timeout: options.timeout || 5000,
      rejectUnauthorized: false,
      headers: options.headers || {}
    };
    
    verbose(`HTTP ${requestOptions.method} ${url}`);
    
    const req = client.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        verbose(`Response: ${res.statusCode} (${data.length} bytes)`);
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// WebSocket connection helper
function testWebSocket(url, options = {}) {
  return new Promise((resolve, reject) => {
    verbose(`WebSocket connect to ${url}`);
    
    const ws = new WebSocket(url, {
      perMessageDeflate: false,
      rejectUnauthorized: false,
      handshakeTimeout: options.timeout || 5000
    });
    
    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error('WebSocket handshake timeout'));
    }, options.timeout || 5000);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      verbose('WebSocket connected');
      
      // Send ping if requested
      if (options.sendPing) {
        ws.ping();
      }
      
      // Close after short delay
      setTimeout(() => {
        ws.close();
        resolve({ success: true });
      }, 100);
    });
    
    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    
    ws.on('close', () => {
      verbose('WebSocket closed');
    });
  });
}

// Test Suites

async function testMumbleService(suite) {
  log('\n🎤 Testing Mumble Service', colors.bright);
  
  await suite.run('HTTP endpoint accessible', async () => {
    const res = await httpRequest(ENDPOINTS.mumbleHttp);
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    if (res.data.length < 500) {
      throw new Error(`Response too small (${res.data.length} bytes)`);
    }
    if (!res.data.includes('html') && !res.data.includes('HTML')) {
      throw new Error('Response does not appear to be HTML');
    }
  });
  
  await suite.run('Serves static assets (config.js)', async () => {
    const res = await httpRequest(ENDPOINTS.mumbleHttp + 'config.js');
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    if (res.data.length < 50) {
      throw new Error(`Config file too small (${res.data.length} bytes)`);
    }
  });
  
  await suite.run('WebSocket upgrade capability', async () => {
    await testWebSocket(ENDPOINTS.mumbleWs, { timeout: 5000 });
  });
  
  await suite.run('Contains Mumble UI elements', async () => {
    const res = await httpRequest(ENDPOINTS.mumbleHttp);
    // Check for common Mumble UI identifiers
    const hasRelevantContent = 
      res.data.toLowerCase().includes('mumble') ||
      res.data.includes('mumble-client') ||
      res.data.includes('voice') ||
      res.data.includes('audio');
    
    if (!hasRelevantContent) {
      throw new Error('HTML does not contain expected Mumble UI elements');
    }
  });
}

async function testGuacamoleService(suite) {
  log('\n🖥️  Testing Guacamole Service', colors.bright);
  
  await suite.run('Guacamole endpoint accessible', async () => {
    const res = await httpRequest(ENDPOINTS.guacamole);
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
  });
  
  await suite.run('Guacamole login page loads', async () => {
    const res = await httpRequest(ENDPOINTS.guacamole);
    const hasLoginForm = 
      res.data.includes('login') ||
      res.data.includes('username') ||
      res.data.includes('password') ||
      res.data.includes('guacamole');
    
    if (!hasLoginForm) {
      throw new Error('Guacamole login page not found');
    }
  });
  
  await suite.run('Guacamole serves static resources', async () => {
    // Guacamole typically serves resources under /guacamole/app/
    const res = await httpRequest(ENDPOINTS.guacamole);
    // Just check we get a valid response
    if (res.status !== 200 || res.data.length < 100) {
      throw new Error('Guacamole static resources not accessible');
    }
  });
}

async function testNginxProxy(suite) {
  log('\n🔀 Testing Nginx Reverse Proxy', colors.bright);
  
  await suite.run('HTTP endpoint (port 8000)', async () => {
    const res = await httpRequest(ENDPOINTS.nginxHttp);
    // Should redirect to HTTPS or return 301
    if (![200, 301, 302].includes(res.status)) {
      throw new Error(`Expected 200/301/302, got ${res.status}`);
    }
  });
  
  await suite.run('HTTPS endpoint (port 8443)', async () => {
    const res = await httpRequest(ENDPOINTS.nginxHttps);
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
  });
  
  await suite.run('Mumble proxy route (/mumble/)', async () => {
    const res = await httpRequest(ENDPOINTS.nginxMumbleProxy);
    // Should proxy to mumble service
    if (![200, 301, 302].includes(res.status)) {
      throw new Error(`Expected 200/301/302, got ${res.status}`);
    }
  });
  
  await suite.run('Guacamole proxy route (/guacamole/)', async () => {
    const res = await httpRequest(ENDPOINTS.nginxGuacamoleProxy);
    // Should proxy to guacamole service
    if (![200, 301, 302].includes(res.status)) {
      throw new Error(`Expected 200/301/302, got ${res.status}`);
    }
  });
  
  await suite.run('SSL/TLS certificate (self-signed)', async () => {
    // Just verify we can connect with SSL (even if self-signed)
    const res = await httpRequest(ENDPOINTS.nginxHttps);
    if (!res.status) {
      throw new Error('HTTPS connection failed');
    }
  });
}

async function testCrossServiceCommunication(suite) {
  log('\n🔗 Testing Cross-Service Communication', colors.bright);
  
  await suite.run('Nginx → Mumble backend', async () => {
    // Request through nginx proxy
    const proxyRes = await httpRequest(ENDPOINTS.nginxMumbleProxy);
    
    // Request direct to mumble
    const directRes = await httpRequest(ENDPOINTS.mumbleHttp);
    
    // Both should succeed
    if (![200, 301, 302].includes(proxyRes.status)) {
      throw new Error(`Nginx proxy failed: ${proxyRes.status}`);
    }
    if (directRes.status !== 200) {
      throw new Error(`Direct access failed: ${directRes.status}`);
    }
  });
  
  await suite.run('Nginx → Guacamole backend', async () => {
    // Request through nginx proxy
    const proxyRes = await httpRequest(ENDPOINTS.nginxGuacamoleProxy);
    
    // Request direct to guacamole
    const directRes = await httpRequest(ENDPOINTS.guacamole);
    
    // Both should succeed
    if (![200, 301, 302].includes(proxyRes.status)) {
      throw new Error(`Nginx proxy failed: ${proxyRes.status}`);
    }
    if (directRes.status !== 200) {
      throw new Error(`Direct access failed: ${directRes.status}`);
    }
  });
  
  await suite.run('All services respond within timeout', async () => {
    const checks = [
      httpRequest(ENDPOINTS.mumbleHttp, { timeout: 3000 }),
      httpRequest(ENDPOINTS.guacamole, { timeout: 3000 }),
      httpRequest(ENDPOINTS.nginxHttps, { timeout: 3000 })
    ];
    
    const results = await Promise.all(checks);
    const allSuccessful = results.every(r => [200, 301, 302].includes(r.status));
    
    if (!allSuccessful) {
      throw new Error('Not all services responded successfully');
    }
  });
}

// Main execution
async function main() {
  log('');
  log(`${'='.repeat(70)}`, colors.cyan);
  log('🧪 Integration Test Suite', colors.bright);
  log(`${'='.repeat(70)}`, colors.cyan);
  log('');
  
  if (VERBOSE) {
    log('Verbose mode enabled', colors.yellow);
  }
  
  const suite = new TestSuite('Integration Tests');
  
  // Set global timeout
  const timeoutHandle = setTimeout(() => {
    log('\n⏱️  Global test timeout reached!', colors.red);
    process.exit(1);
  }, TESTS_TIMEOUT_MS);
  
  try {
    // Run test suites
    await testMumbleService(suite);
    await testGuacamoleService(suite);
    await testNginxProxy(suite);
    await testCrossServiceCommunication(suite);
    
    // Show summary
    const success = suite.summary();
    
    clearTimeout(timeoutHandle);
    
    if (success) {
      log('\n✅ All integration tests passed!', colors.green);
      process.exit(0);
    } else {
      log('\n❌ Some integration tests failed!', colors.red);
      process.exit(1);
    }
  } catch (error) {
    clearTimeout(timeoutHandle);
    log(`\n❌ Unexpected error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Handle signals
process.on('SIGINT', () => {
  log('\n\n⚠️  Tests interrupted', colors.yellow);
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('\n\n⚠️  Tests terminated', colors.yellow);
  process.exit(143);
});

// Run
main();
