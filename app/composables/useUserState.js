import { ref, watch, markRaw } from 'vue';
import BufferQueueNode from '../audio/buffer-queue-node';
import { debugLog } from './debug-utils';
import { createVoiceStreamManager } from '../utils/voice-stream-manager';
import { createFrequencyAnalyzer } from '../utils/frequency-analyzer';

/**
 * useUserState - Vue composable for user-related state and operations
 * 
 * Responsibilities:
 * - Current user (thisUser) tracking
 * - Self mute/deaf state
 * - Minimal user registration (protocol support)
 * - Voice stream playback for users
 * 
 * State management:
 * - ref() for reactive state
 * - watch() for reactive subscriptions
 * - markRaw() for protocol objects (prevents deep reactivity)
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
  
  // CLEANUP-TRACKING: Voice stream resource manager
  // Prevents memory leaks from intervals and subscriptions
  const _streamManager = createVoiceStreamManager();

  // Settings injection
  let settings = null;
  
  function setSettings(s) {
    settings = s;
    if (settings && settings.jitterBufferSize) {
      watch(settings.jitterBufferSize, (newSize) => {
        debugLog('[VOICE]', 'Updating jitter buffer size to:', newSize);
        _streamManager.forEach((resources) => {
          if (resources.userNode && typeof resources.userNode.setJitterBufferSize === 'function') {
            resources.userNode.setJitterBufferSize(newSize);
          }
        });
      });
    }
  }

  /**
   * Register a user with minimal UI wrapper
   * Keeps essential properties: model, name, channel, selfMute/selfDeaf, talking (for voice UI).
   * No tree observables or complex event handlers.
   * 
   * @param {object} user - User model from mumble-client
   */
  function registerUser(user) {
    
    // FORCE RECREATION: Always delete old __ui and create fresh Vue-based one
    // This ensures we never have stale Knockout or plain objects
    if (user.__ui) {
      delete user.__ui;
    }

    // SERVER-STATE-SYNC: Listen for server's authoritative state updates
    // This ensures UI ALWAYS matches server state (100% guarantee)
    const syncServerState = (serverState) => {
      debugLog('[SERVER-STATE-SYNC] Received server state:', serverState);
      debugLog('[SERVER-STATE-SYNC] Current UI state:', { selfMute: selfMute.value, selfDeaf: selfDeaf.value });
      
      // Force UI to match server's state
      if (serverState.selfMute !== undefined) {
        selfMute.value = serverState.selfMute;
      }
      if (serverState.selfDeaf !== undefined) {
        selfDeaf.value = serverState.selfDeaf;
      }
      
      debugLog('[SERVER-STATE-SYNC] UI synchronized to:', { selfMute: selfMute.value, selfDeaf: selfDeaf.value });
    };
    
    // Remove old listener if it exists to prevent memory leak
    if (user.__syncServerState) {
      user.off('server-state-sync', user.__syncServerState);
    }
    
    // Store reference for cleanup and add listener
    user.__syncServerState = syncServerState;
    user.on('server-state-sync', syncServerState);
    
    // Create new minimal wrapper with Vue refs
    // Protocol user.channel exists on model; channel.users managed by mumble-client
    // Use markRaw to prevent Vue from making this reactive and unwrapping nested refs
    // 
    // NOTE: user.channel will be undefined initially because WorkerBasedMumbleUser
    // properties are populated async via pushProp messages. We don't wait for it
    // because sendMessage now uses root channel directly.
    let ui = (user.__ui = markRaw({
      model: user,
      name: ref(user.username),
      channel: ref(user.channel?.__ui),
      selfMute: ref(user.selfMute),
      selfDeaf: ref(user.selfDeaf),
      talking: ref('off'), // Needed for voice stream UI
    }));
    
    // Subscribe to user updates for voice/mute/deaf state changes
    user.on('update', (actor, properties) => {
      if ('channel' in properties) {
        const newChannel = user.channel?.__ui;
        ui.channel.value = newChannel;
      }
      if ('selfMute' in properties) {
        ui.selfMute.value = properties.selfMute;
      }
      if ('selfDeaf' in properties) {
        ui.selfDeaf.value = properties.selfDeaf;
      }
    });

    // Voice stream handler (needed for audio playback)
    user.on('voice', async (stream) => {
        console.log('[VOICE] Voice stream received for user:', user.username, 'session:', user.session);
        
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
        
        // CRITICAL FIX: Initialize BufferQueueNode before use
        // This loads the AudioWorklet module and creates the worklet node
        try {
          console.log('[VOICE] Initializing BufferQueueNode...');
          await userNode.initialize();
          console.log('[VOICE] ✅ BufferQueueNode initialized successfully');
          
          // Set initial jitter buffer size if settings available
          if (settings && settings.jitterBufferSize) {
             userNode.setJitterBufferSize(settings.jitterBufferSize.value);
          }
        } catch (err) {
          console.error('[VOICE] ❌ Failed to initialize BufferQueueNode:', err);
          console.error('[VOICE] Error details:', {
            name: err.name,
            message: err.message,
            stack: err.stack
          });
          // Clean up and abort - playback cannot work without AudioWorklet
          return;
        }
        
        // Create a GainNode to control volume (for deafen functionality)
        let gainNode = audioState.getAudioContext().createGain();
        
        // Set initial gain based on current deafen state
        gainNode.gain.value = selfDeaf.value ? 0 : 1;
        debugLog('[VOICE]', 'Initial gain set to:', gainNode.gain.value);
        
        // LOOPBACK-FREQUENCY-ANALYSIS: Create AnalyserNode for frequency detection in loopback mode
        let analyserNode = null;
        let frequencyAnalyzer = null;
        
        if (voiceState.isLoopbackMode.value) {
          analyserNode = audioState.getAudioContext().createAnalyser();
          analyserNode.fftSize = 32768; // FFT size for frequency resolution (~1.46 Hz resolution @ 48kHz)
          analyserNode.smoothingTimeConstant = 0.8; // Smooth frequency data
          
          // Connect: userNode -> gainNode -> analyserNode -> destination
          // Frequency analysis AFTER gain node, so it only measures audible audio
          userNode.connect(gainNode);
          gainNode.connect(analyserNode);
          analyserNode.connect(audioState.getAudioContext().destination);
          
          // Create and start frequency analyzer
          frequencyAnalyzer = createFrequencyAnalyzer({
            analyserNode,
            onFrequencyUpdate: (freq) => voiceState.updateLoopbackFrequency(freq),
            isMuted: () => selfMute.value,
            isDeafened: () => selfDeaf.value
          });
          frequencyAnalyzer.start();
          
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
        _streamManager.set(streamId, {
          sessionId: user.session,
          analyzer: frequencyAnalyzer, // Store analyzer instead of interval
          stopWatch: stopDeafWatch, // Vue watch cleanup function
          userNode: userNode
        });

        stream
          .on('data', (data) => {
            debugLog('[VOICE]', 'Audio data received, target:', data.target);
            
            if (data.target === 'normal') {
              ui.talking.value = 'on';
            } else if (data.target === 'shout') {
              ui.talking.value = 'shout';
            } else if (data.target === 'whisper') {
              ui.talking.value = 'whisper';
            } else if (data.target === 'loopback') {
              ui.talking.value = 'on';
              debugLog('[VOICE]', 'Loopback audio received!');
            }
            
            userNode.write(data.buffer);
          })
          .on('end', () => {
            debugLog('[VOICE]', 'Voice stream ended for user:', user.username);
            ui.talking.value = 'off';
            
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
    _streamManager.cleanup(identifier, (resources) => {
      // Vue-specific disposal
      if (resources.stopWatch) {
        try {
          resources.stopWatch();
          debugLog('[VOICE]', 'Deaf watcher stopped');
        } catch (err) {
          console.error('[VOICE] Error stopping watcher:', err);
        }
      }
    });
  }

  /**
   * Request mute for user
   * @param {object} user - User UI object (optional, defaults to thisUser)
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  function requestMute(user, onAudioLocked) {
    // If no user specified or user matches thisUser, toggle selfMute
    // This allows muting even before connection (thisUser === null)
    if (user === undefined || user === thisUser.value) {
      selfMute.value = true;
    }
  }

  /**
   * Request deaf for user
   * @param {object} user - User UI object (optional, defaults to thisUser)
   * @param {boolean} isLoopbackMode - Whether in loopback mode
   */
  function requestDeaf(user, isLoopbackMode = false) {
    // If no user specified or user matches thisUser, toggle selfDeaf
    // This allows deafening even before connection (thisUser === null)
    if (user === undefined || user === thisUser.value) {
      // In loopback mode, allow deaf without mute
      // In normal mode, deaf automatically enables mute
      if (!isLoopbackMode) {
        selfMute.value = true;
      }
      
      selfDeaf.value = true;
    }
  }

  /**
   * Request unmute for user
   * @param {object} user - User UI object (optional, defaults to thisUser)
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  function requestUnmute(user, onAudioLocked) {
    // If no user specified or user matches thisUser, toggle selfMute
    // This allows unmuting even before connection (thisUser === null)
    if (user === undefined || user === thisUser.value) {
      selfMute.value = false;
      selfDeaf.value = false;
    }
  }

  /**
   * Request undeaf for user
   * @param {object} user - User UI object (optional, defaults to thisUser)
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  function requestUndeaf(user, onAudioLocked) {
    // If no user specified or user matches thisUser, toggle selfDeaf
    // This allows undeafening even before connection (thisUser === null)
    if (user === undefined || user === thisUser.value) {
      selfDeaf.value = false;
    }
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
    setSettings,
  };
}
