/**
 * Jest transformer for .proto files
 * Reads .proto files as text and exports them as module.exports
 */

const fs = require('fs');

module.exports = {
  process(sourceText, sourcePath) {
    // Read the file as text
    const content = fs.readFileSync(sourcePath, 'utf8');
    
    // Return as CommonJS module export
    return {
      code: `module.exports = ${JSON.stringify(content)};`
    };
  }
};
