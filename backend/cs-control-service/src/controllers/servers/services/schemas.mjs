export function parseInteger(value, name, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return number;
}

export const modeMaps = {
  classic: [
    "de_dust2",
    "de_inferno",
    "de_nuke",
    "de_train",
    "cs_office",
    "de_csgothic",
    "de_mini_train2",
    "de_nuke_fora",
    "de_solitude",
  ],
  gungame: [
    "gg_3way",
    "gg_aztec_VS_dust",
    "gg_buzz",
    "gg_fy_deagle_dustworld",
    "gg_fy_deagle_dustworld3",
    "gg_hideout",
    "gg_inferno",
    "gg_js_cbble",
    "gg_mariocastle_mt",
    "gg_mini_dust2",
    "gg_mini_skilluj",
    "gg_os_arena",
  ],
};

export function validateMapList(value, label = "Maps") {
  if (!Array.isArray(value) || value.length < 1 || value.length > 128) {
    throw new Error(`${label} must contain between 1 and 128 maps`);
  }
  const maps = value.map((map) => String(map || "").trim());
  if (maps.some((map) => !/^[a-zA-Z0-9_]+$/.test(map))) {
    throw new Error(`${label} contains an invalid map name`);
  }
  if (new Set(maps.map((map) => map.toLowerCase())).size !== maps.length) {
    throw new Error(`${label} contains duplicate maps`);
  }
  return maps;
}

export function validateModerationInput(input, action) {
  const reason = String(
    input?.reason || (action === "kick" ? "Removed by an administrator" : "Banned by an administrator"),
  ).trim();
  if (reason.length < 2 || reason.length > 80 || !/^[\p{L}\p{N} .,!?_()\-]+$/u.test(reason)) {
    throw new Error("Reason must contain 2-80 safe printable characters");
  }
  let minutes = null;
  if (action === "ban") minutes = parseInteger(input?.minutes ?? 60, "Ban duration", 0, 525600);
  const scope = action === "ban" ? String(input?.scope || "fleet") : null;
  if (scope && scope !== "fleet" && scope !== "server") throw new Error("Ban scope must be fleet or server");
  return { reason, minutes, scope };
}

export function validateAdmins(input) {
  if (!Array.isArray(input?.admins) || input.admins.length > 32) {
    throw new Error("Admins must be an array containing at most 32 entries");
  }
  const seen = new Set();
  return input.admins.map((entry) => {
    const steamId = String(entry?.steamId || "")
      .trim()
      .toUpperCase();
    const flags = String(entry?.flags || "")
      .trim()
      .toLowerCase();
    if (!/^STEAM_[0-9]+:[01]:[0-9]+$/.test(steamId)) {
      throw new Error(`Invalid Steam ID: ${steamId || "(empty)"}`);
    }
    if (!/^[a-u]+$/.test(flags)) {
      throw new Error(`Invalid access flags for ${steamId}; use only a-u and never z`);
    }
    if (seen.has(steamId)) throw new Error(`Duplicate admin: ${steamId}`);
    seen.add(steamId);
    return { steamId, flags };
  });
}

export function parseAdminEntries(value) {
  if (!String(value || "").trim()) return [];
  return validateAdmins({
    admins: String(value)
      .split(";")
      .filter(Boolean)
      .map((entry) => {
        const [steamId, flags, unexpected] = entry.split("|");
        if (unexpected !== undefined) throw new Error("Invalid stored admin entry");
        return { steamId, flags };
      }),
  });
}

export function validateCreateInput(input, portStart, portEnd) {
  const name = String(input.name || "").trim();
  if (name.length < 2 || name.length > 48 || /[\u0000-\u001f]/.test(name)) {
    throw new Error("Name must be between 2 and 48 printable characters");
  }

  const mode = input.mode === "gungame" ? "gungame" : input.mode === "classic" ? "classic" : null;
  if (!mode) throw new Error("Mode must be classic or gungame");

  const maxPlayers = parseInteger(input.maxPlayers, "Max players", 2, 32);
  const startMap = String(input.startMap || (mode === "gungame" ? "gg_3way" : "de_dust2")).trim();
  if (!/^[a-zA-Z0-9_]+$/.test(startMap)) throw new Error("Invalid start map");
  const maps = validateMapList(input.maps === undefined ? modeMaps[mode] : input.maps, "Map rotation");
  const wrongCategory = maps.filter((map) => !modeMaps[mode].includes(map));
  if (wrongCategory.length) throw new Error(`Maps do not belong to the ${mode} category: ${wrongCategory.join(", ")}`);
  if (!maps.includes(startMap)) throw new Error("Start map must be selected in the map rotation");

  let port = null;
  if (input.port !== undefined && input.port !== null && String(input.port).trim() !== "") {
    port = parseInteger(input.port, "Port", portStart, portEnd);
  }

  for (const [key, label] of [
    ["rconPassword", "RCON password"],
    ["serverPassword", "Server password"],
  ]) {
    const value = String(input[key] || "");
    if (value.length > 64 || /[\u0000-\u001f]/.test(value)) throw new Error(`${label} is invalid`);
  }

  const adminSteamIds = String(input.adminSteamIds || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (adminSteamIds.length > 32 || adminSteamIds.some((steamId) => !/^STEAM_[0-9]+:[01]:[0-9]+$/.test(steamId))) {
    throw new Error("Admin Steam IDs must be comma-separated values like STEAM_0:1:123456");
  }

  return {
    name,
    mode,
    maxPlayers,
    startMap,
    maps,
    port,
    rconPassword: String(input.rconPassword || ""),
    serverPassword: String(input.serverPassword || ""),
    adminSteamIds,
    startImmediately: input.startImmediately !== false,
  };
}

export function validateEditInput(input, portStart, portEnd) {
  const values = validateCreateInput(
    {
      ...input,
      adminSteamIds: "",
      startImmediately: false,
    },
    portStart,
    portEnd,
  );

  return {
    name: values.name,
    mode: values.mode,
    maxPlayers: values.maxPlayers,
    startMap: values.startMap,
    maps: values.maps,
    port: values.port,
    rconPassword: values.rconPassword,
    serverPassword: values.serverPassword,
    clearServerPassword: input.clearServerPassword === true,
  };
}

const mapResourceExtensions = new Map([
  [".bsp", "maps"],
  [".res", "maps"],
  [".nav", "maps"],
  [".mdl", "models"],
  [".wav", "sound"],
  [".mp3", "sound"],
  [".spr", "sprites"],
  [".tga", "gfx"],
  [".bmp", "gfx"],
]);

function normalizeMapResourcePath(value) {
  const raw = String(value || "").replaceAll("\\", "/");
  const parts = raw.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === ".." || /[\u0000-\u001f]/.test(part))) {
    throw new Error(`Invalid map resource path: ${raw || "(empty)"}`);
  }
  const lowerParts = parts.map((part) => part.toLowerCase());
  const cstrikeIndex = lowerParts.lastIndexOf("cstrike");
  let relative = cstrikeIndex === -1 ? null : parts.slice(cstrikeIndex + 1).join("/");
  if (!relative) {
    const anchor = lowerParts.findIndex((part) => ["maps", "models", "sound", "sprites", "gfx"].includes(part));
    if (anchor !== -1) relative = parts.slice(anchor).join("/");
  }

  const filename = parts.at(-1);
  const extensionIndex = filename.lastIndexOf(".");
  const extension = extensionIndex === -1 ? "" : filename.slice(extensionIndex).toLowerCase();
  if (!relative && extension === ".wad") relative = filename;
  if (!relative && mapResourceExtensions.has(extension)) {
    relative = `${mapResourceExtensions.get(extension)}/${filename}`;
  }
  if (!relative || relative.length > 76) throw new Error(`Unsupported or overly long map resource path: ${raw}`);

  const normalized = relative.replaceAll("\\", "/");
  const lower = normalized.toLowerCase();
  const allowed =
    /^(maps\/(?:[^/]+\.(?:bsp|res|txt|nav))|models\/(?:.+\.mdl)|sound\/(?:.+\.(?:wav|mp3))|sprites\/(?:.+\.(?:spr|txt))|gfx\/(?:.+\.(?:tga|bmp))|[^/]+\.wad)$/i;
  if (!allowed.test(normalized) || lower.endsWith(".ztmp")) {
    throw new Error(`Unsupported map resource: ${raw}`);
  }
  return normalized;
}

export function validateMapUpload(input) {
  const mode = input?.mode === "classic" || input?.mode === "gungame" ? input.mode : null;
  if (!mode) throw new Error("Map upload mode must be classic or gungame");
  if (!Array.isArray(input?.files) || input.files.length < 1 || input.files.length > 128) {
    throw new Error("Map package must contain between 1 and 128 files");
  }
  const files = [];
  const paths = new Set();
  let totalBytes = 0;
  for (const entry of input.files) {
    const path = normalizeMapResourcePath(entry?.path);
    const encoded = String(entry?.content || "");
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      throw new Error(`Invalid base64 content for ${path}`);
    }
    const content = Buffer.from(encoded, "base64");
    if (!content.length) throw new Error(`Empty map resource: ${path}`);
    totalBytes += content.length;
    if (totalBytes > 32 * 1024 * 1024) throw new Error("Map package exceeds the 32 MiB upload limit");
    const key = path.toLowerCase();
    if (paths.has(key)) throw new Error(`Duplicate map resource: ${path}`);
    paths.add(key);
    files.push({ path, content });
  }
  const maps = files.filter((file) => /^maps\/[^/]+\.bsp$/i.test(file.path)).map((file) => file.path.slice(5, -4));
  if (!maps.length) throw new Error("Map package must contain at least one maps/*.bsp file");
  if (maps.some((map) => !/^[a-zA-Z0-9_]+$/.test(map)))
    throw new Error("Uploaded map names contain unsupported characters");
  return { mode, files, maps };
}
