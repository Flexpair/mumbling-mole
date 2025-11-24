import { Decoder as OpusDecoder } from "libopus.js";

const MUMBLE_SAMPLE_RATE = 48000;

let opusDecoder;
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
