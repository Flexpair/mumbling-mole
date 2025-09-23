import { Writable } from "stream";
import getUserMedia from "./getusermedia";
import keyboardjs from "keyboardjs";
import DropStream from "drop-stream";
import audioContextManager, { getAudioContext, ensureAudioContext } from "./audio-context-manager";

class VoiceHandler extends Writable {
  constructor(client, settings) {
    super({ objectMode: true });
    this._client = client;
    this._settings = settings;
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
        this._outbound = DropStream.obj();
        this.emit("started_talking");
        return this._outbound;
      }

      // Note: the samplesPerPacket argument is handled in worker.js and not passed on
      this._outbound = this._client.createVoiceStream(
        this._settings.samplesPerPacket
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

export class ContinuousVoiceHandler extends VoiceHandler {
  constructor(client, settings) {
    super(client, settings);
  }

  _write(data, _, callback) {
    if (this._mute) {
      callback();
    } else {
      this._getOrCreateOutbound().write(data, callback);
    }
  }
}

export class PushToTalkVoiceHandler extends VoiceHandler {
  constructor(client, settings) {
    super(client, settings);
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
  console.log(
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
      // Use managed AudioContext with autoplay policy handling
      console.log('Initializing voice with managed AudioContext...');
      const ac = await ensureAudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      console.log('AudioContext ready for voice:', {
        state: ac.state,
        sampleRate: ac.sampleRate
      });

      // Worklet laden
      await ac.audioWorklet.addModule("recorder-worker.js");

      // Quelle aus getUserMedia
      const src = ac.createMediaStreamSource(userMedia);

      // Worklet-Node (mono)
      const node = new AudioWorkletNode(ac, "recorder-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 0, // kein Audio-Out nötig
        channelCount: 1,
      });

      // PCM-Frames (Float32, 960 Samples @48k) an bestehende Pipeline geben
      node.port.onmessage = (ev) => {
        if (ev.data?.type === "pcm" && ev.data.data) {
          const f32 = new Float32Array(ev.data.data);
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
