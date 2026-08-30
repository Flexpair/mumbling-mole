import { Writable } from "node:stream";
import keyboardjs from "keyboardjs";
import DropStream from "../utils/drop-stream.js";
import audioContextManager, { ensureAudioContext } from "./audio-context-manager";
import { debugLog } from "../utils/debug-utils.js";

// Helper to get settings value - works with both old ref-style ({value: x}) and new Pinia store (direct access)
const getSettingsValue = (settings, key, defaultValue) => {
  if (!settings) return defaultValue;
  const value = settings[key];
  // If it's a Vue ref (has .value property), unwrap it
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value ?? defaultValue;
  }
  return value ?? defaultValue;
};

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
      const samplesPerPacket = getSettingsValue(this._settings, 'samplesPerPacket', 960);
      this._outbound = this._client.createVoiceStream(
        samplesPerPacket,
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
    this._key = getSettingsValue(settings, 'pttKey', 'ctrl + shift');
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

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const audioInputSelect = getAudioInputSelect();
  if (!audioInputSelect) {
    console.warn('[VOICE] audioSource select element not found in DOM');
    return;
  }
  const previousValue = audioInputSelect.value;
  audioInputSelect.replaceChildren();

  let fallbackIndex = 1;
  for (const deviceInfo of deviceInfos) {
    if (deviceInfo.kind !== "audioinput") {
      continue;
    }
    const option = document.createElement("option");
    option.value = deviceInfo.deviceId;
    option.text = deviceInfo.label || `microphone ${fallbackIndex++}`;
    audioInputSelect.appendChild(option);
  }

  if (Array.from(audioInputSelect.options).some((n) => n.value === previousValue)) {
    audioInputSelect.value = previousValue;
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
    return () => {};
  }
  
  // If mixer is already available, call immediately
  if (globalThis._audioMixer) {
    try {
      callback(globalThis._audioMixer);
    } catch (err) {
      console.error('[VOICE] Error in mixer ready callback:', err);
    }
    return () => {};
  } else {
    // Otherwise, queue for later
    audioMixerReadyCallbacks.push(callback);
    return () => {
      const index = audioMixerReadyCallbacks.indexOf(callback);
      if (index !== -1) audioMixerReadyCallbacks.splice(index, 1);
    };
  }
}

function removeTrackEndedHandlers(capture) {
  for (const [track, handler] of capture.trackEndedHandlers) {
    try {
      track.removeEventListener('ended', handler);
    } catch (error_) {
      console.warn('[VOICE] Error removing track listener:', error_);
    }
  }
  capture.trackEndedHandlers.clear();
}

function stopCaptureTracks(capture) {
  for (const track of capture.userMedia?.getTracks?.() || []) {
    if (capture.stoppedTracks.has(track)) continue;
    capture.stoppedTracks.add(track);
    try {
      track.stop();
    } catch (error_) {
      console.warn('[VOICE] Error stopping microphone track:', error_);
    }
  }
}

function disconnectCaptureNodes(capture) {
  if (capture.node?.port) capture.node.port.onmessage = null;
  for (const [node, label] of [
    [capture.node, 'AudioWorkletNode'],
    [capture.mixer, 'mixer'],
    [capture.src, 'source'],
  ]) {
    if (!node || capture.disconnectedNodes.has(node)) continue;
    capture.disconnectedNodes.add(node);
    try {
      node.disconnect();
    } catch (error_) {
      console.warn(`[VOICE] Error disconnecting ${label}:`, error_);
    }
  }
}

function releaseCurrentMixer(capture) {
  const ownsCurrentMixer = capture.mixer &&
    currentMixerInstance === capture.mixer &&
    currentMixerTimestamp === capture.mixerTimestamp;
  if (!ownsCurrentMixer) return;

  currentMixerInstance = null;
  globalThis._audioMixer = null;
  if (capture.suspended) return;

  capture.suspended = true;
  try {
    Promise.resolve(audioContextManager.suspendAudioContext()).catch(error_ => {
      console.warn('[VOICE] Error suspending AudioContext:', error_);
    });
  } catch (error_) {
    console.warn('[VOICE] Error suspending AudioContext:', error_);
  }
}

function cleanupVoiceCapture(capture) {
  removeTrackEndedHandlers(capture);
  stopCaptureTracks(capture);
  disconnectCaptureNodes(capture);
  releaseCurrentMixer(capture);
}

function createVoiceCapture() {
  return {
    cancelled: false,
    userMedia: null,
    src: null,
    mixer: null,
    node: null,
    mixerTimestamp: 0,
    stoppedTracks: new Set(),
    disconnectedNodes: new Set(),
    trackEndedHandlers: new Map(),
    suspended: false,
  };
}

function createStopCapture(capture) {
  return () => {
    capture.cancelled = true;
    cleanupVoiceCapture(capture);
  };
}

async function handleUserMediaSuccess(userMedia, onData, onUserMediaError, onReady, capture) {
  const initStartTime = Date.now();
  debugLog('[VOICE-INIT]', 'Starting audio pipeline initialization');

  try {
    if (capture.cancelled) {
      cleanupVoiceCapture(capture);
      return;
    }

    // AUDIO-CONTEXT: Use managed AudioContext with autoplay policy handling
    // Sample rate must be 48kHz to match Mumble protocol requirements
    const acStartTime = Date.now();
    const ac = await ensureAudioContext({
      sampleRate: 48000,
      latencyHint: 'interactive'
    });
    if (capture.cancelled) {
      cleanupVoiceCapture(capture);
      return;
    }
    debugLog('[VOICE-INIT]', `AudioContext ready after ${Date.now() - acStartTime}ms (state: ${ac.state}, sampleRate: ${ac.sampleRate}Hz)`);

    // AUDIOWORKLET: Load AudioWorklet processor for real-time audio capture
    // recorder-worker.js runs in audio thread for low-latency processing
    const workletStartTime = Date.now();
    await ac.audioWorklet.addModule("recorder-worker.js");
    if (capture.cancelled) {
      cleanupVoiceCapture(capture);
      return;
    }
    debugLog('[VOICE-INIT]', `AudioWorklet module loaded after ${Date.now() - workletStartTime}ms`);

    // AUDIO-SOURCE: Create audio source from microphone stream
    const src = ac.createMediaStreamSource(userMedia);
    capture.src = src;

    // BEEP-MIXER: Create a mixer node to combine microphone + beep signals
    const mixer = ac.createGain();
    capture.mixer = mixer;
    mixer.gain.setValueAtTime(1, ac.currentTime);

    // WORKLET-NODE: Create AudioWorklet node for mono audio processing
    // Processes audio in audio thread, not main thread
    const node = new AudioWorkletNode(ac, "recorder-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 0, // No audio output needed - we only capture, not play back
      channelCount: 1, // Mono channel (Mumble protocol requirement)
    });
    capture.node = node;

    if (capture.cancelled) {
      cleanupVoiceCapture(capture);
      return;
    }

    // PCM-PIPELINE: Receive PCM frames from AudioWorklet and send to voice pipeline
    // Frame size: 960 samples @ 48kHz = 20ms (standard Mumble frame duration)
    node.port.onmessage = (ev) => {
      if (capture.cancelled) return;
      if (ev.data?.type === "pcm" && ev.data.data) {
        const f32 = new Float32Array(ev.data.data);
        // NOTE: Debug logging removed - was using undefined 'this._isLoopbackMode'
        // initVoice is not a class method and has no 'this' context
        onData(Buffer.from(f32.buffer));
      }
    };

    // Connect microphone through mixer to AudioWorklet
    src.connect(mixer);
    mixer.connect(node);

    const mixerTimestamp = Date.now();
    capture.mixerTimestamp = mixerTimestamp;
    currentMixerInstance = mixer;
    currentMixerTimestamp = mixerTimestamp;

    globalThis._audioMixer = mixer;
    debugLog('[VOICE-INIT]', `Audio mixer ready - total initialization time: ${Date.now() - initStartTime}ms`);

    for (const callback of audioMixerReadyCallbacks) {
      try {
        callback(mixer);
      } catch (err) {
        console.error('[VOICE] Error in mixer ready callback:', err);
      }
    }
    audioMixerReadyCallbacks.length = 0;

    for (const track of userMedia.getTracks()) {
      const handleEnded = () => cleanupVoiceCapture(capture);
      capture.trackEndedHandlers.set(track, handleEnded);
      track.addEventListener('ended', handleEnded);
    }

    onReady?.(mixer);
  } catch (e) {
    cleanupVoiceCapture(capture);
    if (capture.cancelled) return;
    console.error("AudioWorklet init failed:", e);
    onUserMediaError(e);
  }
}

/**
 * Init microphone capture.
 * Liefert per onData PCM-Frames (Float32) weiter – wie bisher, nur stabil via AudioWorklet.
 */
export function initVoice(onData, onUserMediaError, onReady) {
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

  const capture = createVoiceCapture();
  const stopCapture = createStopCapture(capture);

  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error("MediaStreamError");
    error.name = "NotSupportedError";
    onUserMediaError(error);
    return;
  }

  navigator.mediaDevices.getUserMedia(constraints)
    .then(userMedia => {
      capture.userMedia = userMedia;
      if (capture.cancelled) {
        cleanupVoiceCapture(capture);
        return;
      }
      return handleUserMediaSuccess(userMedia, onData, onUserMediaError, onReady, capture);
    })
    .catch(err => {
      cleanupVoiceCapture(capture);
      if (!capture.cancelled) onUserMediaError(err);
    });

  return stopCapture;
}
