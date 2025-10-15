"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getOSName = getOSName;
exports.getOSVersion = getOSVersion;
function getOSName() {
  if (process.browser) {
    return 'Browser';
  } else {
    return 'Node.js';
  }
}
function getOSVersion() {
  if (process.browser) {
    return navigator.userAgent;
  } else {
    return process.version;
  }
}