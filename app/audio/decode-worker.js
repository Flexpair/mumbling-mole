import { Decoder as OpusDecoder } from "libopus.js";

const MUMBLE_SAMPLE_RATE = 48000;

let opusDecoder;
// SECURITY-NOTE: Origin verification in dedicated worker context
// -----------------------------------------------------------
// This worker is created directly via `new Worker()` and receives messages
// only from its creating parent context through the direct Worker channel.
// Unlike window.postMessage(), this channel does not expose cross-origin risk
// because there is no origin check needed — the worker cannot be reached from
// other origins. However, MessageEvent.origin DOES exist on worker messages,
// and transferred MessagePorts could enable other communication paths.
// This comment only covers the direct Worker message channel used here;
// it does not authenticate the sending script or any forwarded data.
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
