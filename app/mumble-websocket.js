import websocketStream from "websocket-stream";
import MumbleClient from "./mumble-client/index.js";

async function connect(address, options) {
  const ws = await new Promise((resolve, reject) => {
    const ws = websocketStream(address, ["binary"])
      .on("error", reject)
      .on("connect", () => resolve(ws));
  });
  return new MumbleClient(options).connectDataStream(ws);
}

export default connect;
