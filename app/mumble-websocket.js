import Promise from "promise";
import websocketStream from "websocket-stream";
import MumbleClient from "mumble-client";

// Native async wrapper for establishing the websocket and wiring it to MumbleClient.
// Note: callback-style (.nodeify) support was removed; no current internal callers use it.
async function connect(address, options) {
  const ws = await new Promise((resolve, reject) => {
    const ws = websocketStream(address, ["binary"])
      .on("error", reject)
      .on("connect", () => resolve(ws));
  });
  // connectDataStream returns a thenable; awaiting/returning adopts its resolution.
  return new MumbleClient(options).connectDataStream(ws);
}

export default connect;
