const MUMBLE_SAMPLE_RATE = 48000;

let OpusDecoder;
let opusInitialized = false;

async function initOpus() {
  if (!opusInitialized) {
    const opusModule = await import("libopus.js");
    OpusDecoder = opusModule.Decoder;
    opusInitialized = true;
  }
}

var opusDecoder;
self.addEventListener("message", async (e) => {
  const data = e.data;
  if (data.action === "reset") {
    if (opusDecoder) {
      opusDecoder.destroy();
      opusDecoder = null;
    }
    self.postMessage({
      action: "reset",
    });
  } else if (data.action === "decodeOpus") {
    try {
      await initOpus(); // Lazy load opus only when needed
      
      if (!opusDecoder) {
        opusDecoder = new OpusDecoder({
          unsafe: true,
          channels: 1, // TODO
          rate: MUMBLE_SAMPLE_RATE,
        });
      }
      const input = data.buffer ? Buffer.from(data.buffer) : null;
      const decoded = opusDecoder.decodeFloat32(input);
      self.postMessage(
        {
          action: "decoded",
          buffer: decoded.buffer,
          target: data.target,
          position: data.position,
        },
        [decoded.buffer]
      );
    } catch (error) {
      self.postMessage({
        action: "error",
        error: `Opus decoding failed: ${error.message}`,
        target: data.target,
        position: data.position,
      });
    }
  }
});

export default null;
