#!/usr/bin/env node
/**
 * esbuild Build Script for mumbling-mole
 * Replaces webpack + babel with fast Go-based bundler
 */

import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build mode from environment
const mode = process.env.WEBPACK_MODE || process.env.NODE_ENV || 'production';
const isDev = mode === 'development';

console.log(`🔨 Building with esbuild (mode: ${mode})`);

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

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
  },
  
  // Define environment variables and Node.js globals
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'global': 'globalThis', // Use globalThis (works in both window and worker contexts)
      '__dirname': JSON.stringify('/'),
      '__filename': JSON.stringify('/index.js'),
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
  
  // Create build marker for smart-build.sh
  fs.writeFileSync('dist/.build-marker', new Date().toISOString());
  
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
