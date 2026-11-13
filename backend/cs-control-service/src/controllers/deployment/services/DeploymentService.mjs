const allowlist = [
  "SERVER_MODE",
  "SERVER_NAME",
  "MAX_PLAYERS",
  "PORT_RANGE_START",
  "PORT_RANGE_END",
  "PANEL_ALLOWED_NETWORKS",
  "PANEL_DOMAIN",
  "PANEL_HTTPS_PORT",
];

function currentConfiguration() {
  return Object.fromEntries(allowlist.map((key) => [key, process.env[key] || ""]));
}

export function deploymentConfiguration() {
  return {
    readOnly: true,
    allowlist,
    current: currentConfiguration(),
    note: "Preview only. The control panel never writes the host .env file.",
  };
}

export function previewDeployment(changes) {
  const unknown = Object.keys(changes).filter((key) => !allowlist.includes(key));
  if (unknown.length) throw new Error(`Unsupported deployment settings: ${unknown.join(", ")}`);
  const proposed = {
    ...currentConfiguration(),
    ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, String(value)])),
  };
  const warnings = [];
  if (proposed.SERVER_MODE && !["classic", "gungame"].includes(proposed.SERVER_MODE))
    warnings.push("SERVER_MODE must be classic or gungame.");
  const maxPlayers = Number(proposed.MAX_PLAYERS || 24);
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 32)
    warnings.push("MAX_PLAYERS must be between 2 and 32.");
  const portStart = Number(proposed.PORT_RANGE_START || 27015);
  const portEnd = Number(proposed.PORT_RANGE_END || 27115);
  if (!Number.isInteger(portStart) || !Number.isInteger(portEnd) || portStart > portEnd)
    warnings.push("The port range is invalid.");
  return {
    readOnly: true,
    valid: warnings.length === 0,
    warnings,
    current: currentConfiguration(),
    proposed,
    dotenv: allowlist.map((key) => `${key}=${proposed[key]}`).join("\n"),
  };
}
