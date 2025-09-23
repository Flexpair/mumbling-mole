# Claude AI Context · mumbling-mole

## Project Overview

**mumbling-mole** is a browser-first Mumble client that enables voice communication through a web interface. It wraps the vendored `mumble-client` library and compiles to a browser bundle via Webpack 5.

### Core Technologies
- **Frontend**: Knockout.js for MVVM data binding, Web Workers for audio processing
- **Audio**: Web Audio API, AudioWorklet for real-time audio capture
- **Build**: Webpack 5, Babel, Node.js 22.19
- **Runtime**: Docker container with websockify for WebSocket-to-TCP tunneling
- **Language**: JavaScript (ES6+), SCSS for styling

## Architecture Overview

### Main Thread (UI Layer)
- **Entry Point**: `app/index.js` - Orchestrates authentication, server connection, and voice UX
- **View Layer**: Knockout.js viewmodels with data bindings defined in `GlobalBindings`
- **Templates**: HTML templates in `app/index.html` with Knockout bindings
- **Localization**: Multi-language support via `app/localize.js` and `localize/*.json`

### Worker Thread (Audio Processing)
- **Worker Entry**: `app/worker.js` - Runs in Web Worker, manages `mumble-client` instances
- **Bridge**: `WorkerBasedMumbleConnector` in `app/worker-client.js` - Proxies events between UI and worker
- **Protocol**: Serializes IDs instead of objects for cross-thread communication

### Audio Pipeline
- **Manager**: `app/audio-context-manager.js` - Manages AudioContext lifecycle
- **Voice Processing**: `app/voice.js` - Handles voice activation and stream creation
- **Capture**: `app/recorder-worker.js` - AudioWorklet that captures mic input at 48 kHz mono PCM
- **Format**: 960 samples per packet, resampled in worker before transmission

## Project Structure

```
mumbling-mole/
├── app/                    # Application source code
│   ├── index.js           # Main UI entry point
│   ├── index.html         # HTML template
│   ├── worker.js          # Web Worker for audio processing
│   ├── worker-client.js   # Worker-UI bridge
│   ├── voice.js           # Voice processing logic
│   ├── audio-context-manager.js  # Audio context management
│   ├── recorder-worker.js # AudioWorklet for recording
│   ├── config.js          # Default configuration
│   └── localize.js        # Localization system
├── vendors/               # Vendored packages
│   └── mumble-client/     # Forked Mumble client library
├── themes/                # UI themes
│   └── MetroMumbleLight/  # Default theme with variants
├── localize/              # Translation files
│   *.json                 # Language-specific strings
├── scripts/               # Build and test scripts
│   ├── e2e-check.cjs      # WebSocket smoke test
│   └── audit-ci.cjs       # Security audit gate
├── dist/                  # Build output (generated)
│   ├── index.html         # Compiled HTML
│   ├── bundle.js          # Webpack bundle
│   └── config.local.js    # Runtime configuration
├── webpack.config.js      # Webpack 5 configuration
├── smart-build.sh         # Intelligent build orchestrator
├── start-dev-server.sh    # Local development server
├── docker-entrypoint.sh   # Container runtime script
└── Dockerfile             # Container definition
```

## Development Workflow

### Building the Project

```bash
# Full build with vendor compilation
npm run build:force

# Incremental build (checks timestamps)
npm run build

# Skip build during npm install
SKIP_PREPARE=1 npm install
```

The build process:
1. `smart-build.sh` orchestrates the entire build
2. Compiles `vendors/mumble-client` with Babel if needed
3. Runs Webpack 5 to bundle the application
4. Validates output size and structure
5. Uses `dist/.build-marker` for incremental builds

### Local Development

```bash
# Start dev server with Mumble tunnel
MUMBLE_SERVER=host:port ./start-dev-server.sh

# Start static server only (no tunnel)
SKIP_TUNNEL=1 PORT=8081 ./docker-entrypoint.sh

# View logs
tail -f /tmp/entrypoint.log
```

### Testing

```bash
# Run all tests
npm run test

# Run WebSocket smoke test only
npm run test:e2e

# Update security audit baseline
npm run audit:baseline

# Check for unused dependencies
npm run check:deps
```

## Key Implementation Details

### Worker Communication Protocol
- Events are serialized with IDs, not object references
- Both `app/worker.js` and `WorkerBasedMumbleClient` must be updated together
- Event dispatch uses `_dispatchEvent` handlers for UI proxying

### Audio Configuration
- **Sample Rate**: 48 kHz
- **Channels**: Mono
- **Packet Size**: 960 samples
- **Format**: PCM Float32Array
- Changes to `samplesPerPacket` require updates in worker resampler

### Configuration System
- **Defaults**: `app/config.js` (source control)
- **Runtime**: `dist/config.local.js` (generated, not in source control)
- Build copies config to dist directory
- Never edit generated files directly

### Theme System
- Themes located in `themes/MetroMumbleLight/`
- SCSS compiled during build
- Runtime selection via `?theme=` query parameter
- Assets (SVG/PNG) copied to `dist/` during build

### Localization
- String keys in `localize/*.json`
- Accessed via `app/localize.js`
- Observable-based for automatic UI updates
- All locales must have matching keys

## Common Tasks

### Adding New UI State
1. Define observable in `GlobalBindings` (app/index.js)
2. Wire through Knockout bindings in templates
3. Update localization strings if needed

### Extending Worker Events
1. Update event handler in `app/worker.js`
2. Update corresponding `_dispatchEvent` in `WorkerBasedMumbleClient`
3. Ensure ID serialization is maintained

### Adding New Audio Processing
1. Modify pipeline in `app/voice.js` or `app/recorder-worker.js`
2. Maintain 48 kHz mono PCM format
3. Update worker resampling if packet size changes

### Updating Dependencies
1. Vendored packages use `file:` protocol
2. After changing `vendors/`, run `npm run build:vendor:mumble-client`
3. Smart build will auto-detect and recompile

## Important Conventions

### Code Style
- ES6+ JavaScript features
- Knockout observables for reactive UI
- Web Workers for CPU-intensive tasks
- Async/await for asynchronous operations

### Error Handling
- Worker errors bubble to main thread
- Audio errors gracefully degrade
- Network errors trigger reconnection logic

### Performance Considerations
- UI thread kept lightweight
- Audio processing isolated in workers
- Minimal DOM manipulation via Knockout

### Security
- WebSocket connections only (no direct TCP)
- Websockify provides TCP tunneling in Docker
- Regular security audits via `audit-ci`

## Docker Environment

### Build Stage
- Node.js 22.19 Alpine base
- Installs build dependencies
- Runs `npm run build:force`
- Outputs to `/app/dist`

### Runtime Stage
- Python 3.11 for websockify
- Nginx for static serving
- Configurable via environment variables

### Environment Variables
- `MUMBLE_SERVER`: Target Mumble server (host:port)
- `PORT`: HTTP server port (default: 80)
- `SKIP_TUNNEL`: Disable websockify tunnel
- `SKIP_PREPARE`: Skip build during npm install

## Debugging Tips

### Common Issues
1. **Worker communication fails**: Check ID serialization in both worker files
2. **Audio not working**: Verify AudioContext state and permissions
3. **Build fails**: Clear `dist/` and `.build-marker`, run `npm run build:force`
4. **Localization missing**: Ensure all locale files have matching keys

### Useful Commands
```bash
# Check worker logs
grep "worker" /tmp/entrypoint.log

# Verify build output
ls -la dist/

# Test WebSocket connection
node scripts/e2e-check.cjs

# Check for vulnerabilities
npm audit
```

## Quick Reference

### File Locations
- **UI Entry**: `app/index.js`, `app/index.html`
- **Worker**: `app/worker.js`, `app/worker-client.js`
- **Audio**: `app/voice.js`, `app/audio-context-manager.js`
- **Config**: `app/config.js`, `dist/config.local.js`
- **Build**: `smart-build.sh`, `webpack.config.js`
- **Runtime**: `start-dev-server.sh`, `docker-entrypoint.sh`

### NPM Scripts
- `npm run build` - Incremental build
- `npm run build:force` - Full rebuild
- `npm run test` - Run all tests
- `npm run audit:baseline` - Update security baseline
- `npm run check:deps` - Check for unused dependencies

### Key Dependencies
- `knockout` - MVVM framework
- `libsamplerate.js` - Audio resampling
- `mumble-client` - Vendored Mumble protocol implementation
- `webpack` - Module bundler
- `websockify` - WebSocket to TCP proxy (Docker only)
