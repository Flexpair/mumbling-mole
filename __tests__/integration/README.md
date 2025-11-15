# Integration Tests

This folder contains integration tests for vendored dependencies. Unlike unit tests that focus on internal implementation details, integration tests validate that the vendored libraries work correctly with our codebase's actual usage patterns.

## Test Files

### protobuf-serialization.test.js (19 tests) 🔥 **CRITICAL**

**Purpose**: Prevent silent Protobuf.js field dropping bugs that cause features to fail without errors.

Tests the critical camelCase vs snake_case field naming convention:

- **Silent Field Dropping**: Documents that Protobuf.js silently drops incorrectly-named fields
- **Mute/Deaf Messages**: Validates `selfMute`/`selfDeaf` (camelCase) NOT `self_mute`/`self_deaf`
- **Text Messages**: Validates `channelId`/`treeId` (camelCase) NOT `channel_id`/`tree_id`
- **Regression Detection**: Will fail if code reverts to snake_case field names
- **Documentation**: Serves as reference for all future Protobuf message handling

**Why This Matters**:
- Protobuf.js converts `.proto` snake_case → JavaScript camelCase automatically
- Using snake_case in outgoing messages causes **silent field drops** (no errors!)
- Features appear to work in UI but fail to communicate with server
- This was the root cause of the message sending bug (Nov 2025)

### mumble-client-integration.test.js (24 tests)

Tests integration of the `mumble-client` vendored library with our codebase. Validates:

- Static utility methods (bandwidth calculations)
- Client construction patterns
- Event system compatibility
- Integration with ConnectionState and WorkerBasedMumbleClient
- Error handling behaviors

### mumble-streams-integration.test.js (61 tests)

Tests integration of the `mumble-streams` vendored library. Validates:

- Module exports and API surface
- Version information handling
- Protobuf message encoding/decoding (data module)
- Voice packet encoding/decoding
- UDP crypto operations
- Stream compatibility (piping, Transform streams)
- Codec support and error handling

## Test Summary

**Total Integration Tests: 104** (19 protobuf + 24 mumble-client + 61 mumble-streams)

## Unit Tests

For deeper internal testing, see the unit test suite:

### mumble-streams-unit.test.js (72 tests)

Comprehensive unit tests for mumble-streams internal functions:

- Voice Encoder/Decoder: Constructor validation, codec handling (Opus/CELT/Speex), ping packets, loopback mode, position data, error handling
- Data Module: Protobuf message encoding/decoding, round-trip testing, message type coverage
- UDP Crypto: Key management, encryption/decryption, IV handling, ready state, key generation
- Version Object: Version encoding and consistency

**Total Vendor Tests: 176 (104 integration + 72 unit)**

## Why Integration Tests?

We chose integration tests over migrating the vendor's original test suites because:

1. **Actual Usage**: Tests validate how we actually use these libraries, not their full API surface
2. **Maintainability**: No need to update tests when vendored library structure changes
3. **Focused Coverage**: Only tests features and patterns we rely on in production
4. **Decoupling**: Vendor updates don't break our tests unless they break our actual usage

Unit tests complement integration tests by:

- Testing internal functions and edge cases
- Documenting expected behavior (characterization tests)
- Providing regression protection during refactoring
- Validating error handling paths

## Running Tests

```bash
# Run all vendor tests (integration + unit)
npm run test:unit -- __tests__/integration/ __tests__/mumble-streams-unit.test.js

# Run only integration tests
npm run test:unit -- __tests__/integration/

# Run only unit tests
npm run test:unit -- __tests__/mumble-streams-unit.test.js

# Run specific test file
npm run test:unit -- __tests__/integration/mumble-client-integration.test.js
npm run test:unit -- __tests__/integration/mumble-streams-integration.test.js
```
