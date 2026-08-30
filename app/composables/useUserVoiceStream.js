import { watch, onWatcherCleanup } from 'vue';
import BufferQueueNode from '../audio/buffer-queue-node';
import { debugLog } from '../utils/debug-utils';
import { createVoiceStreamManager } from '../utils/voice-stream-manager';
import { createFrequencyAnalyzer } from '../utils/frequency-analyzer';

// Jitter buffer mode configurations
export const JITTER_BUFFER_MODES = {
  'low-latency': { factor: 3, minPackets: 2 },
  'balanced': { factor: 4, minPackets: 3 },
  'high-quality': { factor: 5, minPackets: 4 }
};

/**
 * Composable that manages voice streams and jitter buffers for the local user connection.
 * Extracted from userStore.js to separate WebAudio domain logic from State logic.
 */
export function useUserVoiceStream({ audioStore, voiceStore, settingsStore, selfMute, selfDeaf, thisUser }) {
  // CLEANUP-TRACKING: Voice stream resource manager
  const streamManager = createVoiceStreamManager();

  // Helper: Recalculate jitter buffer based on current mode and stats
  const recalculateJitterBuffer = () => {
    // Determine parameters based on mode
    const mode = settingsStore.jitterBufferMode || 'balanced';
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
            
            const current = settingsStore.jitterBufferSize;
            // Guard against corrupted localStorage value (NaN propagates as no-update)
            if (!Number.isFinite(current)) {
               debugLog('[VOICE]', `Invalid jitter buffer size (${current}), resetting to ${targetPackets}`);
               settingsStore.jitterBufferSize = targetPackets;
               return;
            }
            // Hysteresis: grow immediately (quality), but only shrink if delta > 1
            // Prevents oscillation when targetPackets sits on a Math.ceil boundary
            const shouldUpdate = targetPackets > current || (current - targetPackets) > 1;
            if (shouldUpdate) {
               debugLog('[VOICE]', `Auto-adjusting jitter buffer (${mode}): ${latency.toFixed(1)}ms + ${factor}*${deviation.toFixed(1)}ms = ${targetMs.toFixed(1)}ms -> ${targetPackets} packets`);
               settingsStore.jitterBufferSize = targetPackets;
            }
            return;
        } else {
            debugLog('[VOICE]', `Skipping jitter buffer calc: stats.n=${stats?.n}, stats.mean=${stats?.mean}`);
        }
    } else {
        debugLog('[VOICE]', `Skipping jitter buffer calc: No dataStats on client`);
    }
    
    if (settingsStore.jitterBufferSize !== minPackets) {
        debugLog('[VOICE]', `Setting default jitter buffer for ${mode}: ${minPackets} packets`);
        settingsStore.jitterBufferSize = minPackets;
    }
  };

  // Auto-adjust jitter buffer based on latency
  watch(thisUser, (newUser) => {
    if (!newUser?.model?._client) {
      debugLog('[VOICE]', 'Jitter buffer auto-adjust disabled (no client)');
      return;
    }
    
    const client = newUser.model._client;
    
    // Set up interval to check stats
    const interval = setInterval(recalculateJitterBuffer, 1000);
    
    debugLog('[VOICE]', 'Jitter buffer auto-adjust enabled for user', newUser.name);
    
    // Listen for dataPing to update stats-based calculation
    client.on('dataPing', recalculateJitterBuffer);
    
    // Initialize buffer immediately
    recalculateJitterBuffer();
    
    // Cleanup runs automatically when watch re-runs or component unmounts
    onWatcherCleanup(() => {
      clearInterval(interval);
      client.off('dataPing', recalculateJitterBuffer);
    });
  });

  // Watch jitter buffer size changes to update AudioWorklets
  watch(
    () => settingsStore.jitterBufferSize,
    (newSize) => {
      debugLog('[VOICE]', 'Updating jitter buffer size to:', newSize);
      streamManager.forEach((resources) => {
        if (resources.userNode && typeof resources.userNode.setJitterBufferSize === 'function') {
          resources.userNode.setJitterBufferSize(newSize);
        }
      });
    }
  );

  // Watch mode changes to trigger recalculation immediately
  watch(
    () => settingsStore.jitterBufferMode,
    () => {
      recalculateJitterBuffer();
    }
  );

  /**
   * Clean up voice stream resources (intervals, watchers, audio nodes)
   * RACE-SAFE: Can be called multiple times safely (idempotent)
   * @param {string|number} identifier - Either streamId (specific stream) or sessionId (all streams for user)
   * @private
   */
  function cleanupVoiceStream(identifier) {
    streamManager.cleanup(identifier, (resources) => {
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
   * Handle incoming voice stream for a user
   * @param {object} user - User model
   * @param {object} ui - User UI object
   * @param {object} stream - Voice stream
   */
  const handleVoiceStream = async (user, ui, stream, isCurrent = () => true) => {
    if (!isCurrent()) return;
    debugLog('[VOICE]', 'Voice stream received for user:', user.username, 'session:', user.session);
    
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    const streamId = `${user.session || 'unknown'}_${Date.now()}_${randomValue}`;
    
    cleanupVoiceStream(user.session);
    
    let userNode = new BufferQueueNode({
      audioContext: audioStore.getAudioContext(),
    });
    
    try {
      debugLog('[VOICE]', 'Initializing BufferQueueNode...');
      await userNode.initialize();
      debugLog('[VOICE]', '✅ BufferQueueNode initialized successfully');

      if (!isCurrent()) {
        userNode.end();
        return;
      }
      
      if (settingsStore.jitterBufferSize) {
         userNode.setJitterBufferSize(settingsStore.jitterBufferSize);
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

    if (!isCurrent()) {
      userNode.end();
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
    
    streamManager.set(streamId, {
      sessionId: user.session,
      analyzer: frequencyAnalyzer,
      stopWatch: stopDeafWatch,
      userNode: userNode
    });

    stream
      .on('data', (data) => {
        if (!isCurrent()) return;
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
        if (!isCurrent()) {
          cleanupVoiceStream(streamId);
          return;
        }
        debugLog('[VOICE]', 'Voice stream ended for user:', user.username);
        ui.talking.value = 'off';
        
        cleanupVoiceStream(streamId);
      });
  };

  return {
    handleVoiceStream,
    cleanupVoiceStream
  };
}
