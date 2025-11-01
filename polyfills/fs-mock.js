// Mock fs module for browser environment
// Provides Mumble.proto file content for mumble-streams

import protoContent from '../app/mumble-streams/Mumble.proto';

const fileContents = {
  'Mumble.proto': protoContent
};

export const readFileSync = function(filepath, encoding) {
  // Handle path.join(__dirname, 'Mumble.proto') pattern
  const filename = filepath.split('/').pop().split('\\').pop();
  
  if (fileContents[filename]) {
    return fileContents[filename];
  }
  
  throw new Error(`fs.readFileSync: file not found: ${filepath}`);
};

export const writeFileSync = function() {
  throw new Error('fs.writeFileSync is not available in browser');
};

export const existsSync = function(filepath) {
  const filename = filepath.split('/').pop().split('\\').pop();
  return fileContents.hasOwnProperty(filename);
};

export const readFile = function(path, options, callback) {
  if (typeof options === 'function') {
    callback = options;
  }
  try {
    const content = readFileSync(path);
    if (callback) {
      callback(null, content);
    }
  } catch (err) {
    if (callback) {
      callback(err);
    }
  }
};

export const writeFile = function(path, data, options, callback) {
  if (typeof options === 'function') {
    callback = options;
  }
  if (callback) {
    callback(new Error('fs.writeFile is not available in browser'));
  }
};

// Default export for CommonJS compatibility
export default {
  readFileSync,
  writeFileSync,
  existsSync,
  readFile,
  writeFile
};
