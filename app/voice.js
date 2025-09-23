import { Writable } from "stream";
import getUserMedia from "./getusermedia";
import keyboardjs from "keyboardjs";
import DropStream from "drop-stream";

// Resource tracking for memory management
const activeResources = {
  workers: new Set(),
  streams: new Set(),
  audioNodes: new Set(),
  timers: new Set(),
  audioContexts: new Set(),
  mediaStreamTracks: new Set(),
  keyboardBindings: new Set()
};

// Enhanced cleanup utilities
function trackResource(type, resource) {
  if (activeResources[type]) {
    activeResources[type].add(resource);
  }
  return resource;
}

function untrackResource(type, resource) {
  if (activeResources[type]) {
    activeResources[type].delete(resource);
  }
}

function createTrackedTimer(callback, delay, isInterval = false) {
  const timer = isInterval ? setInterval(callback, delay) : setTimeout(callback, delay);
  trackResource('timers', timer);
  return timer;
}

function clearTrackedTimer(timer) {
  clearTimeout(timer);
  clearInterval(timer);
  untrackResource('timers', timer);
}

class VoiceHandler extends Writable {
  constructor(client, settings) {
    super({ objectMode: true });
    this._client = client;
    this._settings = settings;
    this._outbound = null;
    this._mute = false;
    this._isDestroyed = false;
  }

  setMute(mute) {
    if (this._isDestroyed) return;
    this._mute = mute;
    if (mute) {
      this._stopOutbound();
    }
  }

  _getOrCreateOutbound() {
    if (this._isDestroyed) {
      throw new Error("VoiceHandler has been destroyed");
    }
    if (this._mute) {
      throw new Error("tried to send audio while self-muted");
    }
    if (!this._outbound) {
      if (!this._client) {
        this._outbound = DropStream.obj();
        trackResource('streams', this._outbound);
        this.emit("started_talking");
        return this._outbound;
      }

      // Note: the samplesPerPacket argument is handled in worker.js and not passed on
      this._outbound = this._client.createVoiceStream(
        this._settings.samplesPerPacket
      );
      trackResource('streams', this._outbound);

      this.emit("started_talking");
    }
    return this._outbound;
  }

  _stopOutbound() {
    if (this._outbound) {
      this.emit("stopped_talking");
      this._outbound.end();
      untrackResource('streams', this._outbound);
      this._outbound = null;
    }
  }

  _final(callback) {
    this._stopOutbound();
    this._isDestroyed = true;
    callback();
  }

  destroy() {
    if (!this._isDestroyed) {
      this._stopOutbound();
      this._isDestroyed = true;
      super.destroy();
    }
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
    
    // Track keyboard binding for cleanup
    const binding = { key: this._key, keydown: this._keydown_handler, keyup: this._keyup_handler };
    trackResource('keyboardBindings', binding);
    
    keyboardjs.bind(this._key, this._keydown_handler, this._keyup_handler);
  }

  _write(data, _, callback) {
    if (this._isDestroyed) {
      callback();
      return;
    }
    if (this._pushed && !this._mute) {
      this._getOrCreateOutbound().write(data, callback);
    } else {
      callback();
    }
  }

  _final(callback) {
    super._final((e) => {
      keyboardjs.unbind(this._key, this._keydown_handler, this._keyup_handler);
      
      // Remove from tracked bindings
      const binding = { key: this._key, keydown: this._keydown_handler, keyup: this._keyup_handler };
      untrackResource('keyboardBindings', binding);
      
      callback(e);
    });
  }

  destroy() {
    if (!this._isDestroyed) {
      keyboardjs.unbind(this._key, this._keydown_handler, this._keyup_handler);
      
      // Remove from tracked bindings
      const binding = { key: this._key, keydown: this._keydown_handler, keyup: this._keyup_handler };
      untrackResource('keyboardBindings', binding);
    }
    super.destroy();
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
      // === NEU: AudioWorklet statt microphone-stream ===
      const ac = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
      });
      
      // Track AudioContext for cleanup
      trackResource('audioContexts', ac);

      // Worklet laden
      await ac.audioWorklet.addModule("recorder-worker.js");

      // Quelle aus getUserMedia
      const src = ac.createMediaStreamSource(userMedia);
      trackResource('audioNodes', src);

      // Worklet-Node (mono)
      const node = new AudioWorkletNode(ac, "recorder-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 0, // kein Audio-Out nötig
        channelCount: 1,
      });
      trackResource('audioNodes', node);

      // Track all media stream tracks
      userMedia.getTracks().forEach(track => {
        trackResource('mediaStreamTracks', track);
      });
      trackResource('streams', userMedia);

      // PCM-Frames (Float32, 960 Samples @48k) an bestehende Pipeline geben
      node.port.onmessage = (ev) => {
        if (ev.data?.type === "pcm" && ev.data.data) {
          const f32 = new Float32Array(ev.data.data);
          onData(Buffer.from(f32.buffer));
        }
      };

      // verbinden
      src.connect(node);

      // Enhanced cleanup when mediastream ends
      userMedia.getTracks().forEach((track) =>
        track.addEventListener("ended", () => {
          try {
            node.disconnect();
            untrackResource('audioNodes', node);
          } catch {}
          try {
            src.disconnect();
            untrackResource('audioNodes', src);
          } catch {}
          try {
            ac.close();
            untrackResource('audioContexts', ac);
          } catch {}
          
          untrackResource('mediaStreamTracks', track);
          untrackResource('streams', userMedia);
        })
      );
    } catch (e) {
      console.error("AudioWorklet init failed:", e);
      onUserMediaError(e);
    }
  });
}

/**
 * Comprehensive cleanup function for all voice-related resources
 */
export function cleanup() {
  console.log('Starting voice cleanup...');
  
  // Stop all media stream tracks
  activeResources.mediaStreamTracks.forEach(track => {
    try {
      if (track.readyState !== 'ended') {
        track.stop();
        console.log('Stopped media track:', track.label || track.kind);
      }
    } catch (error) {
      console.error('Error stopping media track:', error);
    }
  });
  activeResources.mediaStreamTracks.clear();
  
  // Clean up all streams
  activeResources.streams.forEach(stream => {
    try {
      if (stream && typeof stream.destroy === 'function') {
        stream.destroy();
      } else if (stream && stream.getTracks) {
        stream.getTracks().forEach(track => track.stop());
      }
      console.log('Cleaned up stream');
    } catch (error) {
      console.error('Error cleaning up stream:', error);
    }
  });
  activeResources.streams.clear();
  
  // Disconnect all audio nodes
  activeResources.audioNodes.forEach(node => {
    try {
      if (node && typeof node.disconnect === 'function') {
        node.disconnect();
        console.log('Disconnected audio node');
      }
    } catch (error) {
      console.error('Error disconnecting audio node:', error);
    }
  });
  activeResources.audioNodes.clear();
  
  // Close all audio contexts
  activeResources.audioContexts.forEach(context => {
    try {
      if (context && context.state !== 'closed') {
        context.close();
        console.log('Closed audio context');
      }
    } catch (error) {
      console.error('Error closing audio context:', error);
    }
  });
  activeResources.audioContexts.clear();
  
  // Clear all timers
  activeResources.timers.forEach(timer => {
    try {
      clearTimeout(timer);
      clearInterval(timer);
    } catch (error) {
      console.error('Error clearing timer:', error);
    }
  });
  activeResources.timers.clear();
  
  // Unbind keyboard handlers
  activeResources.keyboardBindings.forEach(binding => {
    try {
      keyboardjs.unbind(binding.key, binding.keydown, binding.keyup);
      console.log('Unbound keyboard binding for key:', binding.key);
    } catch (error) {
      console.error('Error unbinding keyboard:', error);
    }
  });
  activeResources.keyboardBindings.clear();
  
  // Terminate workers (if any are tracked)
  activeResources.workers.forEach(worker => {
    try {
      if (worker && typeof worker.terminate === 'function') {
        worker.terminate();
        console.log('Terminated worker');
      }
    } catch (error) {
      console.error('Error terminating worker:', error);
    }
  });
  activeResources.workers.clear();
  
  console.log('Voice cleanup completed');
}

/**
 * Get current resource usage stats for debugging
 */
export function getResourceStats() {
  return {
    workers: activeResources.workers.size,
    streams: activeResources.streams.size,
    audioNodes: activeResources.audioNodes.size,
    timers: activeResources.timers.size,
    audioContexts: activeResources.audioContexts.size,
    mediaStreamTracks: activeResources.mediaStreamTracks.size,
    keyboardBindings: activeResources.keyboardBindings.size,
    total: Object.values(activeResources).reduce((sum, set) => sum + set.size, 0)
  };
}

// Auto-cleanup on page events
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);

// Cleanup on visibility change (mobile browsers)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pause non-critical resources when page is hidden
    console.log('Page hidden, pausing voice resources');
    activeResources.workers.forEach(worker => {
      try {
        if (worker && worker.postMessage) {
          worker.postMessage({ cmd: 'pause' });
        }
      } catch (error) {
        console.error('Error pausing worker:', error);
      }
    });
  } else {
    // Resume when page becomes visible again
    console.log('Page visible, resuming voice resources');
    activeResources.workers.forEach(worker => {
      try {
        if (worker && worker.postMessage) {
          worker.postMessage({ cmd: 'resume' });
        }
      } catch (error) {
        console.error('Error resuming worker:', error);
      }
    });
  }
});

// Export resource tracking utilities for other modules
export { trackResource, untrackResource, createTrackedTimer, clearTrackedTimer };
