/**
 * Node.js shims for browser environment
 * Provides stub implementations of Node.js globals that don't crash
 */

// Stub fs module for browser - returns empty implementations
if (typeof window !== 'undefined' && !window.fs) {
  window.fs = {
    readFileSync: function() {
      throw new Error('fs.readFileSync is not available in browser environment');
    },
    writeFileSync: function() {
      throw new Error('fs.writeFileSync is not available in browser environment');
    },
    existsSync: function() { return false; },
    readFile: function(path, callback) {
      callback(new Error('fs.readFile is not available in browser environment'));
    },
    writeFile: function(path, data, callback) {
      callback(new Error('fs.writeFile is not available in browser environment'));
    },
  };
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.fs || {};
}
