#!/usr/bin/env node
/**
 * esbuild Build Script for mumbling-mole
 * Fast Go-based bundler (~1s build time)
 * Since esbuild is fast, always does clean builds
 */

import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import vuePlugin from 'esbuild-plugin-vue3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build mode from environment
const mode = process.env.BUILD_MODE || process.env.NODE_ENV || 'production';
const isDev = mode === 'development';

console.log(`🔨 Building with esbuild (mode: ${mode})`);

// Always clean dist/ for guaranteed fresh builds (esbuild is fast enough)
if (fs.existsSync('dist')) {
  console.log('🧹 Cleaning dist/');
  fs.rmSync('dist', { recursive: true, force: true });
}

// Create dist directory
fs.mkdirSync('dist', { recursive: true });

// Generate build info with full git commit hash
// Priority: 1. GIT_COMMIT env var (CI/CD), 2. git command (local dev)
let gitHash = 'unknown';
try {
  // Try environment variable first (set by CI/CD or Docker build)
  if (process.env.GIT_COMMIT) {
    gitHash = process.env.GIT_COMMIT;
    console.log(`📦 Build info from GIT_COMMIT env: ${gitHash.substring(0, 7)}`);
  } else {
    // Fallback to git command (local development with .git directory)
    gitHash = execSync('/usr/bin/git rev-parse HEAD', { encoding: 'utf8' }).trim();
    console.log(`📦 Build info from git: ${gitHash.substring(0, 7)}`);
  }
} catch (err) {
  console.warn('⚠️  Could not determine git commit:', err.message);
  console.warn('    Set GIT_COMMIT environment variable or ensure .git directory exists');
}

const buildInfo = {
  commit: gitHash,
  buildTime: new Date().toISOString(),
  mode: mode
};

fs.writeFileSync(
  'app/build-info.json',
  JSON.stringify(buildInfo, null, 2)
);

// Copy static files helper
function copyFile(src, dest) {
  const destPath = path.join('dist', dest);
  const destDir = path.dirname(destPath);
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, destPath);
    console.log(`  📄 Copied: ${src} → ${dest}`);
  }
}

// Copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  
  const destPath = path.join('dist', dest);
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destFile = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destFile);
    } else {
      copyFile(srcPath, destFile);
    }
  }
}

// Build configuration
const buildConfig = {
  entryPoints: {
    // Main application bundles
    'index': 'app/index.js',
    'config': 'app/config.js',
    'theme': 'app/theme.js',
    
    // Web Workers (separate bundles)
    'worker': 'app/worker.js',
    'audio/encode-worker': 'app/audio/encode-worker.js',
    'audio/decode-worker': 'app/audio/decode-worker.js',
    
    // Async components (manual code-splitting for IIFE format)
    // Note: With format:'iife', defineAsyncComponent won't auto-split
    // These bundles can be pre-built but aren't used yet until we switch to ESM
    // Keeping for future ESM migration
  },
  
  bundle: true,
  outdir: 'dist',
  
  // Target modern browsers (ES2020 = Chrome 80+, Firefox 72+, Safari 13.1+)
  // Your code already uses modern features, no need for ES5
  target: 'es2020',
  format: 'iife', // IIFE for regular <script> tags (not modules)
  
  // Source maps
  sourcemap: isDev ? 'inline' : false,
  
  // Minification
  minify: !isDev,
  
  // Keep names for debugging
  keepNames: isDev,
  
  // Plugins
  plugins: [
    // Vue 3 Single File Components (.vue files)
    vuePlugin(),
    
    // Custom alias for Vue runtime-only build (no template compiler needed - all templates pre-compiled in .vue SFCs)
    // Saves ~40KB by excluding runtime template compiler
    {
      name: 'vue-runtime-alias',
      setup(build) {
        build.onResolve({ filter: /^vue$/ }, args => ({
          path: path.resolve(__dirname, 'node_modules/vue/dist/vue.runtime.esm-bundler.js')
        }));
      }
    },
    
    // Custom plugin to alias fs to our mock
    {
      name: 'fs-mock',
      setup(build) {
        build.onResolve({ filter: /^fs$/ }, args => ({
          path: path.resolve(__dirname, 'polyfills/fs-mock.js')
        }));
      }
    },
    // Polyfill Node.js built-ins for browser
    NodeModulesPolyfillPlugin(),
    NodeGlobalsPolyfillPlugin({
      process: true,
      buffer: true,
    }),
    sassPlugin(),
  ],
  
  // Loader configuration
  loader: {
    '.json': 'json',
    '.txt': 'text',
    '.proto': 'text', // Load .proto files as text for fs-mock
    '.png': 'file',
    '.jpg': 'file',
    '.jpeg': 'file',
    '.gif': 'file',
    '.svg': 'file',
    '.woff': 'file',
    '.woff2': 'file',
    '.ttf': 'file',
    '.eot': 'file',
    '.vue': 'js', // Vue SFC compiled by plugin, treated as JS by esbuild
  },
  
  // Define environment variables and Node.js globals
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'global': 'globalThis', // Use globalThis (works in both window and worker contexts)
      '__dirname': JSON.stringify('/'),
      '__filename': JSON.stringify('/index.js'),
      '__VUE_OPTIONS_API__': 'true',
      '__VUE_PROD_DEVTOOLS__': 'false',
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
    }, // Environment variable definitions
  
  // Log level
  logLevel: 'info',
};

try {
  console.log('📦 Building bundles...');
  
  // Main build
  const result = await esbuild.build(buildConfig);
  
  console.log('✅ Bundles created');
  
  // Copy static files
  console.log('📋 Copying static files...');
  
  // HTML template
  copyFile('app/index.html', 'index.html');
  
  // Config files
  if (fs.existsSync('app/config.local.js')) {
    copyFile('app/config.local.js', 'config.local.js');
  } else {
    console.log('  ⚠️  config.local.js not found (will be created on first run)');
  }
  
  // Favicons
  copyDir('app/favicons', 'favicons');
  
  // Theme assets - copy SVG and images
  copyDir('themes/MetroMumbleLight/svg', 'svg');
  copyDir('themes/MetroMumbleLight/img', 'img');
  
  // AudioWorklet processors (MUST NOT be bundled!)
  // These run in AudioWorklet context and cannot use imports
  copyFile('app/audio/recorder-worker.js', 'recorder-worker.js');
  copyFile('app/audio/playback-buffer-processor.js', 'playback-buffer-processor.js');
  
  // Build info (generated at build time, needed at runtime)
  copyFile('app/build-info.json', 'build-info.json');
  
  console.log('✅ Static files copied');
  
  // Validate build output
  const indexHtmlPath = path.join('dist', 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    const size = fs.statSync(indexHtmlPath).size;
    if (size < 1024) {
      throw new Error(`index.html is suspiciously small (${size} bytes) - build may have failed`);
    }
    console.log(`✅ Validation: index.html size: ${size} bytes`);
  } else {
    throw new Error('index.html not found in dist/ - build failed');
  }
  
  // Validate critical build artifacts
  const requiredFiles = ['dist/index.js', 'dist/config.js', 'dist/theme.js'];
  const missing = requiredFiles.filter(f => !fs.existsSync(f) || fs.statSync(f).size === 0);
  if (missing.length > 0) {
    throw new Error(`Missing or empty build artifacts: ${missing.join(', ')}`);
  }
  console.log('✅ Validation: All critical artifacts present');
  
  console.log('');
  console.log('✨ Build complete!');
  console.log(`   Mode: ${mode}`);
  console.log(`   Output: dist/`);
  
  if (result.errors.length > 0) {
    console.error('❌ Build had errors:', result.errors);
    process.exit(1);
  }
  
  if (result.warnings.length > 0) {
    console.warn('⚠️  Build warnings:', result.warnings);
  }
  
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
