import dgram from "node:dgram";

const header = Buffer.from([0xff, 0xff, 0xff, 0xff]);

function packet(command) {
  return Buffer.concat([header, Buffer.from(`${command}\n`, "utf8")]);
}

function quote(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function receive(socket, timeout = 1800) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("RCON response timed out")), timeout);
    socket.once("message", (message) => {
      clearTimeout(timer);
      resolve(message.subarray(4).toString("utf8").replace(/\0+$/, "").trim());
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export function parseRconChallenge(response) {
  const match = String(response).match(/challenge rcon\s+(-?\d+)/i);
  if (!match) throw new Error("Invalid RCON challenge response");
  return match[1];
}

export function parseStatusPlayers(response) {
  const players = [];
  for (const line of String(response).split("\n")) {
    const match = line.match(/^#\s*\d+\s+"([^"]*)"\s+(\d+)\s+(\S+)\s+(-?\d+)\s+(\S+)\s+(\d+)\s+(\d+)(?:\s+(.+))?$/);
    if (!match) continue;
    players.push({
      name: match[1],
      userId: Number(match[2]),
      steamId: match[3],
      frags: Number(match[4]),
      time: match[5],
      ping: Number(match[6]),
      loss: Number(match[7]),
      address: match[8] || "",
    });
  }
  return players;
}

export async function rconCommand(host, port, password, command) {
  if (!host) throw new Error("Server network address is unavailable");
  if (!password) throw new Error("RCON password is not configured");
  const socket = dgram.createSocket("udp4");
  try {
    const challengeResponse = receive(socket);
    socket.send(packet("challenge rcon"), port, host);
    const challenge = parseRconChallenge(await challengeResponse);
    const commandResponse = receive(socket, 1200);
    socket.send(packet(`rcon ${challenge} ${quote(password)} ${command}`), port, host);
    try {
      return await commandResponse;
    } catch (error) {
      if (error.message === "RCON response timed out") return "";
      throw error;
    }
  } finally {
    socket.close();
  }
}
