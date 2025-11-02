import ko from "knockout";
import BufferQueueNode from "../audio/buffer-queue-node";

const DEBUG_VOICE_LOGGING = false; // Set to true to see frequency analysis logs in console

function debugLog(tag, ...args) {
  if (DEBUG_VOICE_LOGGING) {
    console.log(tag, ...args);
  }
}

function compareUsers(u1, u2) {
  if (u1.name() === u2.name()) {
    return 0;
  }
  return u1.name() < u2.name() ? -1 : 1;
}

/**
 * UserState - manages user-related state and operations
 * 
 * Responsibilities:
 * - Current user (thisUser) tracking
 * - Self mute/deaf state
 * - User registration and event handling
 * - Voice stream playback for users
 */
export default class UserState {
  constructor(audioState, voiceState) {
    this.audioState = audioState;
    this.voiceState = voiceState;
    
    // Current user
    this.thisUser = ko.observable();
    
    // Self mute/deaf state
    this.selfMute = ko.observable();
    this.selfDeaf = ko.observable();
    
    // CLEANUP-TRACKING: Track active voice stream resources for proper cleanup
    // Prevents memory leaks from intervals and subscriptions
    // Key can be either streamId (unique per stream) or sessionId (user session)
    // streamId format: 'sessionId_timestamp_random' for uniqueness
    this._activeVoiceStreams = new Map();
  }

  /**
   * Register a new user and set up UI bindings
   * @param {object} user - User model from mumble-client
   * @param {Function} openContextMenuFn - Function to open context menu
   * @param {Function} getUserContextMenu - Function to get user context menu
   */
  registerUser(user, openContextMenuFn, getUserContextMenu) {
    // Skip if UI already initialized
    if (user.__ui) {
      return;
    }
    
    const simpleProperties = {
      uniqueId: "uid",
      username: "name",
      mute: "mute",
      deaf: "deaf",
      suppress: "suppress",
      selfMute: "selfMute",
      selfDeaf: "selfDeaf",
    };
    
    let ui = (user.__ui = {
      model: user,
      talking: ko.observable("off"),
      channel: ko.observable(),
    });
    
    ui.openContextMenu = (_, event) =>
      openContextMenuFn(event, getUserContextMenu(), ui);

    ui.toggleMute = () => {
      if (ui.selfMute()) {
        this.requestUnmute(ui);
      } else {
        this.requestMute(ui);
      }
    };
    
    ui.toggleDeaf = () => {
      if (ui.selfDeaf()) {
        this.requestUndeaf(ui);
      } else {
        this.requestDeaf(ui);
      }
    };
    
    // Set up observables for simple properties
    for (const [key, value] of Object.entries(simpleProperties)) {
      ui[value] = ko.observable(user[key]);
    }
    
    ui.state = ko.pureComputed(function() {
      let flags = [];
      if (this.uid()) {
        flags.push("Authenticated");
      }
      if (this.mute()) {
        flags.push("Muted (server)");
      }
      if (this.deaf()) {
        flags.push("Deafened (server)");
      }
      if (this.selfMute()) {
        flags.push("Muted (self)");
      }
      if (this.selfDeaf()) {
        flags.push("Deafened (self)");
      }
      return flags.join(", ");
    }, ui);
    
    if (user.channel) {
      ui.channel(user.channel.__ui);
      ui.channel().users.push(ui);
      ui.channel().users.sort(compareUsers);
    }

    // Set up event handlers
    user
      .on("update", (actor, properties) => {
        for (const [key, value] of Object.entries(simpleProperties)) {
          if (properties[key] !== undefined) {
            ui[value](properties[key]);
          }
        }
        if (properties.channel !== undefined) {
          if (ui.channel()) {
            ui.channel().users.remove(ui);
          }
          ui.channel(properties.channel.__ui);
          ui.channel().users.push(ui);
          ui.channel().users.sort(compareUsers);
        }
      })
      .on("remove", () => {
        if (ui.channel()) {
          ui.channel().users.remove(ui);
        }
      })
      .on("voice", (stream) => {
        debugLog('[VOICE]', 'Voice stream received for user:', user.username);
        
        // CLEANUP-SAFETY: Generate unique stream ID to handle multiple streams per user
        // Use timestamp + random to ensure uniqueness even if user.session is undefined
        const streamId = `${user.session || 'unknown'}_${Date.now()}_${Math.random()}`;
        
        // Clear any previous voice stream resources for this user (using session ID)
        // This stops old intervals before starting new ones
        this._cleanupVoiceStream(user.session);
        
        // Create audio node for playing back received voice
        let userNode = new BufferQueueNode({
          audioContext: this.audioState.audioContext,
        });
        
        // Create a GainNode to control volume (for deafen functionality)
        let gainNode = this.audioState.audioContext.createGain();
        
        // Set initial gain based on current deafen state
        gainNode.gain.value = this.selfDeaf() ? 0 : 1;
        debugLog('[VOICE]', 'Initial gain set to:', gainNode.gain.value);
        
        // LOOPBACK-FREQUENCY-ANALYSIS: Create AnalyserNode for frequency detection in loopback mode
        let analyserNode = null;
        let frequencyAnalysisInterval = null;
        
        if (this.voiceState.isLoopbackMode()) {
          analyserNode = this.audioState.audioContext.createAnalyser();
          analyserNode.fftSize = 32768; // FFT size for frequency resolution (~1.46 Hz resolution @ 48kHz)
          analyserNode.smoothingTimeConstant = 0.8; // Smooth frequency data
          
          // Connect: userNode -> gainNode -> analyserNode -> destination
          // Frequency analysis AFTER gain node, so it only measures audible audio
          userNode.connect(gainNode);
          gainNode.connect(analyserNode);
          analyserNode.connect(this.audioState.audioContext.destination);
          
          // Start frequency analysis loop (runs continuously, checks selfDeaf internally)
          const bufferLength = analyserNode.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          let noAudioCount = 0;
          const NO_AUDIO_THRESHOLD = 3; // Hide after 3 consecutive checks without audio (300ms)
          
          frequencyAnalysisInterval = setInterval(() => {
            // Skip analysis if muted or deafened
            if (this.selfMute() || this.selfDeaf()) {
              if (this.voiceState.loopbackDominantFrequency() > 0) {
                this.voiceState.updateLoopbackFrequency(0);
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
            const sampleRate = this.audioState.audioContext.sampleRate;
            const dominantFrequency = (maxIndex * sampleRate) / analyserNode.fftSize;
            
            // Update voice state with detected frequency (only if significant amplitude)
            // Threshold (50) to ensure display disappears quickly when audio stops
            if (maxAmplitude > 50) {
              this.voiceState.updateLoopbackFrequency(dominantFrequency);
              noAudioCount = 0; // Reset counter when audio detected
              debugLog('[LOOPBACK-FREQ]', 'Dominant frequency:', dominantFrequency.toFixed(1), 'Hz, amplitude:', maxAmplitude);
            } else {
              // No significant audio - increment counter
              noAudioCount++;
              
              // Only clear display after consecutive checks without audio (and only if display is visible)
              if (noAudioCount >= NO_AUDIO_THRESHOLD && this.voiceState.loopbackDominantFrequency() > 0) {
                this.voiceState.updateLoopbackFrequency(0);
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
          gainNode.connect(this.audioState.audioContext.destination);
        }
        
        // Subscribe to selfDeaf changes to update gain
        let deafSubscription = this.selfDeaf.subscribe((isDeaf) => {
          gainNode.gain.value = isDeaf ? 0 : 1;
          debugLog('[VOICE]', 'Gain updated to:', gainNode.gain.value);
        });
        
        // CLEANUP-TRACKING: Store resources for proper cleanup
        // Use streamId as key for this specific stream, store sessionId for fallback cleanup
        this._activeVoiceStreams.set(streamId, {
          sessionId: user.session,
          interval: frequencyAnalysisInterval,
          subscription: deafSubscription,
          userNode: userNode
        });

        stream
          .on("data", (data) => {
            debugLog('[VOICE]', 'Audio data received, target:', data.target);
            
            if (data.target === "normal") {
              ui.talking("on");
            } else if (data.target === "shout") {
              ui.talking("shout");
            } else if (data.target === "whisper") {
              ui.talking("whisper");
            } else if (data.target === "loopback") {
              ui.talking("on");
              debugLog('[VOICE]', 'Loopback audio received!');
            }
            
            userNode.write(data.buffer);
          })
          .on("end", () => {
            debugLog('[VOICE]', 'Voice stream ended for user:', user.username);
            ui.talking("off");
            
            // CLEANUP: Use streamId to clean up this specific stream
            this._cleanupVoiceStream(streamId);
          });
      });
  }
  
  /**
   * Clean up voice stream resources (intervals, subscriptions, audio nodes)
   * RACE-SAFE: Can be called multiple times safely (idempotent)
   * @param {string|number} identifier - Either streamId (specific stream) or sessionId (all streams for user)
   * @private
   */
  _cleanupVoiceStream(identifier) {
    // Try direct lookup first (streamId)
    const resources = this._activeVoiceStreams.get(identifier);
    if (resources) {
      this._disposeStreamResources(resources, identifier);
      return;
    }
    
    // If not found, cleanup all streams for this session (sessionId)
    for (const [streamId, res] of this._activeVoiceStreams.entries()) {
      if (res.sessionId === identifier) {
        this._disposeStreamResources(res, streamId);
      }
    }
  }

  /**
   * Dispose individual stream resources
   * @param {object} resources - Stream resources object
   * @param {string} identifier - Stream or session identifier
   * @private
   */
  _disposeStreamResources(resources, identifier) {
    // Clear frequency analysis interval
    if (resources.interval) {
      clearInterval(resources.interval);
      debugLog('[LOOPBACK-FREQ]', 'Frequency analysis stopped');
    }
    
    // Dispose subscription
    if (resources.subscription) {
      try {
        resources.subscription.dispose();
        debugLog('[VOICE]', 'Deaf subscription disposed');
      } catch (err) {
        console.error('[VOICE] Error disposing subscription:', err);
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
    this._activeVoiceStreams.delete(identifier);
  }

  /**
   * Request mute for user
   * @param {object} user - User UI object
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  requestMute(user, onAudioLocked) {
    if (user !== this.thisUser()) return;
    this.selfMute(true);
  }

  /**
   * Request deaf for user
   * @param {object} user - User UI object
   * @param {boolean} isLoopbackMode - Whether in loopback mode
   */
  requestDeaf(user, isLoopbackMode = false) {
    if (user !== this.thisUser()) return;
    
    // In loopback mode, allow deaf without mute
    // In normal mode, deaf automatically enables mute
    if (!isLoopbackMode) {
      this.selfMute(true);
    }
    
    this.selfDeaf(true);
  }

  /**
   * Request unmute for user
   * @param {object} user - User UI object
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  requestUnmute(user, onAudioLocked) {
    if (user !== this.thisUser()) {
      return;
    }
    
    this.selfMute(false);
    this.selfDeaf(false);
  }

  /**
   * Request undeaf for user
   * @param {object} user - User UI object
   * @param {Function} onAudioLocked - Callback when audio is locked
   */
  requestUndeaf(user, onAudioLocked) {
    if (user !== this.thisUser()) return;
    this.selfDeaf(false);
  }

  /**
   * Reset user state
   */
  reset() {
    this.thisUser(null);
    this.selfMute(false);
    this.selfDeaf(false);
  }
}
