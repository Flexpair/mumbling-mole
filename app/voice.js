import { Writable } from "stream";
import getUserMedia from "./getusermedia";
import keyboardjs from "keyboardjs";
import DropStream from "drop-stream";
import audioContextManager, { getAudioContext, ensureAudioContext } from "./audio-context-manager";

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
        this._settings.samplesPerPacket,
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
      // ERROR-HANDLING: Wrap stream write in try-catch to prevent uncaught exceptions
      // Helps diagnose issues when voice stream fails unexpectedly
      try {
        this._getOrCreateOutbound().write(data, callback);
      } catch (err) {
        console.error("[VOICE-HANDLER] Error in _getOrCreateOutbound:", err);
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
    this._key = settings.pttKey;
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
      this._getOrCreateOutbound().write(data, callback);
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

const audioInputSelect = document.querySelector("select#audioSource");
const selectors = [audioInputSelect];

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map((select) => select.value);
  selectors.forEach((select) => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement("option");
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === "audioinput") {
      option.text =
        deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (
      Array.prototype.slice
        .call(select.childNodes)
        .some((n) => n.value === values[selectorIndex])
    ) {
      select.value = values[selectorIndex];
    }
  });
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
 * Init microphone capture.
 * Liefert per onData PCM-Frames (Float32) weiter – wie bisher, nur stabil via AudioWorklet.
 */
export function initVoice(onData, onUserMediaError) {
  const audioSource = audioInputSelect.value;

  const constraints = {
    audio: {
      deviceId: audioSource ? { exact: audioSource } : undefined,
      echoCancellation: true,
      channelCount: { ideal: 1 },
      sampleRate: { ideal: 48000 },
    },
  };

  getUserMedia(constraints, async (err, userMedia) => {
    if (err) {
      onUserMediaError(err);
      return;
    }

    try {
      // AUDIO-CONTEXT: Use managed AudioContext with autoplay policy handling
      // Sample rate must be 48kHz to match Mumble protocol requirements
      const ac = await ensureAudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // AUDIOWORKLET: Load AudioWorklet processor for real-time audio capture
      // recorder-worker.js runs in audio thread for low-latency processing
      await ac.audioWorklet.addModule("recorder-worker.js");

      // AUDIO-SOURCE: Create audio source from microphone stream
      const src = ac.createMediaStreamSource(userMedia);

      // WORKLET-NODE: Create AudioWorklet node for mono audio processing
      // Processes audio in audio thread, not main thread
      const node = new AudioWorkletNode(ac, "recorder-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 0, // No audio output needed - we only capture, not play back
        channelCount: 1, // Mono channel (Mumble protocol requirement)
      });

      // PCM-PIPELINE: Receive PCM frames from AudioWorklet and send to voice pipeline
      // Frame size: 960 samples @ 48kHz = 20ms (standard Mumble frame duration)
      node.port.onmessage = (ev) => {
        if (ev.data?.type === "pcm" && ev.data.data) {
          const f32 = new Float32Array(ev.data.data);
          // DEBUG-LOGGING: Commented out to avoid console spam during normal operation
          // Uncomment for debugging audio capture issues:
          // console.log("[VOICE] PCM data received, samples:", f32.length, "max amplitude:", Math.max(...f32.map(Math.abs)));
          onData(Buffer.from(f32.buffer));
        }
      };

      // verbinden
      src.connect(node);

      // optional: aufräumen, wenn das mediastream endet
      userMedia.getTracks().forEach((t) =>
        t.addEventListener("ended", () => {
          try {
            node.disconnect();
          } catch {}
          try {
            src.disconnect();
          } catch {}
          // Don't close the shared/global AudioContext here. Suspending saves power without
          // invalidating the shared instance held by the AudioContextManager.
          try {
            audioContextManager.suspendAudioContext();
          } catch {}
        })
      );
    } catch (e) {
      console.error("AudioWorklet init failed:", e);
      onUserMediaError(e);
    }
  });
}
