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
  constructor() {
    this.audioContext = null;
    this.isInitialized = false;
    this.userInteractionDetected = false;
    this.resumeAttempts = 0;
    this.onReadyCallbacks = [];
    this.onSuspendCallbacks = [];
    this.onResumeCallbacks = [];
    
    this.setupUserInteractionDetection();
    console.log('AudioContextManager initialized');
  }

  setupUserInteractionDetection() {
    // Listen for user interactions to enable audio
    const userInteractionEvents = ['click', 'touchstart', 'keydown', 'mousedown'];
    
    const handleUserInteraction = () => {
      if (!this.userInteractionDetected) {
        this.userInteractionDetected = true;
        console.log('User interaction detected, audio context can be resumed');
        
        // Try to resume audio context if it exists and is suspended
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.resumeAudioContext();
        }
        
        // Remove listeners after first interaction
        userInteractionEvents.forEach(event => {
          document.removeEventListener(event, handleUserInteraction, { passive: true });
        });
      }
    };

    // Add passive listeners to detect user interaction
    userInteractionEvents.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { passive: true });
    });
  }

  /**
   * Get or create the global AudioContext with proper autoplay policy handling
   */
  async getAudioContext(options = {}) {
    if (!this.audioContext) {
      await this.createAudioContext(options);
    }

    // If the cached context was closed elsewhere, recreate it
    if (this.audioContext && this.audioContext.state === 'closed') {
      console.warn('AudioContext was closed; recreating...');
      await this.createAudioContext(options);
    }

    // Always try to resume if suspended (and user has interacted)
    if (this.audioContext.state === 'suspended' && this.userInteractionDetected) {
      await this.resumeAudioContext();
    }

    return this.audioContext;
  }

  async createAudioContext(options = {}) {
    try {
      const config = {
        latencyHint: options.latencyHint || AUDIO_CONFIG.LATENCY_HINT,
        ...options
      };

      if (config.sampleRate === undefined || config.sampleRate === null) {
        delete config.sampleRate;
      }

      console.log('Creating AudioContext with config:', config);

      // Create AudioContext with cross-browser compatibility
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext is not supported in this browser');
      }

      this.audioContext = new AudioContextClass(config);
      this.isInitialized = true;

      // Set up event listeners for state changes
      this.setupAudioContextEventListeners();

      console.log('AudioContext created:', {
        state: this.audioContext.state,
        sampleRate: this.audioContext.sampleRate,
        baseLatency: this.audioContext.baseLatency,
        outputLatency: this.audioContext.outputLatency
      });

      // Notify ready callbacks
      this.onReadyCallbacks.forEach(callback => {
        try {
          callback(this.audioContext);
        } catch (error) {
          console.error('Error in onReady callback:', error);
        }
      });

      // Try to resume immediately if user has already interacted
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

  setupAudioContextEventListeners() {
    if (!this.audioContext) return;

    // Listen for state changes (not all browsers support this)
    if (typeof this.audioContext.addEventListener === 'function') {
      this.audioContext.addEventListener('statechange', () => {
        console.log('AudioContext state changed to:', this.audioContext.state);
        
        if (this.audioContext.state === 'suspended') {
          this.onSuspendCallbacks.forEach(callback => {
            try {
              callback(this.audioContext);
            } catch (error) {
              console.error('Error in onSuspend callback:', error);
            }
          });
        } else if (this.audioContext.state === 'running') {
          this.onResumeCallbacks.forEach(callback => {
            try {
              callback(this.audioContext);
            } catch (error) {
              console.error('Error in onResume callback:', error);
            }
          });
        } else if (this.audioContext.state === 'closed') {
          // Clear reference so future calls will recreate a fresh instance
          console.warn('AudioContext transitioned to closed; clearing cached reference');
          this.audioContext = null;
          this.isInitialized = false;
          this.resumeAttempts = 0;
        }
      });
    }
  }

  async resumeAudioContext() {
    if (!this.audioContext || this.audioContext.state !== 'suspended') {
      return this.audioContext;
    }

    console.log('Attempting to resume AudioContext...');

    try {
      await this.audioContext.resume();
      this.resumeAttempts = 0; // Reset on success
      console.log('AudioContext resumed successfully');
      return this.audioContext;
    } catch (error) {
      this.resumeAttempts++;
      console.warn(`Failed to resume AudioContext (attempt ${this.resumeAttempts}):`, error);

      // Retry with exponential backoff if under limit
      if (this.resumeAttempts < AUDIO_CONFIG.MAX_RESUME_ATTEMPTS) {
        const delay = AUDIO_CONFIG.RESUME_RETRY_DELAY * Math.pow(2, this.resumeAttempts - 1);
        console.log(`Retrying resume in ${delay}ms...`);
        
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
      console.log('AudioContext suspended');
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
      console.log('AudioContext closed');
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
    return this.audioContext && this.audioContext.state === 'running';
  }

  /**
   * Check if user interaction has been detected (required for autoplay)
   */
  canPlayAudio() {
    return this.userInteractionDetected || (this.audioContext && this.audioContext.state === 'running');
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
    console.log('User interaction manually set');
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

export function getAudioStats() {
  return audioContextManager.getStats();
}

// Global access for debugging and other modules
window.audioContextManager = audioContextManager;