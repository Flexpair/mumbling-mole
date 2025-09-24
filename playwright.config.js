/**
 * @type {import('@playwright/test').PlaywrightTestConfig}
 */
module.exports = {
  testDir: './tests',
  // Timeout per test
  timeout: 30000,
  // Expect timeout for assertions
  expect: {
    timeout: 5000
  },
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  // Number of parallel workers
  workers: process.env.CI ? 1 : undefined,
  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  // Global setup
  globalSetup: require.resolve('./tests/setup/global-setup.js'),
  // Use config
  use: {
    // Browser settings
    headless: true,
    // Base URL for tests - will be set by global setup
    baseURL: 'http://localhost:3000',
    // Screenshots
    screenshot: 'only-on-failure',
    // Videos
    video: 'retain-on-failure',
    // Trace
    trace: 'retain-on-failure',
  },
  // Projects for multiple browsers/configurations
  projects: [
    {
      name: 'chromium',
      use: {
        ...require('@playwright/test').devices['Desktop Chrome'],
      },
    },
  ],
  // Global teardown
  globalTeardown: require.resolve('./tests/setup/global-teardown.js'),
};