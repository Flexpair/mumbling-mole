# Playwright Tests for Mumbling Mole

This directory contains comprehensive Playwright tests for the Mumbling Mole browser-based Mumble client.

## Quick Start

### Running Tests

```bash
# Install Playwright browsers (if not already done)
npx playwright install

# Run all tests
npm run test:playwright

# Run with UI mode for debugging
npm run test:playwright:ui

# Run in headed mode to see browser
npm run test:playwright:headed

# Run specific test file
npx playwright test tests/ui/smoke.test.js
```

### Test Structure

```
tests/
├── setup/                    # Test infrastructure
│   ├── global-setup.js      # Starts static test server
│   └── global-teardown.js   # Cleanup
├── ui/                      # UI component tests
│   ├── smoke.test.js        # Basic functionality
│   ├── theme.test.js        # Theme switching
│   ├── connection-dialog.test.js  # Connection UI
│   ├── audio.test.js        # Audio system
│   └── localization.test.js # Multi-language
├── integration/             # Integration tests
│   └── error-handling.test.js  # Error scenarios
└── demo-server.js          # Standalone demo server
```

## Test Coverage

### UI Components (6 tests)
- Homepage loading and essential elements
- JavaScript bundle loading without errors
- Main UI component initialization
- Responsive design (mobile/desktop viewports)

### Theme System (5 tests)
- Default theme loading (MetroMumbleLight)
- Theme switching via URL parameters (`?theme=MetroMumbleDark`)
- Invalid theme parameter handling
- Visual appearance changes
- Functionality preservation across themes

### Connection Dialog (8 tests)
- Dialog presence and visibility
- URL parameter population (`?address=...&port=...&password=...`)
- Username field handling
- Parameter validation
- Special character support
- Connection state management
- Modal system functionality

### Audio System (9 tests)
- Audio context manager initialization
- Microphone permissions (mocked for testing)
- Voice handler initialization
- Worker-based architecture
- Settings configuration
- PTT (Push-to-Talk) functionality
- Audio encoding settings

### Localization (8 tests)
- Localization system initialization
- Text content rendering
- Localization key resolution
- Language switching mechanism
- Missing translation handling
- UI structure maintenance
- Knockout binding compatibility

### Error Handling (11 tests)
- Missing configuration files
- Network resource errors
- Invalid WebSocket connections
- Netlify Identity failures
- Malformed URL parameters (including XSS protection)
- Missing worker files
- Resource loading timeouts
- Browser compatibility issues
- Memory pressure
- JavaScript error recovery

## Demo Server

For manual testing and demonstration:

```bash
# Start demo server with guidance
node tests/demo-server.js

# Then visit in browser:
# http://localhost:3000
# http://localhost:3000/?theme=MetroMumbleDark
# http://localhost:3000/?address=voice.example.com&port=64738&password=test
```

## Architecture

The tests are designed to:

- **Complement existing tests**: Work alongside `e2e-check.cjs` without duplication
- **Focus on browser behavior**: Test UI interactions and client-side functionality
- **Mock external dependencies**: Audio APIs, network requests, etc.
- **Provide comprehensive coverage**: 47 individual test cases across 6 suites
- **Support CI/CD**: Configurable headless/headed execution
- **Maintain consistency**: Follow project coding conventions

## Configuration

Tests use `playwright.config.js` with:
- Chromium browser (configurable for multiple browsers)
- Automatic retry on failures
- Screenshot/video capture on failure
- HTML reporting
- Global setup/teardown for test server

## Benefits

- **Regression Prevention**: Catch UI/UX breaking changes
- **Browser Compatibility**: Test across different browser engines
- **User Experience Validation**: Ensure real-world usage scenarios work
- **Documentation**: Tests serve as living documentation of functionality
- **CI Integration**: Automated testing in development workflow