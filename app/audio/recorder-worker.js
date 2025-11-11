// ARCHITECTURE CONSTRAINT: 20 ms @ 48 kHz -> 960 Samples/Channel, mono
// This value is FIXED throughout the audio pipeline:
// - AudioWorklet processor (this file): 960 samples per frame
// - Worker resampler (worker.js): expects 960-sample chunks
// - Opus codec configuration: configured for 20ms frames
// - Settings UI (SettingsDialog.vue): slider disabled to prevent changes
// Changing this requires coordinated updates across ALL components.
// See: app/audio/README.md and .github/copilot-instructions.md
const FRAME = 960;

class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.acc = new Float32Array(0);
  }
  process(inputs) {
    const input = inputs[0];
    if (!input?.[0]) return true;       // kein Audio, keep processor alive
    const block = input[0];                      // mono Float32

    // anpuffern
    const merged = new Float32Array(this.acc.length + block.length);
    merged.set(this.acc, 0);
    merged.set(block, this.acc.length);

    // in 960er Frames zerlegen und an den Main-Thread schicken
    let off = 0;
    while (merged.length - off >= FRAME) {
      const out = new Float32Array(FRAME);
      out.set(merged.subarray(off, off + FRAME));
      this.port.postMessage({ type: "pcm", data: out }, [out.buffer]);
      off += FRAME;
    }
    this.acc = merged.subarray(off);
    return true;  // NOSONAR - AudioWorkletProcessor must return true to stay alive
  }
}

registerProcessor("recorder-processor", RecorderProcessor);
