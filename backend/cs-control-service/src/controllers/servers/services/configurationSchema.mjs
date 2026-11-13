const mapList = {
  type: "array",
  minItems: 1,
  maxItems: 128,
  items: { type: "string", pattern: "^[a-zA-Z0-9_]+$" },
};

export const editableConfigurationProperties = {
  name: { type: "string", minLength: 2, maxLength: 48 },
  mode: { type: "string", enum: ["classic", "gungame"] },
  maxPlayers: { type: "integer", minimum: 2, maximum: 32 },
  startMap: { type: "string", pattern: "^[a-zA-Z0-9_]+$" },
  maps: mapList,
  port: { anyOf: [{ type: "integer" }, { type: "null" }, { type: "string", maxLength: 5 }] },
  rconPassword: { type: "string", maxLength: 64 },
  serverPassword: { type: "string", maxLength: 64 },
  clearServerPassword: { type: "boolean" },
  welcomeMessage: { type: "string", maxLength: 160 },
  warmupEnabled: { type: "boolean" },
  warmupSeconds: { type: "integer", minimum: 0, maximum: 600 },
  spawnProtectionEnabled: { type: "boolean" },
  spawnProtectionSeconds: { type: "number", minimum: 0, maximum: 30 },
  semiclipEnabled: { type: "boolean" },
  doubleJumpEnabled: { type: "boolean" },
  doubleJumpVelocity: { type: "number", minimum: 100, maximum: 1000 },
  afkEnabled: { type: "boolean" },
  rtvEnabled: { type: "boolean" },
  killstreakEnabled: { type: "boolean" },
  killstreakSoundsEnabled: { type: "boolean" },
  killstreakHudEnabled: { type: "boolean" },
};

export const editableConfigurationRequired = [
  "name",
  "mode",
  "maxPlayers",
  "startMap",
  "maps",
  "welcomeMessage",
  "warmupEnabled",
  "warmupSeconds",
  "spawnProtectionEnabled",
  "spawnProtectionSeconds",
  "semiclipEnabled",
  "doubleJumpEnabled",
  "doubleJumpVelocity",
  "afkEnabled",
  "rtvEnabled",
  "killstreakEnabled",
  "killstreakSoundsEnabled",
  "killstreakHudEnabled",
];

export const editableConfigurationSchema = {
  type: "object",
  properties: editableConfigurationProperties,
  required: editableConfigurationRequired,
  additionalProperties: false,
};

export const configurationDocumentSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "integer", const: 1 },
    exportedAt: { type: "string", format: "date-time" },
    configuration: editableConfigurationSchema,
  },
  required: ["schemaVersion", "configuration"],
  additionalProperties: false,
};
