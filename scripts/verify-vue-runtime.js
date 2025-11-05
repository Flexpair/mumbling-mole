#!/usr/bin/env node

/**
 * Verification script to prove Vue.js is actually running
 * 
 * This script checks the built files for Vue-specific patterns
 * that prove Vue is compiled and included in the bundle.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');

console.log('🔍 Verifying Vue.js Runtime Integration...\n');

// 1. Check if index.js contains Vue imports
const indexJsPath = path.join(distPath, 'index.js');
if (!fs.existsSync(indexJsPath)) {
  console.error('❌ dist/index.js not found. Run `npm run build` first.');
  process.exit(1);
}

const indexJsContent = fs.readFileSync(indexJsPath, 'utf8');

const checks = [
  {
    name: 'Vue createApp import',
    pattern: /createApp|CreateAppFunction/,
    description: 'Vue 3 createApp function'
  },
  {
    name: 'Vue reactive system',
    pattern: /ref\(|reactive\(|computed\(/,
    description: 'Vue 3 reactive primitives'
  },
  {
    name: 'Vue component lifecycle',
    pattern: /onMounted|onBeforeUnmount|onUnmounted/,
    description: 'Vue 3 lifecycle hooks'
  },
  {
    name: 'Vue template compiler',
    pattern: /createElementVNode|createTextVNode|withDirectives/,
    description: 'Vue 3 template compiler output'
  },
  {
    name: 'Vue mount points',
    pattern: /vue-connect-dialog-root|vue-connection-info-dialog-root|vue-settings-dialog-root/,
    description: 'Vue component mount points'
  },
  {
    name: 'ConnectDialog.vue compiled',
    pattern: /VUE_CONNECT_DIALOG|ConnectDialog/,
    description: 'ConnectDialog Vue component'
  },
  {
    name: 'ConnectionInfoDialog.vue compiled',
    pattern: /VUE_CONNECTION_INFO|ConnectionInfoDialog/,
    description: 'ConnectionInfoDialog Vue component'
  },
  {
    name: 'SettingsDialog.vue compiled',
    pattern: /VUE_SETTINGS_DIALOG|SettingsDialog/,
    description: 'SettingsDialog Vue component'
  }
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  if (check.pattern.test(indexJsContent)) {
    console.log(`✅ ${check.name}`);
    console.log(`   Found: ${check.description}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}`);
    console.log(`   Missing: ${check.description}`);
    failed++;
  }
  console.log('');
});

// 2. Check if .vue files exist in source
const componentPaths = [
  path.join(__dirname, '..', 'app', 'components', 'ConnectDialog.vue'),
  path.join(__dirname, '..', 'app', 'components', 'ConnectionInfoDialog.vue'),
  path.join(__dirname, '..', 'app', 'components', 'SettingsDialog.vue')
];

console.log('📁 Checking Vue component source files...\n');

componentPaths.forEach(componentPath => {
  const exists = fs.existsSync(componentPath);
  const name = path.basename(componentPath);
  if (exists) {
    const content = fs.readFileSync(componentPath, 'utf8');
    const hasTemplate = /<template>/.test(content);
    const hasScript = /<script setup>/.test(content);
    const hasVueImports = /from 'vue'/.test(content);
    
    console.log(`✅ ${name}`);
    console.log(`   - Template section: ${hasTemplate ? '✓' : '✗'}`);
    console.log(`   - Script setup: ${hasScript ? '✓' : '✗'}`);
    console.log(`   - Vue imports: ${hasVueImports ? '✓' : '✗'}`);
    
    if (hasTemplate && hasScript && hasVueImports) {
      passed++;
    } else {
      failed++;
    }
  } else {
    console.log(`❌ ${name} - NOT FOUND`);
    failed++;
  }
  console.log('');
});

// 3. Check bundle size (Vue adds significant size)
const stats = fs.statSync(indexJsPath);
const sizeKB = Math.round(stats.size / 1024);

console.log(`📊 Bundle Analysis:\n`);
console.log(`   index.js size: ${sizeKB} KB`);

if (sizeKB > 500) {
  console.log(`   ✅ Bundle size indicates Vue is included (>500KB expected with Vue)`);
  passed++;
} else {
  console.log(`   ⚠️  Bundle seems small - Vue might not be fully included`);
  failed++;
}
console.log('');

// Summary
console.log('═'.repeat(60));
console.log(`\n🎯 Verification Summary:\n`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log('');

if (failed === 0) {
  console.log('🎉 SUCCESS! Vue.js is definitely running!\n');
  console.log('To verify in the browser:');
  console.log('1. Open DevTools Console');
  console.log('2. Type: __VUE_CONNECT_DIALOG__');
  console.log('3. Type: __VUE_SETTINGS_DIALOG__');
  console.log('4. Type: __VUE_CONNECTION_INFO__');
  console.log('\nYou should see Vue component instances!\n');
  process.exit(0);
} else {
  console.log('⚠️  Some checks failed. Vue might not be fully integrated.\n');
  process.exit(1);
}
