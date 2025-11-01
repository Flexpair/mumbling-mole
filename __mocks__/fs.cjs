/**
 * Mock fs module for Jest tests
 * 
 * Provides minimal fs API stubs to avoid import errors.
 * Real file operations should not be needed in unit tests.
 * 
 * Using CommonJS format for Jest compatibility.
 */

// We need to read the actual file at compile time, not runtime
// since jest mocks all fs operations
const path = require('node:path');
const protoPath = path.join(__dirname, '../app/mumble-streams/Mumble.proto');

// This will be evaluated BEFORE jest mocking takes effect
let mumbleProtoContent = '';
try {
  // Use require.resolve to bypass jest's module system
  const Module = require('module');
  const originalRequire = Module.prototype.require;
  const realFs = originalRequire.call(Module, 'node:fs');
  
  if (realFs && realFs.readFileSync && realFs.existsSync(protoPath)) {
    mumbleProtoContent = realFs.readFileSync(protoPath, 'utf8');
  }
} catch (e) {
  // Fallback: content will be empty
}

module.exports = {
  readFileSync: (filepath, encoding) => {
    // Return Mumble.proto content if requested
    if (filepath && filepath.includes('Mumble.proto')) {
      return mumbleProtoContent;
    }
    return '';
  },
  writeFileSync: () => {},
  existsSync: () => false,
  mkdirSync: () => {},
  readdirSync: () => [],
  statSync: () => ({ isDirectory: () => false }),
};
