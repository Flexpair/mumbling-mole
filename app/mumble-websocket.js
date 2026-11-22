import websocketStream from "./utils/websocket-stream-lite.js";
import MumbleClient from "./mumble-client/index.js";

async function connect(address, options, { signal } = {}) {
  if (signal?.aborted) {
    throw new DOMException("Connection aborted", "AbortError");
  }

  const { accessToken, ...clientOptions } = options;
  const protocols = ["binary"];
  if (typeof accessToken === "string" && accessToken) {
    if (new URL(address).protocol !== "wss:") {
      throw new Error("Authenticated WebSocket connections require wss://");
    }
    protocols.push(`mumble-auth.${accessToken}`);
  }

  let pendingStream;
  const abortError = () => new DOMException("Connection aborted", "AbortError");
  const handshake = new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
      pendingStream?.removeListener("error", onError);
      pendingStream?.removeListener("connect", onConnect);
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      pendingStream.destroy();
      reject(abortError());
    };
    const onError = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onConnect = () => {
      if (settled) return;
      let connection;
      try {
        connection = new MumbleClient(clientOptions).connectDataStream(pendingStream);
      } catch (error) {
        settled = true;
        cleanup();
        pendingStream.destroy();
        reject(error);
        return;
      }
      connection.then(
        (client) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(client);
        },
        (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          pendingStream.destroy();
          reject(error);
        }
      );
    };

    pendingStream = websocketStream(address, protocols)
      .once("error", onError)
      .once("connect", onConnect);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
  return handshake;
}

export default connect;
