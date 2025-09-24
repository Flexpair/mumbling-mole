const http = require('http');
const path = require('path');
const { readFileSync } = require('fs');

let httpServer;
const TEST_PORT = process.env.TEST_PORT || 3000;

/**
 * Global setup for Playwright tests
 * Starts a simple HTTP server serving the dist/ directory
 */
async function globalSetup(config) {
  console.log('[setup] Starting test server...');
  
  await startTestServer();
  await waitForServer();
  
  console.log(`[setup] Test server running at http://localhost:${TEST_PORT}`);
  
  // Store server info for tests 
  process.env.TEST_BASE_URL = `http://localhost:${TEST_PORT}`;
  
  return async () => {
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
      console.log('[setup] Test server stopped');
    }
  };
}

function startTestServer() {
  return new Promise((resolve, reject) => {
    const distPath = path.join(__dirname, '../../dist');
    
    httpServer = http.createServer((req, res) => {
      // Parse URL and remove query parameters for file lookup
      const url = new URL(req.url, `http://localhost:${TEST_PORT}`);
      let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
      const fullPath = path.join(distPath, filePath);
      
      try {
        const content = readFileSync(fullPath);
        
        // Set content type based on extension
        let contentType = 'text/html';
        if (filePath.endsWith('.js')) contentType = 'application/javascript';
        else if (filePath.endsWith('.css')) contentType = 'text/css';
        else if (filePath.endsWith('.json')) contentType = 'application/json';
        else if (filePath.endsWith('.png')) contentType = 'image/png';
        else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
        else if (filePath.endsWith('.ico')) contentType = 'image/x-icon';
        
        res.writeHead(200, { 
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end(content);
      } catch (err) {
        // Fallback to index.html for SPA routing
        if (url.pathname !== '/' && !filePath.includes('.')) {
          try {
            const indexContent = readFileSync(path.join(distPath, 'index.html'));
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent);
            return;
          } catch {}
        }
        
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`File not found: ${filePath}`);
      }
    });
    
    httpServer.listen(TEST_PORT, '127.0.0.1', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timeout = 10000; // 10 seconds
    
    function check() {
      const req = http.get(`http://localhost:${TEST_PORT}`, (res) => {
        resolve();
      });
      
      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Server startup timeout'));
        } else {
          setTimeout(check, 100);
        }
      });
    }
    
    check();
  });
}

module.exports = globalSetup;