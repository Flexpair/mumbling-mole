import { Decoder as OpusDecoder } from "libopus.js";

const MUMBLE_SAMPLE_RATE = 48000;

let opusDecoder;
// SECURITY-NOTE: Origin verification in dedicated worker context
// -----------------------------------------------------------
// Dedicated workers can ONLY receive messages from their creating parent context.
// Unlike window.postMessage(), there is no cross-origin risk here because:
// 1. Workers cannot be accessed by other origins
// 2. The 'origin' property doesn't exist on worker MessageEvent objects
// 3. The worker can only communicate with the script that instantiated it
globalThis.addEventListener("message", (e) => {
  const data = e.data;
  if (data.action === "reset") {
    if (opusDecoder) {
      opusDecoder.destroy();
      opusDecoder = null;
    }
    globalThis.postMessage({
      action: "reset",
    });
  } else if (data.action === "decodeOpus") {
    if (!opusDecoder) {
      opusDecoder = new OpusDecoder({
        unsafe: true,
        channels: 1,
        rate: MUMBLE_SAMPLE_RATE,
      });
    }
    const input = data.buffer ? Buffer.from(data.buffer) : null;
    const decoded = opusDecoder.decodeFloat32(input);
    globalThis.postMessage(
      {
        action: "decoded",
        buffer: decoded.buffer,
        target: data.target,
        position: data.position,
      },
      [decoded.buffer]
    );
  }
});

export default null;
