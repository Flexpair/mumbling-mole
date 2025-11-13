import { Writable } from "node:stream";
import getUserMedia from "./getusermedia";
import keyboardjs from "keyboardjs";
import DropStream from "drop-stream";
import audioContextManager, { ensureAudioContext } from "./audio-context-manager";

// VOICE-HANDLER: Base class for voice transmission handling
// Manages outbound audio streams and routing to different targets (channels, users, or loopback)
class VoiceHandler extends Writable {
  // LOOPBACK-FEATURE: Constructor now accepts target parameter for voice routing
  // target=0 (default) routes to current channel, target=31 routes to server loopback
  constructor(client, settings, target = 0) {
    super({ objectMode: true });
    this._client = client;
    this._settings = settings;
    this._target = target; // Voice routing target (0=normal, 31=loopback)
    this._outbound = null;
    this._mute = false;
    this._isLoopbackMode = target === 31; // Track loopback mode for debug logging
  }

  setMute(mute) {
    this._mute = mute;
    if (mute) {
      this._stopOutbound();
    }
  }

  _getOrCreateOutbound() {
    if (this._mute) {
      throw new Error("tried to send audio while self-muted");
    }
    if (!this._outbound) {
      if (!this._client) {
        // FALLBACK: No client available - use drop stream to discard audio
        this._outbound = DropStream.obj();
        this.emit("started_talking");
        return this._outbound;
      }

      // VOICE-STREAM-CREATION: Create voice stream with specified target
      // samplesPerPacket controls frame size (default 960 samples = 20ms @ 48kHz)
      // target parameter routes voice to different destinations
      this._outbound = this._client.createVoiceStream(
        this._settings.samplesPerPacket.value,
        this._target
      );

      this.emit("started_talking");
    }
    return this._outbound;
  }

  _stopOutbound() {
    if (this._outbound) {
      this.emit("stopped_talking");
      this._outbound.end();
      this._outbound = null;
    }
  }

  _final(callback) {
    this._stopOutbound();
    callback();
  }
}

// CONTINUOUS-MODE: Always-on voice transmission mode
// Continuously streams audio data without requiring key press
export class ContinuousVoiceHandler extends VoiceHandler {
  // LOOPBACK-FEATURE: Pass target parameter to base class for routing
  constructor(client, settings, target = 0) {
    super(client, settings, target);
  }

  _write(data, _, callback) {
    if (this._mute) {
      callback();
    } else {
      // ERROR-HANDLING: Catch synchronous errors from stream creation
      // Write errors are handled via the callback parameter (Node.js streams convention)
      try {
        const stream = this._getOrCreateOutbound();
        // stream.write is async - errors handled by callback, not try-catch
        stream.write(data, callback);
      } catch (err) {
        console.error("[VOICE-HANDLER] Error getting outbound stream:", err);
        callback(err);
      }
    }
  }
}

// PTT-MODE: Push-to-talk voice transmission mode
// Only streams audio when designated key is pressed
export class PushToTalkVoiceHandler extends VoiceHandler {
  // LOOPBACK-FEATURE: Pass target parameter to base class for routing
  constructor(client, settings, target = 0) {
    super(client, settings, target);
    this._key = settings.pttKey.value;
    this._pushed = false;
    this._keydown_handler = () => (this._pushed = true);
    this._keyup_handler = () => {
      this._stopOutbound();
      this._pushed = false;
    };
    keyboardjs.bind(this._key, this._keydown_handler, this._keyup_handler);
  }

  _write(data, _, callback) {
    if (this._pushed && !this._mute) {
      // ERROR-HANDLING: Catch synchronous errors from stream creation
      // Write errors are handled via the callback parameter (Node.js streams convention)
      try {
        const stream = this._getOrCreateOutbound();
        // stream.write is async - errors handled by callback, not try-catch
        stream.write(data, callback);
      } catch (err) {
        console.error("[VOICE-HANDLER] Error getting outbound stream:", err);
        callback(err);
      }
    } else {
      callback();
    }
  }

  _final(callback) {
    super._final((e) => {
      keyboardjs.unbind(this._key, this._keydown_handler, this._keyup_handler);
      callback(e);
    });
  }
}

// Query audioInputSelect dynamically to support Vue component mounting
function getAudioInputSelect() {
  return document.querySelector("select#audioSource");
}

function getSelectors() {
  const audioInputSelect = getAudioInputSelect();
  return audioInputSelect ? [audioInputSelect] : [];
}

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const selectors = getSelectors();
  if (selectors.length === 0) {
    console.warn('[VOICE] audioSource select element not found in DOM');
    return;
  }
  const values = selectors.map((select) => select.value);
  for (const select of selectors) {
    select.replaceChildren();
  }
  const audioInputSelect = getAudioInputSelect();
  for (const element of deviceInfos) {
    const deviceInfo = element;
    const option = document.createElement("option");
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === "audioinput") {
      option.text =
        deviceInfo.label || `microphone ${audioInputSelect?.childNodes.length + 1 || 1}`;
      audioInputSelect?.appendChild(option);
    }
  }
  for (let selectorIndex = 0; selectorIndex < selectors.length; selectorIndex++) {
    const select = selectors[selectorIndex];
    if (
      Array.prototype.slice
        .call(select.childNodes)
        .some((n) => n.value === values[selectorIndex])
    ) {
      select.value = values[selectorIndex];
    }
  }
}

function handleError(error) {
  console.error(
    "navigator.MediaDevices.getUserMedia error: ",
    error.message,
    error.name
  );
}

export function enumMicrophones() {
  navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
}

/**
 * Global callback registry for audio mixer ready events
 * External components can register callbacks to be notified when mixer becomes available
 */
const audioMixerReadyCallbacks = [];

// MIXER-TRACKING: Track current mixer instance to prevent race conditions
// When initVoice is called multiple times, only the latest mixer is valid
let currentMixerInstance = null;
let currentMixerTimestamp = 0;

/**
 * Get the current audio mixer instance
 * RACE-SAFE: Returns null if no mixer or mixer is from an old initVoice call
 * @returns {GainNode|null} Current audio mixer or null
 */
export function getCurrentMixer() {
  return currentMixerInstance;
}

/**
 * Register a callback to be invoked when audio mixer becomes ready
 * @param {Function} callback - Called with (mixer, audioContext) when ready
 */
export function onAudioMixerReady(callback) {
  if (typeof callback !== 'function') {
    console.error('[VOICE] onAudioMixerReady: callback must be a function');
    return;
  }
  
  // If mixer is already available, call immediately
  if (globalThis._audioMixer) {
    try {
      callback(globalThis._audioMixer);
    } catch (err) {
      console.error('[VOICE] Error in mixer ready callback:', err);
    }
  } else {
    // Otherwise, queue for later
    audioMixerReadyCallbacks.push(callback);
  }
}

/**
 * Init microphone capture.
 * Liefert per onData PCM-Frames (Float32) weiter – wie bisher, nur stabil via AudioWorklet.
 */
export function initVoice(onData, onUserMediaError) {
  const audioInputSelect = getAudioInputSelect();
  const audioSource = audioInputSelect?.value;

  const constraints = {
    audio: {
      deviceId: audioSource ? { exact: audioSource } : undefined,
      echoCancellation: true,
      autoGainControl: true,  // Enable automatic gain control to boost quiet microphones
      noiseSuppression: true,  // Also enable noise suppression for better quality
      channelCount: { ideal: 1 },
      sampleRate: { ideal: 48000 },
    },
  };

  getUserMedia(constraints, async (err, userMedia) => {
    if (err) {
      onUserMediaError(err);
      return;
    }

    const initStartTime = Date.now();
    console.log('[VOICE-INIT] Starting audio pipeline initialization');

    try {
      // AUDIO-CONTEXT: Use managed AudioContext with autoplay policy handling
      // Sample rate must be 48kHz to match Mumble protocol requirements
      const acStartTime = Date.now();
      const ac = await ensureAudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      console.log(`[VOICE-INIT] AudioContext ready after ${Date.now() - acStartTime}ms (state: ${ac.state}, sampleRate: ${ac.sampleRate}Hz)`);

      // AUDIOWORKLET: Load AudioWorklet processor for real-time audio capture
      // recorder-worker.js runs in audio thread for low-latency processing
      const workletStartTime = Date.now();
      await ac.audioWorklet.addModule("recorder-worker.js");
      console.log(`[VOICE-INIT] AudioWorklet module loaded after ${Date.now() - workletStartTime}ms`);

      // AUDIO-SOURCE: Create audio source from microphone stream
      const src = ac.createMediaStreamSource(userMedia);

      // BEEP-MIXER: Create a mixer node to combine microphone + beep signals
      const mixer = ac.createGain();
      mixer.gain.setValueAtTime(1, ac.currentTime);

      // WORKLET-NODE: Create AudioWorklet node for mono audio processing
      // Processes audio in audio thread, not main thread
      const node = new AudioWorkletNode(ac, "recorder-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 0, // No audio output needed - we only capture, not play back
        channelCount: 1, // Mono channel (Mumble protocol requirement)
      });

      // PCM-PIPELINE: Receive PCM frames from AudioWorklet and send to voice pipeline
      // Frame size: 960 samples @ 48kHz = 20ms (standard Mumble frame duration)
      let pcmFrameCount = 0;
      node.port.onmessage = (ev) => {
        if (ev.data?.type === "pcm" && ev.data.data) {
          const f32 = new Float32Array(ev.data.data);
          pcmFrameCount++;
          // NOTE: Debug logging removed - was using undefined 'this._isLoopbackMode'
          // initVoice is not a class method and has no 'this' context
          onData(Buffer.from(f32.buffer));
        }
      };

      // Connect microphone through mixer to AudioWorklet
      src.connect(mixer);
      mixer.connect(node);

      const mixerTimestamp = Date.now();
      currentMixerInstance = mixer;
      currentMixerTimestamp = mixerTimestamp;
      
      globalThis._audioMixer = mixer;
      console.log(`[VOICE-INIT] Audio mixer ready - total initialization time: ${Date.now() - initStartTime}ms`);

      for (const callback of audioMixerReadyCallbacks) {
        try {
          callback(mixer);
        } catch (err) {
          console.error('[VOICE] Error in mixer ready callback:', err);
        }
      }
      audioMixerReadyCallbacks.length = 0;

      // optional: aufräumen, wenn das mediastream endet
      for (const t of userMedia.getTracks()) {
        t.addEventListener("ended", () => {
          if (currentMixerInstance === mixer && currentMixerTimestamp === mixerTimestamp) {
            try {
              node.disconnect();
            } catch (error_) {
              console.warn('[VOICE] Error disconnecting AudioWorkletNode:', error_);
            }
            try {
              mixer.disconnect();
            } catch (error_) {
              console.warn('[VOICE] Error disconnecting mixer:', error_);
            }
            try {
              src.disconnect();
            } catch (error_) {
              console.warn('[VOICE] Error disconnecting source:', error_);
            }
            
            // Clear global references only if this is still the active instance
            currentMixerInstance = null;
            globalThis._audioMixer = null;
            
            // Don't close the shared/global AudioContext here. Suspending saves power without
            // invalidating the shared instance held by the AudioContextManager.
            try {
              audioContextManager.suspendAudioContext();
            } catch (error_) {
              console.warn('[VOICE] Error suspending AudioContext:', error_);
            }
          }
        });
      }
    } catch (e) {
      console.error("AudioWorklet init failed:", e);
      onUserMediaError(e);
    }
  });
}
