import { defineStore } from 'pinia';
import { ref, watch, markRaw, shallowRef } from 'vue';
import { useAudioStore } from './audioStore';
import { useVoiceStore } from './voiceStore';
import { useConnectionStore } from './connectionStore';
import BufferQueueNode from '../audio/buffer-queue-node';
import { debugLog } from '../composables/debug-utils';
import { createVoiceStreamManager } from '../utils/voice-stream-manager';
import { createFrequencyAnalyzer } from '../utils/frequency-analyzer';

// Jitter buffer mode configurations
const JITTER_BUFFER_MODES = {
  'low-latency': { factor: 3, minPackets: 2 },
  'balanced': { factor: 4, minPackets: 3 },
  'high-quality': { factor: 5, minPackets: 4 }
};

export const useUserStore = defineStore('user', () => {
  const audioStore = useAudioStore();
  const voiceStore = useVoiceStore();
  const connectionStore = useConnectionStore();
  
  // Current user
  const thisUser = ref(null);
  
  // Self mute/deaf state
  const selfMute = ref(false);
  const selfDeaf = ref(false);
  
  // CLEANUP-TRACKING: Voice stream resource manager
  const _streamManager = createVoiceStreamManager();

  // Settings injection - use shallowRef to track reference without double-wrapping reactive object
  const settings = shallowRef(null);
  let jitterBufferWatchStop = null;
  let jitterBufferModeWatchStop = null;
  
  // Cleanup tracking for thisUser watcher
  let userWatchCleanup = null;
  
  // Helper: Recalculate jitter buffer based on current mode and stats
  const recalculateJitterBuffer = () => {
    if (!settings.value?.jitterBufferSize) {
        return;
    }

    // Determine parameters based on mode
    const mode = settings.value.jitterBufferMode ? settings.value.jitterBufferMode.value : 'balanced';
    const config = JITTER_BUFFER_MODES[mode] || JITTER_BUFFER_MODES['balanced'];
    const { factor, minPackets } = config;

    // Check for active connection and stats
    if (thisUser.value?.model?._client?.dataStats) {
        const client = thisUser.value.model._client;
        const stats = client.dataStats;
        
        if (stats?.n > 0) {
            const latency = stats.mean;
            const deviation = Math.sqrt(stats.variance);
            
            const targetMs = latency + (factor * deviation);
            const targetPackets = Math.max(minPackets, Math.ceil(targetMs / 20));
            
            if (settings.value.jitterBufferSize.value !== targetPackets) {
               debugLog('[VOICE]', `Auto-adjusting jitter buffer (${mode}): ${latency.toFixed(1)}ms + ${factor}*${deviation.toFixed(1)}ms = ${targetMs.toFixed(1)}ms -> ${targetPackets} packets`);
               settings.value.jitterBufferSize.value = targetPackets;
            }
            return;
        } else {
            debugLog('[VOICE]', `Skipping jitter buffer calc: stats.n=${stats?.n}, stats.mean=${stats?.mean}`);
        }
    } else {
        debugLog('[VOICE]', `Skipping jitter buffer calc: No dataStats on client`);
    }
    
    if (settings.value.jitterBufferSize.value !== minPackets) {
        debugLog('[VOICE]', `Setting default jitter buffer for ${mode}: ${minPackets} packets`);
        settings.value.jitterBufferSize.value = minPackets;
    }
  };
  
  // Auto-adjust jitter buffer based on latency
  watch(thisUser, (newUser) => {
    // Clean up previous watcher resources
    if (userWatchCleanup) {
      userWatchCleanup();
      userWatchCleanup = null;
    }
    
    if (newUser?.model?._client) {
      const client = newUser.model._client;
      
      // Set up interval to check stats
      const interval = setInterval(recalculateJitterBuffer, 1000);
      
      debugLog('[VOICE]', 'Jitter buffer auto-adjust enabled for user', newUser.name);
      
      // Listen for dataPing to update stats-based calculation
      client.on('dataPing', recalculateJitterBuffer);
      
      // Initialize buffer immediately
      recalculateJitterBuffer();
      
      // Store cleanup function
      userWatchCleanup = () => {
        clearInterval(interval);
        client.off('dataPing', recalculateJitterBuffer);
      };
    } else {
        debugLog('[VOICE]', 'Jitter buffer auto-adjust disabled (no client)');
    }
  });

  function setSettings(s) {
    console.log('[userStore.setSettings] Called with:', s);
    settings.value = s;
    console.log('[userStore.setSettings] settings.value is now:', settings.value);
    
    // Clean up existing watchers
    if (jitterBufferWatchStop) {
      jitterBufferWatchStop();
      jitterBufferWatchStop = null;
    }
    if (jitterBufferModeWatchStop) {
      jitterBufferModeWatchStop();
      jitterBufferModeWatchStop = null;
    }

    if (settings.value) {
      // Watch buffer size changes to update AudioWorklets
      if (settings.value.jitterBufferSize) {
        jitterBufferWatchStop = watch(
          () => settings.value.jitterBufferSize.value,
          (newSize) => {
            debugLog('[VOICE]', 'Updating jitter buffer size to:', newSize);
            _streamManager.forEach((resources) => {
              if (resources.userNode && typeof resources.userNode.setJitterBufferSize === 'function') {
                resources.userNode.setJitterBufferSize(newSize);
              }
            });
          }
        );
      }

      // Watch mode changes to trigger recalculation immediately
      if (settings.value.jitterBufferMode) {
        jitterBufferModeWatchStop = watch(
          () => settings.value.jitterBufferMode.value,
          () => {
            recalculateJitterBuffer();
          }
        );
      }
    }
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
   * Handle user update events
   * @param {object} user - User model
   * @param {object} ui - User UI object
   * @param {object} actor - Actor who triggered update
   * @param {object} properties - Updated properties
   */
  const handleUserUpdate = (user, ui, actor, properties) => {
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
  };

  /**
   * Handle incoming voice stream for a user
   * @param {object} user - User model
   * @param {object} ui - User UI object
   * @param {object} stream - Voice stream
   */
  const handleVoiceStream = async (user, ui, stream) => {
    debugLog('[VOICE]', 'Voice stream received for user:', user.username, 'session:', user.session);
    
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    const streamId = `${user.session || 'unknown'}_${Date.now()}_${randomValue}`;
    
    _cleanupVoiceStream(user.session);
    
    let userNode = new BufferQueueNode({
      audioContext: audioStore.getAudioContext(),
    });
    
    try {
      debugLog('[VOICE]', 'Initializing BufferQueueNode...');
      await userNode.initialize();
      debugLog('[VOICE]', '✅ BufferQueueNode initialized successfully');
      
      if (settings.value?.jitterBufferSize) {
         userNode.setJitterBufferSize(settings.value.jitterBufferSize.value);
      }
    } catch (err) {
      console.error('[VOICE] ❌ Failed to initialize BufferQueueNode:', err);
      console.error('[VOICE] Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      return;
    }
    
    let gainNode = audioStore.getAudioContext().createGain();
    
    gainNode.gain.value = selfDeaf.value ? 0 : 1;
    debugLog('[VOICE]', 'Initial gain set to:', gainNode.gain.value);
    
    let analyserNode = null;
    let frequencyAnalyzer = null;
    
    if (voiceStore.isLoopbackMode) {
      analyserNode = audioStore.getAudioContext().createAnalyser();
      analyserNode.fftSize = 32768;
      analyserNode.smoothingTimeConstant = 0.8;
      
      userNode.connect(gainNode);
      gainNode.connect(analyserNode);
      analyserNode.connect(audioStore.getAudioContext().destination);
      
      frequencyAnalyzer = createFrequencyAnalyzer({
        analyserNode,
        onFrequencyUpdate: (freq) => voiceStore.updateLoopbackFrequency(freq),
        isMuted: () => selfMute.value,
        isDeafened: () => selfDeaf.value
      });
      frequencyAnalyzer.start();
      
      debugLog('[LOOPBACK-FREQ]', 'Frequency analysis started for loopback mode');
    } else {
      userNode.connect(gainNode);
      gainNode.connect(audioStore.getAudioContext().destination);
    }
    
    const stopDeafWatch = watch(selfDeaf, (isDeaf) => {
      gainNode.gain.value = isDeaf ? 0 : 1;
      debugLog('[VOICE]', 'Gain updated to:', gainNode.gain.value);
    });
    
    _streamManager.set(streamId, {
      sessionId: user.session,
      analyzer: frequencyAnalyzer,
      stopWatch: stopDeafWatch,
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
        
        _cleanupVoiceStream(streamId);
      });
  };

  /**
   * Register a user with minimal UI wrapper
   * @param {object} user - User model from mumble-client
   */
  function registerUser(user) {
    if (user.__ui) {
      delete user.__ui;
    }

    const syncServerState = (serverState) => {
      debugLog('[SERVER-STATE-SYNC] Received server state:', serverState);
      debugLog('[SERVER-STATE-SYNC] Current UI state:', { selfMute: selfMute.value, selfDeaf: selfDeaf.value });
      
      if (serverState.selfMute !== undefined) {
        selfMute.value = serverState.selfMute;
      }
      if (serverState.selfDeaf !== undefined) {
        selfDeaf.value = serverState.selfDeaf;
      }
      
      debugLog('[SERVER-STATE-SYNC] UI synchronized to:', { selfMute: selfMute.value, selfDeaf: selfDeaf.value });
    };
    
    if (user.__syncServerState) {
      user.off('server-state-sync', user.__syncServerState);
    }
    
    user.__syncServerState = syncServerState;
    user.on('server-state-sync', syncServerState);
    
    let ui = (user.__ui = markRaw({
      model: user,
      name: ref(user.username),
      channel: ref(user.channel?.__ui),
      selfMute: ref(user.selfMute),
      selfDeaf: ref(user.selfDeaf),
      talking: ref('off'),
    }));
    
    user.on('update', (actor, properties) => handleUserUpdate(user, ui, actor, properties));

    user.on('voice', (stream) => handleVoiceStream(user, ui, stream));
  }
  
  function requestMute(user, onAudioLocked) {
    if (user === undefined || user === thisUser.value) {
      selfMute.value = true;
      if (thisUser.value) {
        connectionStore.getClient()?.setSelfMute(true);
      }
    }
  }

  function requestDeaf(user, isLoopbackMode = false) {
    if (user === undefined || user === thisUser.value) {
      if (!isLoopbackMode) {
        selfMute.value = true;
      }
      selfDeaf.value = true;
      if (thisUser.value) {
        connectionStore.getClient()?.setSelfDeaf(true);
        if (!isLoopbackMode) {
          connectionStore.getClient()?.setSelfMute(true);
        }
      }
    }
  }

  function requestUnmute(user, onAudioLocked) {
    if (audioStore.audioLockActive) {
      audioStore.notifyAudioLock();
      return;
    }
    
    if (user === undefined || user === thisUser.value) {
      selfMute.value = false;
      selfDeaf.value = false;
      if (thisUser.value) {
        connectionStore.getClient()?.setSelfMute(false);
        connectionStore.getClient()?.setSelfDeaf(false);
      }
    }
  }

  function requestUndeaf(user, onAudioLocked) {
    if (audioStore.audioLockActive) {
      audioStore.notifyAudioLock();
      return;
    }

    if (user === undefined || user === thisUser.value) {
      selfDeaf.value = false;
      if (thisUser.value) {
        connectionStore.getClient()?.setSelfDeaf(false);
      }
    }
  }

  function reset() {
    thisUser.value = null;
    selfMute.value = false;
    selfDeaf.value = false;
  }

  // Set up cross-store reactive subscription: selfMute → voice.setMute
  // Previously handled by AppState._setupSubscriptions()
  watch(selfMute, (mute) => {
    voiceStore.setMute(mute);
  });

  return {
    // State
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
    settings
  };
});
