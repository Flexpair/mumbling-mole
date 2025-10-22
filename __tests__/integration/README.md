# Integration Tests

This directory contains integration tests that validate how external dependencies and modules work together within the application context.

## Structure

### `mumble-client-integration.test.js`

Integration tests for the vendored `mumble-client` library (`vendors/mumble-client/`). These tests validate:

- **Bandwidth Calculation**: Static methods used throughout the app for calculating enforceable bandwidth based on bitrate, frames per packet, and voice activity detection
- **Client Construction**: Proper initialization with various option combinations
- **Event System**: EventEmitter compatibility and event registration
- **Property/Method Access**: Verification that expected APIs are available
- **Integration Points**:
  - `ConnectionState` interface compatibility
  - `WorkerBasedMumbleClient` usage patterns
  - `mumble-websocket.js` connection patterns
- **Error Handling**: Username validation and stream errors
- **Resource Management**: Instance independence and garbage collection

## Why Integration Tests?

`mumble-client` is a vendored dependency (external library copied into this repo). Its original tests use Mocha/Chai, while this project uses Jest. Rather than migrating the vendor's tests (which would create maintenance overhead during updates), we:

1. **Keep vendor tests intact** - Original Mocha/Chai tests in `vendors/mumble-client/test/`
2. **Add integration tests** - Jest-based tests validating how WE use mumble-client in OUR codebase

## Benefits

- ✅ **Single test framework**: All our tests use Jest
- ✅ **Real-world validation**: Tests actual usage patterns from the codebase
- ✅ **Easy maintenance**: No need to update vendor tests when updating mumble-client
- ✅ **Regression protection**: Catches breaking changes in how we integrate with mumble-client

## Running Tests

```bash
# Run all integration tests
npm run test:unit -- __tests__/integration

# Run specific integration test file
npm run test:unit -- __tests__/integration/mumble-client-integration.test.js

# Run with coverage
npm run test:unit:coverage -- __tests__/integration
```

## Test Coverage

Current coverage: 24 tests covering:

- 5 bandwidth calculation scenarios
- 4 client construction patterns
- 3 event system validations
- 2 property/method checks
- 3 integration compatibility checks
- 3 error handling cases
- 2 resource management validations
- 3 codebase pattern compatibility checks

## Adding More Integration Tests

When adding integration tests for other vendors or modules:

1. Create a new test file: `__tests__/integration/<module>-integration.test.js`
2. Focus on how the module integrates with the codebase
3. Test actual usage patterns from the app
4. Document critical integration points
5. Update this README with the new test file

## Related Documentation

- Main test documentation: `tests/README.md`
- Audio integration testing: `app/audio/README.md`
- State architecture: `app/state/README.md`
