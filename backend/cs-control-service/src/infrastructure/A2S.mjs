import dgram from "node:dgram";

const QUERY = Buffer.concat([
  Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]),
  Buffer.from("Source Engine Query\0", "binary"),
]);
const configuredTimeout = Number(process.env.A2S_TIMEOUT_MS || 900);
const defaultTimeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 900;

function readCString(buffer, state) {
  const end = buffer.indexOf(0, state.offset);
  if (end === -1) throw new Error("Malformed A2S string");
  const value = buffer.subarray(state.offset, end).toString("utf8");
  state.offset = end + 1;
  return value;
}

export function parseA2SInfo(buffer) {
  if (buffer.length < 6 || buffer.readInt32LE(0) !== -1) throw new Error("Invalid A2S header");
  const type = buffer[4];
  const state = { offset: 5 };

  if (type === 0x49) {
    state.offset += 1;
    const name = readCString(buffer, state);
    const map = readCString(buffer, state);
    readCString(buffer, state);
    readCString(buffer, state);
    state.offset += 2;
    return {
      name,
      map,
      players: buffer[state.offset],
      maxPlayers: buffer[state.offset + 1],
      bots: buffer[state.offset + 2],
    };
  }

  if (type === 0x6d) {
    readCString(buffer, state);
    const name = readCString(buffer, state);
    const map = readCString(buffer, state);
    readCString(buffer, state);
    readCString(buffer, state);
    return { name, map, players: buffer[state.offset], maxPlayers: buffer[state.offset + 1], bots: 0 };
  }

  throw new Error(`Unsupported A2S response type: ${type}`);
}

export function queryA2S(host, port, timeoutMs = defaultTimeout) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    let challenged = false;
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("A2S timeout"));
    }, timeoutMs);

    socket.once("error", (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
    socket.on("message", (message) => {
      if (message.length >= 9 && message.readInt32LE(0) === -1 && message[4] === 0x41 && !challenged) {
        challenged = true;
        socket.send(Buffer.concat([QUERY, message.subarray(5, 9)]), port, host);
        return;
      }

      clearTimeout(timer);
      socket.close();
      try {
        resolve(parseA2SInfo(message));
      } catch (error) {
        reject(error);
      }
    });
    socket.send(QUERY, port, host);
  });
}
