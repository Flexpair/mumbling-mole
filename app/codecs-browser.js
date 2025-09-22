import DecoderStream from "./decoder-stream";
import EncoderStream from "./encoder-stream";

export const opus = true;

let OpusDecoder;

async function initOpus() {
  if (!OpusDecoder) {
    const opusModule = await import("libopus.js");
    OpusDecoder = opusModule.Decoder;
  }
}

export async function getDuration(codec, buffer) {
  if (codec === "Opus") {
    await initOpus();
    return OpusDecoder.getNumberOfSamples(buffer, 48000) / 48;
  } else {
    return 10;
  }
}

export function createDecoderStream(user) {
  return new DecoderStream();
}

export function createEncoderStream(codec) {
  return new EncoderStream(codec);
}
