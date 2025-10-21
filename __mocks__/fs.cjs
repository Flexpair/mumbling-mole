/**
 * Mock fs module for Jest tests
 * 
 * Provides minimal fs API stubs to avoid import errors.
 * Real file operations should not be needed in unit tests.
 * 
 * Using CommonJS format for Jest compatibility.
 */

module.exports = {
  readFileSync: () => '',
  writeFileSync: () => {},
  existsSync: () => false,
  mkdirSync: () => {},
  readdirSync: () => [],
  statSync: () => ({ isDirectory: () => false }),
};
