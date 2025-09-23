# Mumbling Mole (Lite Mumble Web Client)

A lightweight HTML5 Mumble client for web browsers.

## Development Scripts

| Script                | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `npm run build`       | Smart build with change detection.                         |
| `npm run build:force` | Forces a clean rebuild of the `dist/` directory.           |
| `npm test`            | Runs E2E smoke tests and a security audit.                 |
| `npm run test:e2e`    | Runs only the local E2E tunnel smoke test.                 |
| `npm run audit:ci`    | Audits dependencies against the `audit-baseline.json`.     |
| `npm run build:vendor:mumble-client` | Rebuilds the vendored `mumble-client` from `src` to `lib`. |
| `npm run check:vendor-deps` | Analyzes vendored packages for unused dependencies.      |

## Vendored Dependencies

Some critical libraries are vendored in `vendors/` (e.g. `mumble-client`, `netlify-identity-widget`). 

### Dependency Analysis

Use the vendored dependency analyzer to check for unused dependencies:

```bash
npm run check:vendor-deps
```

This tool:
- ✅ Identifies unused dependencies in vendored packages
- ⚠️ Flags suspicious or outdated dependencies  
- 🔍 Recognizes indirect usage patterns (e.g., runtime dependencies)
- 🛠️ Understands build tools that don't appear in source imports

The analysis helps keep vendored packages lean and secure by identifying dependencies that can be safely removed.

## Project Structure

- `vendors/` - Vendored dependencies and libraries
- `app/` - Main application source code
- `scripts/` - Build and development scripts
- `themes/` - UI themes and styling

For detailed vendored dependency analysis information, see `scripts/README-vendor-deps.md`.