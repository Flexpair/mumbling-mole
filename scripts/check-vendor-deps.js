#!/usr/bin/env node

/**
 * Script to identify unused dependencies in vendored packages
 * 
 * This script analyzes each vendored package to find dependencies that are:
 * 1. Listed in package.json but not actually imported/required in source code
 * 2. Potentially suspicious or outdated
 * 
 * Usage: node scripts/check-vendor-deps.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VENDORS_DIR = path.join(__dirname, '..', 'vendors');
const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

class VendorDependencyAnalyzer {
  constructor() {
    this.results = {};
  }

  log(message, color = COLORS.RESET) {
    console.log(`${color}${message}${COLORS.RESET}`);
  }

  /**
   * Get all source files from a directory recursively
   */
  getSourceFiles(dir, extensions = ['.js', '.jsx', '.ts', '.tsx']) {
    const files = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }

    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && item !== 'node_modules' && item !== '.git') {
        files.push(...this.getSourceFiles(fullPath, extensions));
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Extract all imports and requires from a file
   */
  extractImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = new Set();

    // Match ES6 imports: import ... from 'module'
    const es6ImportRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = es6ImportRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    // Match CommonJS requires: require('module')
    const cjsRequireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    while ((match = cjsRequireRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    // Match dynamic imports: import('module')
    const dynamicImportRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    // Also check for indirect usage patterns that might indicate dependency usage
    // Look for package names mentioned in strings or comments that might indicate usage
    const dependencyHints = this.extractDependencyHints(content);
    for (const hint of dependencyHints) {
      imports.add(hint);
    }

    return imports;
  }

  /**
   * Extract potential dependency hints from comments, strings, and other patterns
   */
  extractDependencyHints(content) {
    const hints = new Set();

    // Look for package names in JSDoc comments or regular comments
    const commentRegex = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;
    const comments = content.match(commentRegex) || [];
    
    for (const comment of comments) {
      // Look for npm package patterns in comments
      const pkgMentions = comment.match(/['"`]([a-z0-9-_@\/]+)['"`]/g) || [];
      for (const mention of pkgMentions) {
        const pkg = mention.replace(/['"`]/g, '');
        if (this.looksLikePackageName(pkg)) {
          hints.add(pkg);
        }
      }
    }

    return hints;
  }

  /**
   * Check if a string looks like an npm package name
   */
  looksLikePackageName(str) {
    // Basic heuristics for npm package names
    return /^[a-z0-9-_@\/]+$/.test(str) && 
           str.length > 2 && 
           !str.startsWith('./') && 
           !str.startsWith('../');
  }

  /**
   * Normalize module name to get the package name
   * e.g., 'lodash/get' -> 'lodash', '@babel/core/lib/index' -> '@babel/core'
   */
  getPackageName(moduleName) {
    // Skip relative imports
    if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
      return null;
    }

    // Skip Node.js built-in modules
    const builtins = [
      'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants', 
      'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https', 
      'module', 'net', 'os', 'path', 'process', 'querystring', 'readline', 
      'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'tty', 
      'url', 'util', 'vm', 'zlib'
    ];
    
    if (builtins.includes(moduleName)) {
      return null;
    }

    // Handle scoped packages like @babel/core
    if (moduleName.startsWith('@')) {
      const parts = moduleName.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : moduleName;
    }

    // Handle regular packages
    return moduleName.split('/')[0];
  }

  /**
   * Analyze a single vendored package
   */
  async analyzeVendorPackage(vendorPath) {
    const packageName = path.basename(vendorPath);
    this.log(`\n${COLORS.BOLD}${COLORS.BLUE}Analyzing: ${packageName}${COLORS.RESET}`);

    const result = {
      packageName,
      path: vendorPath,
      hasPackageJson: false,
      dependencies: {},
      devDependencies: {},
      usedDependencies: new Set(),
      unusedDependencies: new Set(),
      suspiciousDependencies: new Set(),
      errors: []
    };

    // Read package.json
    const packageJsonPath = path.join(vendorPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      result.errors.push('No package.json found');
      return result;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      result.hasPackageJson = true;
      result.dependencies = packageJson.dependencies || {};
      result.devDependencies = packageJson.devDependencies || {};
    } catch (error) {
      result.errors.push(`Failed to parse package.json: ${error.message}`);
      return result;
    }

    // Get all source files
    const srcDir = path.join(vendorPath, 'src');
    const sourceFiles = this.getSourceFiles(srcDir);
    
    if (sourceFiles.length === 0) {
      this.log(`${COLORS.YELLOW}  No source files found in src/ directory${COLORS.RESET}`);
      // Fallback to root directory for source files
      const rootFiles = this.getSourceFiles(vendorPath).filter(f => 
        !f.includes('node_modules') && 
        !f.includes('.git') && 
        !f.includes('test') && 
        !f.includes('spec')
      );
      sourceFiles.push(...rootFiles);
    }

    this.log(`  Found ${sourceFiles.length} source files`);

    // Extract all used dependencies
    for (const file of sourceFiles) {
      try {
        const imports = this.extractImports(file);
        for (const imp of imports) {
          const packageName = this.getPackageName(imp);
          if (packageName) {
            result.usedDependencies.add(packageName);
          }
        }
      } catch (error) {
        result.errors.push(`Failed to analyze ${file}: ${error.message}`);
      }
    }

    // Find unused dependencies (separate production from dev dependencies)
    const unusedProdDeps = new Set();
    const unusedDevDeps = new Set();
    
    for (const depName of Object.keys(result.dependencies)) {
      if (!result.usedDependencies.has(depName)) {
        // Check if it might be used indirectly
        if (await this.checkIndirectUsage(vendorPath, depName)) {
          this.log(`  📎 ${depName} appears to be used indirectly`);
        } else {
          unusedProdDeps.add(depName);
        }
      }
    }

    for (const depName of Object.keys(result.devDependencies)) {
      if (!result.usedDependencies.has(depName) && !this.isKnownBuildDependency(depName)) {
        unusedDevDeps.add(depName);
      }
    }

    result.unusedProdDependencies = unusedProdDeps;
    result.unusedDevDependencies = unusedDevDeps;
    
    // Legacy field for backward compatibility
    result.unusedDependencies = new Set([...unusedProdDeps, ...unusedDevDeps]);

    // Identify suspicious dependencies (old versions, deprecated, etc.)
    const allDependencies = { ...result.dependencies, ...result.devDependencies };
    for (const [depName, version] of Object.entries(allDependencies)) {
      if (this.isSuspicious(depName, version)) {
        result.suspiciousDependencies.add(`${depName}@${version}`);
      }
    }

    return result;
  }

  /**
   * Check if a dependency is known to be used indirectly (e.g., peer dependencies, runtime dependencies)
   */
  async checkIndirectUsage(vendorPath, depName) {
    // Check if it's listed in package.json but used indirectly
    const knownIndirectDeps = [
      'ws', // Often used by websocket libraries
      'websocket-stream', // Runtime dependency of network libraries
    ];

    if (knownIndirectDeps.includes(depName)) {
      return true;
    }

    // Check if it appears in any build configs or scripts
    const configFiles = ['webpack.config.js', '.babelrc', 'package.json'];
    for (const configFile of configFiles) {
      const configPath = path.join(vendorPath, configFile);
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        if (content.includes(depName)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a dependency is a known build/tooling dependency that might not show up in source imports
   */
  isKnownBuildDependency(depName) {
    const buildDependencies = [
      // Testing frameworks
      'mocha', 'chai', 'jest', 'jasmine', 'tap',
      // Linting and code quality
      'eslint', 'standard', 'mocha-standard', 'prettier',
      // Build tools
      '@babel/cli', '@babel/core', '@babel/preset-env', '@babel/register',
      'webpack', 'rollup', 'browserify',
      // Utilities
      'rimraf', 'mkdirp', 'cross-env', 'npm-run-all',
    ];

    return buildDependencies.some(buildDep => 
      depName === buildDep || depName.startsWith(buildDep + '@')
    );
  }
  isSuspicious(name, version) {
    // Check for very old versions or deprecated packages
    const suspiciousPatterns = [
      /^0\.[0-5]\./, // Very old versions (0.0.x - 0.5.x)
      /babel@[1-5]\./, // Really old Babel versions (not 6+)
      /webpack@[1-3]\./, // Old Webpack versions
      /^1\.\d+\.\d+$/, // Version 1.x might be outdated for some packages
    ];

    const suspiciousPackages = [
      'babel-core', // deprecated, should use @babel/core
      'babel-preset-env', // deprecated, should use @babel/preset-env  
      'babel-runtime', // deprecated, should use @babel/runtime
      'left-pad', // infamous package
    ];

    // Skip modern Babel packages from being flagged as suspicious
    if (name.startsWith('@babel/') && version.startsWith('^7.')) {
      return false;
    }

    const fullName = `${name}@${version}`;
    return suspiciousPatterns.some(pattern => fullName.match(pattern)) ||
           suspiciousPackages.includes(name);
  }

  /**
   * Generate a comprehensive report
   */
  generateReport() {
    this.log(`\n${COLORS.BOLD}${COLORS.MAGENTA}VENDORED DEPENDENCIES ANALYSIS REPORT${COLORS.RESET}`);
    this.log('='.repeat(50));

    let totalUnused = 0;
    let totalSuspicious = 0;

    for (const [packageName, result] of Object.entries(this.results)) {
      this.log(`\n${COLORS.BOLD}${COLORS.CYAN}Package: ${packageName}${COLORS.RESET}`);
      
      if (result.errors.length > 0) {
        this.log(`${COLORS.RED}  ❌ Errors:${COLORS.RESET}`);
        for (const error of result.errors) {
          this.log(`${COLORS.RED}    • ${error}${COLORS.RESET}`);
        }
        continue;
      }

      const depCount = Object.keys(result.dependencies).length;
      const devDepCount = Object.keys(result.devDependencies).length;
      const usedCount = result.usedDependencies.size;

      this.log(`  📦 Dependencies: ${depCount} production, ${devDepCount} dev`);
      this.log(`  ✅ Used: ${usedCount} dependencies`);

      if (result.unusedProdDependencies && result.unusedProdDependencies.size > 0) {
        totalUnused += result.unusedProdDependencies.size;
        this.log(`${COLORS.RED}  ❌ Unused production deps: ${result.unusedProdDependencies.size}${COLORS.RESET}`);
        for (const unused of result.unusedProdDependencies) {
          const version = result.dependencies[unused];
          this.log(`${COLORS.RED}    • ${unused}@${version}${COLORS.RESET}`);
        }
      }

      if (result.unusedDevDependencies && result.unusedDevDependencies.size > 0) {
        this.log(`${COLORS.YELLOW}  ⚠️  Unused dev deps: ${result.unusedDevDependencies.size}${COLORS.RESET}`);
        for (const unused of result.unusedDevDependencies) {
          const version = result.devDependencies[unused];
          this.log(`${COLORS.YELLOW}    • ${unused}@${version}${COLORS.RESET}`);
        }
      }

      if (result.unusedDependencies.size === 0) {
        this.log(`${COLORS.GREEN}  ✅ No unused dependencies found${COLORS.RESET}`);
      }

      if (result.suspiciousDependencies.size > 0) {
        totalSuspicious += result.suspiciousDependencies.size;
        this.log(`${COLORS.YELLOW}  ⚠️  Suspicious: ${result.suspiciousDependencies.size} dependencies${COLORS.RESET}`);
        for (const suspicious of result.suspiciousDependencies) {
          this.log(`${COLORS.YELLOW}    • ${suspicious} (potentially outdated/deprecated)${COLORS.RESET}`);
        }
      }

      // Show some used dependencies for verification
      if (result.usedDependencies.size > 0) {
        this.log(`  ${COLORS.GREEN}Used dependencies:${COLORS.RESET}`);
        const usedArray = Array.from(result.usedDependencies).slice(0, 5);
        for (const used of usedArray) {
          const version = result.dependencies[used] || result.devDependencies[used] || 'unknown';
          this.log(`${COLORS.GREEN}    • ${used}@${version}${COLORS.RESET}`);
        }
        if (result.usedDependencies.size > 5) {
          this.log(`${COLORS.GREEN}    ... and ${result.usedDependencies.size - 5} more${COLORS.RESET}`);
        }
      }
    }

    // Summary
    this.log(`\n${COLORS.BOLD}${COLORS.MAGENTA}SUMMARY${COLORS.RESET}`);
    this.log('='.repeat(20));
    
    if (totalUnused === 0 && totalSuspicious === 0) {
      this.log(`${COLORS.GREEN}✅ No issues found! All vendored packages look clean.${COLORS.RESET}`);
    } else {
      if (totalUnused > 0) {
        this.log(`${COLORS.RED}❌ Total unused dependencies: ${totalUnused}${COLORS.RESET}`);
      }
      if (totalSuspicious > 0) {
        this.log(`${COLORS.YELLOW}⚠️  Total suspicious dependencies: ${totalSuspicious}${COLORS.RESET}`);
      }
    }

    this.log(`\n${COLORS.CYAN}💡 Recommendations:${COLORS.RESET}`);
    this.log(`  • Review unused dependencies and consider removing them`);
    this.log(`  • Update suspicious/outdated packages to latest versions`);
    this.log(`  • Use 'npm ls' in vendor directories to check for vulnerabilities`);
  }

  /**
   * Run the complete analysis
   */
  async run() {
    this.log(`${COLORS.BOLD}${COLORS.BLUE}Starting vendored dependency analysis...${COLORS.RESET}`);
    
    if (!fs.existsSync(VENDORS_DIR)) {
      this.log(`${COLORS.RED}Error: vendors/ directory not found at ${VENDORS_DIR}${COLORS.RESET}`);
      process.exit(1);
    }

    const vendorPackages = fs.readdirSync(VENDORS_DIR)
      .map(name => path.join(VENDORS_DIR, name))
      .filter(fullPath => fs.statSync(fullPath).isDirectory());

    this.log(`Found ${vendorPackages.length} vendored packages:`);
    for (const pkg of vendorPackages) {
      this.log(`  • ${path.basename(pkg)}`);
    }

    // Analyze each package
    for (const vendorPath of vendorPackages) {
      const result = await this.analyzeVendorPackage(vendorPath);
      this.results[result.packageName] = result;
    }

    // Generate final report
    this.generateReport();

    // Exit with error code if issues found
    const hasIssues = Object.values(this.results).some(result => 
      result.unusedDependencies.size > 0 || result.suspiciousDependencies.size > 0
    );
    
    process.exit(hasIssues ? 1 : 0);
  }
}

// Run the analyzer if this script is executed directly
if (require.main === module) {
  const analyzer = new VendorDependencyAnalyzer();
  analyzer.run().catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
}

module.exports = VendorDependencyAnalyzer;