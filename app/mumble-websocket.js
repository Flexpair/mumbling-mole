import websocketStream from "./utils/websocket-stream-lite.js";
import MumbleClient from "./mumble-client/index.js";

async function connect(address, options, { signal } = {}) {
  if (signal?.aborted) {
    throw new DOMException("Connection aborted", "AbortError");
  }

  let pendingStream;
  const ws = await new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      pendingStream.destroy();
      reject(new DOMException("Connection aborted", "AbortError"));
    };
    const onError = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onConnect = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(pendingStream);
    };

    pendingStream = websocketStream(address, ["binary"])
      .once("error", onError)
      .once("connect", onConnect);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
  return new MumbleClient(options).connectDataStream(ws);
}

export default connect;
