/**
 * Audio Context Manager for Mumbling Mole
 * 
 * Handles AudioContext creation and management with proper browser autoplay policy compliance.
 * Provides unified audio context management across the application with automatic suspension/resumption.
 */

const AUDIO_CONFIG = {
  SAMPLE_RATE: 48000,
  LATENCY_HINT: 'interactive',
  MAX_RESUME_ATTEMPTS: 5,
  RESUME_RETRY_DELAY: 100
};

class AudioContextManager {
  audioContext = null;
  isInitialized = false;
  userInteractionDetected = false;
  resumeAttempts = 0;
  onReadyCallbacks = [];
  onSuspendCallbacks = [];
  onResumeCallbacks = [];

  constructor() {
    this.setupUserInteractionDetection();
  }

  // AUTOPLAY-POLICY: Detect user interactions to enable audio playback
  // Modern browsers require user interaction before allowing AudioContext to run
  setupUserInteractionDetection() {
    // USER-EVENTS: Listen for any user interaction that indicates intent to use audio
    const userInteractionEvents = ['click', 'touchstart', 'keydown', 'mousedown'];
    
    const handleUserInteraction = () => {
      if (!this.userInteractionDetected) {
        this.userInteractionDetected = true;
        
        // AUTO-RESUME: Try to resume suspended AudioContext after first user interaction
        // This handles browsers that auto-suspend AudioContext until user interacts
        if (this.audioContext?.state === 'suspended') {
          this.resumeAudioContext();
        }
        
        // CLEANUP: Remove listeners after first interaction (no longer needed)
        for (const event of userInteractionEvents) {
          document.removeEventListener(event, handleUserInteraction, { passive: true });
        }
      }
    };

    // PASSIVE-LISTENERS: Use passive listeners for better scroll performance
    for (const event of userInteractionEvents) {
      document.addEventListener(event, handleUserInteraction, { passive: true });
    }
  }

  /**
   * SINGLETON-PATTERN: Get or create the global AudioContext with autoplay policy handling
   * Always returns the same AudioContext instance throughout app lifecycle
   */
  async getAudioContext(options = {}) {
    if (!this.audioContext) {
      await this.createAudioContext(options);
    }

    // RECOVERY: If cached context was closed elsewhere, recreate it
    // This handles edge cases where AudioContext is closed unexpectedly
    if (this.audioContext?.state === 'closed') {
      console.warn('AudioContext was closed; recreating...');
      await this.createAudioContext(options);
    }

    // AUTO-RESUME: Always try to resume if suspended and user has interacted
    // Ensures audio is ready to play when needed
    if (this.audioContext.state === 'suspended' && this.userInteractionDetected) {
      await this.resumeAudioContext();
    }

    return this.audioContext;
  }

  /**
   * Get or create AudioContext without attempting resume (for initialization)
   * INIT-ONLY: Use this during app startup to avoid blocking on autoplay policy
   * The context will auto-resume on first user interaction via event listeners
   */
  async getAudioContextWithoutResume(options = {}) {
    if (!this.audioContext) {
      await this.createAudioContext(options);
    }

    // RECOVERY: If cached context was closed elsewhere, recreate it
    if (this.audioContext?.state === 'closed') {
      console.warn('AudioContext was closed; recreating...');
      await this.createAudioContext(options);
    }

    // NO AUTO-RESUME: Return context as-is (may be suspended)
    return this.audioContext;
  }

  async createAudioContext(options = {}) {
    try {
      // CONFIG-MERGE: Combine default config with user-provided options
      const config = {
        latencyHint: options.latencyHint || AUDIO_CONFIG.LATENCY_HINT,
        ...options
      };

      // SAMPLE-RATE: Remove undefined sampleRate to let browser choose best rate
      // Unless explicitly specified by caller (e.g., 48kHz for Mumble)
      if (config.sampleRate === undefined || config.sampleRate === null) {
        delete config.sampleRate;
      }

      // BROWSER-COMPAT: Create AudioContext with cross-browser compatibility
      // Handles browser autoplay policies and initialization
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext is not supported in this browser');
      }

      this.audioContext = new AudioContextClass(config);
      this.isInitialized = true;

      // EVENT-LISTENERS: Set up state change monitoring
      this.setupAudioContextEventListeners();

      // CALLBACK-NOTIFICATION: Notify all registered ready callbacks
      // These are used by other components waiting for AudioContext initialization
      for (const callback of this.onReadyCallbacks) {
        try {
          callback(this.audioContext);
        } catch (error) {
          console.error('Error in onReady callback:', error);
        }
      }

      // EAGER-RESUME: Try to resume immediately if user has already interacted
      // Avoids delay when audio is needed right after context creation
      if (this.audioContext.state === 'suspended' && this.userInteractionDetected) {
        await this.resumeAudioContext();
      }

      return this.audioContext;
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  // STATE-MONITORING: Set up listeners for AudioContext state changes
  // Critical for debugging audio issues and tracking suspend/resume cycles
  setupAudioContextEventListeners() {
    if (!this.audioContext) return;

    // BROWSER-COMPAT: Not all browsers support addEventListener on AudioContext
    if (typeof this.audioContext.addEventListener === 'function') {
      this.audioContext.addEventListener('statechange', () => {
        // SUSPEND-CALLBACKS: Notify listeners when AudioContext is suspended
        // This allows components to pause audio-related operations
        if (this.audioContext.state === 'suspended') {
          for (const callback of this.onSuspendCallbacks) {
            try {
              callback(this.audioContext);
            } catch (error) {
              console.error('Error in onSuspend callback:', error);
            }
          }
        } 
        // RESUME-CALLBACKS: Notify listeners when AudioContext is running
        // This allows components to resume audio-related operations
        else if (this.audioContext.state === 'running') {
          for (const callback of this.onResumeCallbacks) {
            try {
              callback(this.audioContext);
            } catch (error) {
              console.error('Error in onResume callback:', error);
            }
          }
        } 
        // CLOSED-STATE: Handle AudioContext closure
        // Clear cached reference so future calls create fresh instance
        else if (this.audioContext.state === 'closed') {
          console.warn('AudioContext transitioned to closed; clearing cached reference');
          this.audioContext = null;
          this.isInitialized = false;
          this.resumeAttempts = 0;
        }
      });
    }
  }

  // RESUME-LOGIC: Attempt to resume suspended AudioContext with retry logic
  // Uses exponential backoff to handle transient browser restrictions
  async resumeAudioContext() {
    if (this.audioContext?.state !== 'suspended') {
      return this.audioContext;
    }

    try {
      await this.audioContext.resume();
      this.resumeAttempts = 0; // RESET-COUNTER: Reset on success for future resumes
      return this.audioContext;
    } catch (error) {
      this.resumeAttempts++;
      console.warn(`Failed to resume AudioContext (attempt ${this.resumeAttempts}):`, error);

      // RETRY-BACKOFF: Retry with exponential backoff if under limit
      // Handles browsers that need time before allowing resume
      if (this.resumeAttempts < AUDIO_CONFIG.MAX_RESUME_ATTEMPTS) {
        const delay = AUDIO_CONFIG.RESUME_RETRY_DELAY * Math.pow(2, this.resumeAttempts - 1);
        
        return new Promise((resolve, reject) => {
          setTimeout(async () => {
            try {
              const result = await this.resumeAudioContext();
              resolve(result);
            } catch (retryError) {
              reject(retryError);
            }
          }, delay);
        });
      } else {
        console.error('Max resume attempts reached');
        throw error;
      }
    }
  }

  /**
   * Suspend the audio context to save resources
   */
  async suspendAudioContext() {
    if (!this.audioContext || this.audioContext.state === 'suspended') {
      return;
    }

    try {
      await this.audioContext.suspend();
    } catch (error) {
      console.error('Failed to suspend AudioContext:', error);
      throw error;
    }
  }

  /**
   * Close the audio context and clean up resources
   */
  async closeAudioContext() {
    if (!this.audioContext) {
      return;
    }

    try {
      await this.audioContext.close();
      this.audioContext = null;
      this.isInitialized = false;
      this.resumeAttempts = 0;
    } catch (error) {
      console.error('Failed to close AudioContext:', error);
      throw error;
    }
  }

  /**
   * Check if AudioContext is ready for use (created and running)
   */
  isReady() {
    return this.audioContext?.state === 'running';
  }

  /**
   * Check if user interaction has been detected (required for autoplay)
   */
  canPlayAudio() {
    return this.userInteractionDetected || this.audioContext?.state === 'running';
  }

  /**
   * Register callbacks for AudioContext lifecycle events
   */
  onReady(callback) {
    this.onReadyCallbacks.push(callback);
    // If already ready, call immediately
    if (this.isReady()) {
      try {
        callback(this.audioContext);
      } catch (error) {
        console.error('Error in immediate onReady callback:', error);
      }
    }
  }

  onSuspend(callback) {
    this.onSuspendCallbacks.push(callback);
  }

  onResume(callback) {
    this.onResumeCallbacks.push(callback);
  }

  /**
   * Get AudioContext stats for debugging
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      state: this.audioContext?.state || 'not-created',
      sampleRate: this.audioContext?.sampleRate || null,
      currentTime: this.audioContext?.currentTime || null,
      baseLatency: this.audioContext?.baseLatency || null,
      outputLatency: this.audioContext?.outputLatency || null,
      userInteractionDetected: this.userInteractionDetected,
      resumeAttempts: this.resumeAttempts,
      canPlayAudio: this.canPlayAudio()
    };
  }

  /**
   * Force user interaction detection (for testing or special cases)
   */
  forceUserInteraction() {
    this.userInteractionDetected = true;
  }
}

// Create global instance
const audioContextManager = new AudioContextManager();

// Export for use in other modules
export default audioContextManager;

// Also export convenience functions
export async function getAudioContext(options) {
  return audioContextManager.getAudioContext(options);
}

export function isAudioReady() {
  return audioContextManager.isReady();
}

export function canPlayAudio() {
  return audioContextManager.canPlayAudio();
}

export async function ensureAudioContext(options = {}) {
  const context = await audioContextManager.getAudioContext(options);
  if (context.state === 'suspended') {
    await audioContextManager.resumeAudioContext();
  }
  return context;
}

/**
 * Get or create AudioContext without attempting resume
 * Use this during initialization to avoid blocking on autoplay policy
 * The context will auto-resume on first user interaction
 */
export async function getAudioContextWithoutResume(options = {}) {
  return audioContextManager.getAudioContextWithoutResume(options);
}

export function getAudioStats() {
  return audioContextManager.getStats();
}

// Global access for debugging and other modules
globalThis.audioContextManager = audioContextManager;