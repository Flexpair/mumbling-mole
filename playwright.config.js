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
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : 1, // Audio tests require exclusive server access
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:8081',
    
    // Collect trace when retrying the failed test
    trace: 'retain-on-failure',
    
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    
    // Capture video on failure
    video: 'retain-on-failure',
    
    // Browser launch options
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',        // Auto-grant mic permission
        '--use-fake-device-for-media-stream',    // Use fake microphone
        '--autoplay-policy=no-user-gesture-required', // Allow audio without user gesture
        '--disable-web-security',                 // For cross-origin WebSocket
        '--allow-file-access-from-files',        // For local file access
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
        channel: 'chromium' // Use system Chromium if available
      }
    }
  ],
  
  // Run your local dev server before starting the tests
  webServer: {
    command: 'SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh',
    port: 8081,
    timeout: 120000, // 2 minutes to start server
    reuseExistingServer: !process.env.CI, // Reuse server in dev, always start fresh in CI
    stdout: 'pipe',
    stderr: 'pipe',
    // Wait for server to be ready
    env: {
      NODE_ENV: 'test'
    }
  },
  
  // Output folder for test artifacts
  outputDir: 'test-results',
});
