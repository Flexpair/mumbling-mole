/**
 * Global teardown for Playwright tests
 * Stops the test server
 */
async function globalTeardown() {
  console.log('[teardown] Stopping test server...');
  
  // The server process is managed by the setup, 
  // we'll handle cleanup via process exit
}

module.exports = globalTeardown;