/**
 * Vue Mounting Verification Test
 * Checks if Vue.js ConnectDialog mounts successfully
 */

import { test, expect } from '@playwright/test';

test('Vue ConnectDialog should mount successfully', async ({ page }) => {
  const consoleLogs = [];
  
  // Capture console logs
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  // Navigate to app
  await page.goto('http://local.flexpair.app');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Wait a bit for Vue mounting
  await page.waitForTimeout(1000);
  
  // Check for Vue mounting log
  const vueLogs = consoleLogs.filter(log => log.text.includes('[VUE]'));
  console.log('Vue-related logs:', vueLogs);
  
  // Verify mount success log exists
  const mountSuccessLog = vueLogs.find(log => 
    log.text.includes('Vue.js ConnectDialog mounted successfully')
  );
  expect(mountSuccessLog).toBeDefined();
  
  // Check if mount point exists in DOM
  const mountPoint = await page.$('#vue-connect-dialog-root');
  expect(mountPoint).toBeTruthy();
  
  // Check if Vue component rendered content
  const vueContent = await page.$('#vue-connect-dialog-root > *');
  expect(vueContent).toBeTruthy();
  
  // Log all console output for debugging
  console.log('All console logs:', consoleLogs);
});
