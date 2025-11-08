import { ref, watch } from 'vue';
import BufferQueueNode from '../audio/buffer-queue-node';
import ko from 'knockout';
import { debugLog } from './debug-utils';

/**
 * useUserState - Vue composable for user-related state and operations
 * 
 * Responsibilities:
 * - Current user (thisUser) tracking
 * - Self mute/deaf state
 * - Minimal user registration (protocol support)
 * - Voice stream playback for users
 * 
 * Migration from Knockout:
 * - ko.observable() → ref()
 * - observable.subscribe() → watch()
 * 
 * NOTE: No UI rendering of user lists - app displays minimal UI (MessageBox + audio controls).
 * User protocol objects (mumble-client/user.js) maintain channel.users array.
 * UI only needs user.channel() reference for sendMessage and messageBoxHint.
 */
export function useUserState(audioState, voiceState) {
  // Current user
  const thisUser = ref(null);
  
  // Self mute/deaf state
  const selfMute = ref(false);
  const selfDeaf = ref(false);
  
  // CLEANUP-TRACKING: Track active voice stream resources for proper cleanup
  // Prevents memory leaks from intervals and subscriptions
  // Key can be either streamId (unique per stream) or sessionId (user session)
  // streamId format: 'sessionId_timestamp_random' for uniqueness
  const _activeVoiceStreams = new Map();

  /**
   * Register a user with minimal UI wrapper
   * Keeps essential properties: model, name, channel, selfMute/selfDeaf, talking (for voice UI).
   * No tree observables or complex event handlers.
   * 
   * @param {object} user - User model from mumble-client
   */
  function registerUser(user) {
    // Skip if UI already initialized
    if (user.__ui) {
      return;
    }
    
    // Use imported ko for backward compatibility with mixed Knockout code
    
    // Minimal wrapper: model, name, channel, self mute/deaf, talking
    // Protocol user.channel exists on model; channel.users managed by mumble-client
    let ui = (user.__ui = {
      model: user,
      name: ko.observable(user.username),
      channel: ko.observable(user.channel?.__ui),
      selfMute: ko.observable(user.selfMute),
      selfDeaf: ko.observable(user.selfDeaf),
      talking: ko.observable('off'), // Needed for voice stream UI
    });

    // Voice stream handler (needed for audio playback)
    user.on('voice', (stream) => {
        debugLog('[VOICE]', 'Voice stream received for user:', user.username);
        
        // CLEANUP-SAFETY: Generate unique stream ID to handle multiple streams per user
        // Use timestamp + random to ensure uniqueness even if user.session is undefined
        const streamId = `${user.session || 'unknown'}_${Date.now()}_${Math.random()}`;
        
        // Clear any previous voice stream resources for this user (using session ID)
        // This stops old intervals before starting new ones
        _cleanupVoiceStream(user.session);
        
        // Create audio node for playing back received voice
        let userNode = new BufferQueueNode({
          audioContext: audioState.getAudioContext(),
        });
        
        // Create a GainNode to control volume (for deafen functionality)
        let gainNode = audioState.getAudioContext().createGain();
        
        // Set initial gain based on current deafen state
        gainNode.gain.value = selfDeaf.value ? 0 : 1;
        debugLog('[VOICE]', 'Initial gain set to:', gainNode.gain.value);
        
        // LOOPBACK-FREQUENCY-ANALYSIS: Create AnalyserNode for frequency detection in loopback mode
        let analyserNode = null;
        let frequencyAnalysisInterval = null;
        
        if (voiceState.isLoopbackMode.value) {
          analyserNode = audioState.getAudioContext().createAnalyser();
          analyserNode.fftSize = 32768; // FFT size for frequency resolution (~1.46 Hz resolution @ 48kHz)
          analyserNode.smoothingTimeConstant = 0.8; // Smooth frequency data
          
          // Connect: userNode -> gainNode -> analyserNode -> destination
          // Frequency analysis AFTER gain node, so it only measures audible audio
          userNode.connect(gainNode);
          gainNode.connect(analyserNode);
          analyserNode.connect(audioState.getAudioContext().destination);
          
          // Start frequency analysis loop (runs continuously, checks selfDeaf internally)
          const bufferLength = analyserNode.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          let noAudioCount = 0;
          const NO_AUDIO_THRESHOLD = 3; // Hide after 3 consecutive checks without audio (300ms)
          
          frequencyAnalysisInterval = setInterval(() => {
            // Skip analysis if muted or deafened
            if (selfMute.value || selfDeaf.value) {
              if (voiceState.loopbackDominantFrequency.value > 0) {
                voiceState.updateLoopbackFrequency(0);
                debugLog('[LOOPBACK-FREQ]', 'Display cleared (muted or deafened)');
              }
              return;
            }
            
            analyserNode.getByteFrequencyData(dataArray);
            
            // Find dominant frequency (bin with highest amplitude)
            let maxAmplitude = 0;
            let maxIndex = 0;
            
            for (let i = 0; i < bufferLength; i++) {
              if (dataArray[i] > maxAmplitude) {
                maxAmplitude = dataArray[i];
                maxIndex = i;
              }
            }
            
            // Convert bin index to frequency (Hz)
            // frequency = (index * sampleRate) / fftSize
            const sampleRate = audioState.getAudioContext().sampleRate;
            const dominantFrequency = (maxIndex * sampleRate) / analyserNode.fftSize;
            
            // Update voice state with detected frequency (only if significant amplitude)
            // Threshold (50) to ensure display disappears quickly when audio stops
            if (maxAmplitude > 50) {
              voiceState.updateLoopbackFrequency(dominantFrequency);
              noAudioCount = 0; // Reset counter when audio detected
              debugLog('[LOOPBACK-FREQ]', 'Dominant frequency:', dominantFrequency.toFixed(1), 'Hz, amplitude:', maxAmplitude);
            } else {
              // No significant audio - increment counter
              noAudioCount++;
              
              // Only clear display after consecutive checks without audio (and only if display is visible)
              if (noAudioCount >= NO_AUDIO_THRESHOLD && voiceState.loopbackDominantFrequency.value > 0) {
                voiceState.updateLoopbackFrequency(0);
                debugLog('[LOOPBACK-FREQ]', 'Display cleared after', noAudioCount, 'checks, amplitude:', maxAmplitude);
              } else if (noAudioCount < NO_AUDIO_THRESHOLD) {
                debugLog('[LOOPBACK-FREQ]', 'Low audio, amplitude:', maxAmplitude, 'count:', noAudioCount, '/', NO_AUDIO_THRESHOLD);
              }
            }
          }, 100); // Update every 100ms
          
          debugLog('[LOOPBACK-FREQ]', 'Frequency analysis started for loopback mode');
        } else {
          // Normal mode: Connect: userNode -> gainNode -> destination
          userNode.connect(gainNode);
          gainNode.connect(audioState.getAudioContext().destination);
        }
        
        // Subscribe to selfDeaf changes to update gain (Vue watcher)
        const stopDeafWatch = watch(selfDeaf, (isDeaf) => {
          gainNode.gain.value = isDeaf ? 0 : 1;
          debugLog('[VOICE]', 'Gain updated to:', gainNode.gain.value);
        });
        
        // CLEANUP-TRACKING: Store resources for proper cleanup
        // Use streamId as key for this specific stream, store sessionId for fallback cleanup
        _activeVoiceStreams.set(streamId, {
          sessionId: user.session,
          interval: frequencyAnalysisInterval,
          stopWatch: stopDeafWatch, // Vue watch cleanup function
          userNode: userNode
        });

        stream
          .on('data', (data) => {
            debugLog('[VOICE]', 'Audio data received, target:', data.target);
            
            if (data.target === 'normal') {
              ui.talking('on');
            } else if (data.target === 'shout') {
              ui.talking('shout');
            } else if (data.target === 'whisper') {
              ui.talking('whisper');
            } else if (data.target === 'loopback') {
              ui.talking('on');
              debugLog('[VOICE]', 'Loopback audio received!');
            }
            
            userNode.write(data.buffer);
          })
          .on('end', () => {
            debugLog('[VOICE]', 'Voice stream ended for user:', user.username);
            ui.talking('off');
            
            // CLEANUP: Use streamId to clean up this specific stream
            _cleanupVoiceStream(streamId);
          });
      });
  }
  
  /**
   * Clean up voice stream resources (intervals, watchers, audio nodes)
   * RACE-SAFE: Can be called multiple times safely (idempotent)
   * @param {string|number} identifier - Either streamId (specific stream) or sessionId (all streams for user)
   * @private
   */
  function _cleanupVoiceStream(identifier) {
    // Try direct lookup first (streamId)
    const resources = _activeVoiceStreams.get(identifier);
    if (resources) {
      _disposeStreamResources(resources, identifier);
      return;
    }
    
    // If not found, cleanup all streams for this session (sessionId)
    for (const [streamId, res] of _activeVoiceStreams.entries()) {
      if (res.sessionId === identifier) {
        _disposeStreamResources(res, streamId);
      }
    }
  }

  /**
   * Dispose individual stream resources
   * @param {object} resources - Stream resources object
   * @param {string} identifier - Stream or session identifier
   * @private
   */
  function _disposeStreamResources(resources, identifier) {
    // Clear frequency analysis interval
    if (resources.interval) {
      clearInterval(resources.interval);
      debugLog('[LOOPBACK-FREQ]', 'Frequency analysis stopped');
    }
    
    // Stop Vue watcher
    if (resources.stopWatch) {
      try {
        resources.stopWatch();
        debugLog('[VOICE]', 'Deaf watcher stopped');
      } catch (err) {
        console.error('[VOICE] Error stopping watcher:', err);
      }
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
    _activeVoiceStreams.delete(identifier);
  }

  /**
   * Request mute for user
   * @param {object} user - User UI object
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  function requestMute(user, onAudioLocked) {
    if (user !== thisUser.value) return;
    selfMute.value = true;
  }

  /**
   * Request deaf for user
   * @param {object} user - User UI object
   * @param {boolean} isLoopbackMode - Whether in loopback mode
   */
  function requestDeaf(user, isLoopbackMode = false) {
    if (user !== thisUser.value) return;
    
    // In loopback mode, allow deaf without mute
    // In normal mode, deaf automatically enables mute
    if (!isLoopbackMode) {
      selfMute.value = true;
    }
    
    selfDeaf.value = true;
  }

  /**
   * Request unmute for user
   * @param {object} user - User UI object
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  function requestUnmute(user, onAudioLocked) {
    if (user !== thisUser.value) {
      return;
    }
    
    selfMute.value = false;
    selfDeaf.value = false;
  }

  /**
   * Request undeaf for user
   * @param {object} user - User UI object
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  function requestUndeaf(user, onAudioLocked) {
    if (user !== thisUser.value) return;
    selfDeaf.value = false;
  }

  /**
   * Reset user state
   */
  function reset() {
    thisUser.value = null;
    selfMute.value = false;
    selfDeaf.value = false;
  }

  // Return composable API
  return {
    // State (reactive)
    thisUser,
    selfMute,
    selfDeaf,
    
    // Methods
    registerUser,
    requestMute,
    requestDeaf,
    requestUnmute,
    requestUndeaf,
    reset,
  };
}
