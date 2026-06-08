/**
 * Playwright Configuration for Loopback Audio Tests
 * 
 * This config enables browser automation for testing the audio loopback feature,
 * including frequency analysis validation.
 * 
 * Key Features:
 * - Auto-grants microphone permissions
 * - Uses fake audio devices (no real mic required)
 * - Starts test server automatically
 * - Captures screenshots/videos on failure
 * 
 * Usage:
 *   npm run test:loopback          # Run all loopback tests
 *   npm run test:loopback:headed   # Run with visible browser
 *   npm run test:loopback:debug    # Run with debugger
 */

import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Load test credentials from .env.test
config({ path: '.env.test' });

// Prefer the local reverse-proxy URL that the dev container exposes.
// This avoids the GitHub Codespaces forwarding page, which can redirect to
// GitHub authentication instead of the app itself.
const getBaseURL = () => {
  if (process.env.PLAYWRIGHT_BASE_URL) {
    return process.env.PLAYWRIGHT_BASE_URL;
  }

  // Default: Use the nginx reverse proxy for the full TLS path.
  // Override with PLAYWRIGHT_BASE_URL when you intentionally want a
  // different target (for example, a forwarded Codespaces URL).
  return 'https://local.flexpair.app';
};

export default defineConfig({
  testDir: './tests/playwright',
  
  // Test timeout (audio tests can take longer)
  timeout: 60000, // 60 seconds
  
  // Expect timeout for assertions
  expect: {
    timeout: 10000 // 10 seconds
  },
  
  // Run tests in files in parallel
  fullyParallel: false, // Audio tests should run sequentially to avoid conflicts
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests (audio tests require exclusive server access)
  workers: 1,
  
  // Reporter to use
  reporter: [
    ['html'], // Uses default: playwright-report/
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
    // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: getBaseURL(),
    
    // Ignore HTTPS certificate errors (self-signed certs in dev)
    ignoreHTTPSErrors: true,
    
    // Collect trace when retrying the failed test
    trace: 'retain-on-failure',
    
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    
    // Capture video for all tests by default so loopback runs
    // always have a recording available without extra env config.
    // (Can still be overridden via PLAYWRIGHT_VIDEO if needed.)
    // Valid values: 'off', 'on', 'retain-on-failure', 'on-first-retry'
    video: process.env.PLAYWRIGHT_VIDEO || 'on',
    
    // Browser launch options
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',        // Auto-grant mic permission
        '--use-fake-device-for-media-stream',    // Use fake microphone
        '--autoplay-policy=no-user-gesture-required', // Allow audio without user gesture
        '--disable-web-security',                 // For cross-origin WebSocket
        '--allow-file-access-from-files',        // For local file access
        '--host-resolver-rules=MAP local.flexpair.app 172.18.0.7', // DNS override for nginx
      ]
    },
    
    // Browser context options
    permissions: ['microphone'], // Grant microphone access
    
    // Viewport size
    viewport: { width: 1280, height: 720 },
    
    // Default navigation timeout
    navigationTimeout: 30000, // 30 seconds
    
    // Action timeout
    actionTimeout: 10000 // 10 seconds
  },
  
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium', // Use system Chromium if available
        // Default to headless for CI/container environments. Use `--headed` explicitly
        // when you really want a visible browser on a machine with an X server.
        headless: process.env.PLAYWRIGHT_HEADLESS !== 'false'
      }
    }
  ],
  
  // Run your local dev server before starting the tests
  // In docker-compose setup, server is already running, so disable this
  // webServer: {
  //   command: 'SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh',
  //   port: 8081,
  //   timeout: 120000,
  //   reuseExistingServer: !process.env.CI,
  //   stdout: 'pipe',
  //   stderr: 'pipe',
  //   env: {
  //     NODE_ENV: 'test'
  //   }
  // },
  
  // Output folder for test artifacts
  outputDir: 'test-results',
});
