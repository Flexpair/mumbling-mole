import toArrayBuffer from "to-arraybuffer";

const MUMBLE_SAMPLE_RATE = 48000;

let OpusEncoder, libopus;
let opusInitialized = false;

async function initOpus() {
  if (!opusInitialized) {
    const opusModule = await import("libopus.js");
    OpusEncoder = opusModule.Encoder;
    libopus = opusModule.libopus;
    opusInitialized = true;
  }
}

var opusEncoder;
var bitrate;
self.addEventListener("message", async (e) => {
  const data = e.data;
  if (data.action === "reset") {
    if (opusEncoder) {
      opusEncoder.destroy();
      opusEncoder = null;
    }
    bitrate = null;
    self.postMessage({ reset: true });
  } else if (data.action === "encodeOpus") {
    try {
      await initOpus(); // Lazy load opus only when needed
      
      if (!opusEncoder) {
        opusEncoder = new OpusEncoder({
          unsafe: true, // for performance and setting sample rate
          channels: data.numberOfChannels,
          rate: MUMBLE_SAMPLE_RATE,
        });
      }
    if (data.bitrate !== bitrate) {
      bitrate = data.bitrate;
      // Directly accessing libopus like this requires unsafe:true above!
      const OPUS_SET_BITRATE = 4002; // from opus_defines.h
      const OPUS_AUTO = -1000; // from opus_defines.h
      let enc = opusEncoder._state;
      let val = libopus._malloc(4); // space for varargs array (single entry)
      try {
        libopus.HEAP32[val >> 2] = bitrate || OPUS_AUTO; // store bitrate in varargs array
        let ret = libopus._opus_encoder_ctl(enc, OPUS_SET_BITRATE, val);
        if (ret !== 0) {
          throw new Error(
            libopus.Pointer_stringify(libopus._opus_strerror(ret))
          );
        }
      } finally {
        libopus._free(val);
      }
    }
    const encoded = opusEncoder.encode(new Float32Array(data.buffer));
    const buffer = toArrayBuffer(encoded);
    self.postMessage(
      {
        target: data.target,
        buffer: buffer,
        position: data.position,
      },
      [buffer]
    );
    } catch (error) {
      self.postMessage({
        error: `Opus encoding failed: ${error.message}`,
        target: data.target,
        position: data.position,
      });
    }
  }
});

export default null;
