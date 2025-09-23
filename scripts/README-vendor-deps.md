# Vendored Dependencies Analysis

This directory contains a tool to analyze unused dependencies in vendored packages within the `vendors/` directory.

## Usage

```bash
# Check all vendored packages for unused dependencies
npm run check:vendor-deps

# Or run directly
node scripts/check-vendor-deps.js
```

## What it checks

The script analyzes each vendored package and identifies:

1. **Unused Dependencies**: Dependencies listed in `package.json` but not imported/required in source code
2. **Suspicious Dependencies**: Potentially outdated or deprecated packages
3. **Build Dependencies**: Recognizes common build/test tools that may not appear in source imports

## Analysis Features

- **Smart Detection**: Uses regex patterns to find imports, requires, and dynamic imports
- **Indirect Usage**: Checks for dependencies that might be used indirectly (e.g., `ws` used by websocket libraries)
- **Build Tool Recognition**: Knows about common build tools (Babel, ESLint, Webpack, etc.) that don't appear in source code
- **Separate Categorization**: Distinguishes between production and development dependencies

## Example Output

```
Starting vendored dependency analysis...
Found 2 vendored packages:
  • mumble-client
  • netlify-identity-widget

Analyzing: mumble-client
  Found 4 source files
  📎 websocket-stream appears to be used indirectly
  📎 ws appears to be used indirectly

VENDORED DEPENDENCIES ANALYSIS REPORT
==================================================

Package: mumble-client
  📦 Dependencies: 10 production, 8 dev
  ✅ Used: 12 dependencies
  ✅ No unused dependencies found
  Used dependencies:
    • remove-value@^1.0.0
    • mumble-streams@0.0.4
    • reduplexer@^1.1.0
    • through2@^4.0.2
    • promise@^8.1.0
    ... and 7 more

SUMMARY
====================
✅ No issues found! All vendored packages look clean.
```

## Exit Codes

- `0`: No unused or suspicious dependencies found
- `1`: Issues found (unused or suspicious dependencies detected)

## Customization

The script can be customized by modifying:

- **Build Dependencies**: Update `isKnownBuildDependency()` to recognize additional build tools
- **Indirect Dependencies**: Update `checkIndirectUsage()` for package-specific indirect usage patterns
- **Suspicious Patterns**: Update `isSuspicious()` to change what's considered suspicious

## Integration

This tool is designed to be run:
- Manually during development to clean up dependencies
- In CI/CD pipelines to prevent dependency bloat
- Before releases to ensure minimal vendored package size