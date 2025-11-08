/**
 * Utilities for managing voice stream resource cleanup
 * Prevents memory leaks from intervals, subscriptions, and audio nodes
 */

/**
 * Creates a voice stream resource manager with idempotent cleanup
 * 
 * @returns {object} Resource manager with cleanup methods
 * 
 * @example
 * const manager = createVoiceStreamManager();
 * 
 * // Store resources
 * manager.set(streamId, {
 *   sessionId: user.session,
 *   interval: setInterval(...),
 *   subscription: observable.subscribe(...),
 *   userNode: new BufferQueueNode(...)
 * });
 * 
 * // Cleanup single stream or all streams for a session
 * manager.cleanup(streamId);
 */
export function createVoiceStreamManager() {
  const activeStreams = new Map();

  /**
   * Store voice stream resources
   */
  function set(streamId, resources) {
    activeStreams.set(streamId, resources);
  }

  /**
   * Get voice stream resources
   */
  function get(streamId) {
    return activeStreams.get(streamId);
  }

  /**
   * Clean up voice stream resources
   * RACE-SAFE: Can be called multiple times safely (idempotent)
   * 
   * @param {string|number} identifier - Either streamId (specific stream) or sessionId (all streams for user)
   * @param {Function} disposeCallback - Custom disposal logic for framework-specific resources
   */
  function cleanup(identifier, disposeCallback) {
    // Try direct lookup first (streamId)
    const resources = activeStreams.get(identifier);
    if (resources) {
      disposeResources(resources, identifier, disposeCallback);
      return;
    }
    
    // If not found, cleanup all streams for this session (sessionId)
    for (const [streamId, res] of activeStreams.entries()) {
      if (res.sessionId === identifier) {
        disposeResources(res, streamId, disposeCallback);
      }
    }
  }

  /**
   * Dispose individual stream resources
   * @param {object} resources - Stream resources object
   * @param {string} identifier - Stream or session identifier
   * @param {Function} disposeCallback - Custom disposal logic
   * @private
   */
  function disposeResources(resources, identifier, disposeCallback) {
    // Stop frequency analyzer (if present)
    if (resources.analyzer) {
      try {
        resources.analyzer.stop();
      } catch (err) {
        console.error('[VOICE] Error stopping analyzer:', err);
      }
    }
    
    // Clear frequency analysis interval (legacy support)
    if (resources.interval) {
      clearInterval(resources.interval);
    }
    
    // Framework-specific disposal (Knockout subscription or Vue watcher)
    if (disposeCallback) {
      disposeCallback(resources);
    }
    
    // End audio node
    if (resources.userNode) {
      try {
        resources.userNode.end();
      } catch (err) {
        console.error('[VOICE] Error ending userNode:', err);
      }
    }
    
    // Remove from tracking
    activeStreams.delete(identifier);
  }

  return {
    set,
    get,
    cleanup,
  };
}
