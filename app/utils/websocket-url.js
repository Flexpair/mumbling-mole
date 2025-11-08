/**
 * Utilities for Mumble WebSocket connection management
 */

/**
 * Construct WebSocket URL for Mumble server connection
 * Handles various port formats and protocols
 * 
 * @param {string} host - Server hostname (e.g., 'mumble.example.com')
 * @param {string|number} port - Server port, can be:
 *   - Plain port: '64738' or 64738
 *   - Port with path: '443/murmur' or '443/ws/path'
 * @returns {string} Complete WebSocket URL (wss:// or ws://)
 * 
 * @example
 * buildWebSocketUrl('mumble.example.com', '64738')
 * // => 'wss://mumble.example.com:64738'
 * 
 * buildWebSocketUrl('example.com', '443/murmur')
 * // => 'wss://example.com/murmur'
 * 
 * buildWebSocketUrl('localhost', '80')
 * // => 'ws://localhost'
 */
export function buildWebSocketUrl(host, port) {
  const portStr = String(port);
  
  if (portStr.includes('/')) {
    // Format: "443/path" or "443/path/subpath" → wss://host/path or wss://host/path/subpath
    const slashIndex = portStr.indexOf('/');
    const portNum = portStr.substring(0, slashIndex);
    const path = portStr.substring(slashIndex + 1);
    const protocol = portNum === '443' ? 'wss' : 'ws';
    
    // Omit port for standard ports (443 for wss, 80 for ws)
    if (portNum === '443' || portNum === '80') {
      return `${protocol}://${host}/${path}`;
    }
    return `${protocol}://${host}:${portNum}/${path}`;
  } else {
    // Format: "64738" → wss://host:64738
    const protocol = portStr === '443' ? 'wss' : 'ws';
    
    // Omit port for standard ports
    if (portStr === '443' || portStr === '80') {
      return `${protocol}://${host}`;
    }
    return `${protocol}://${host}:${portStr}`;
  }
}
