export const eventProperties = {
  name: { type: "string", minLength: 2, maxLength: 128 },
  serverId: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" },
  dayOfWeek: { type: "integer", minimum: 0, maximum: 6 },
  startTime: { type: "string", pattern: "^(?:[01][0-9]|2[0-3]):[0-5][0-9]$" },
  timezone: { type: "string", minLength: 1, maxLength: 64 },
  durationMinutes: { type: "integer", minimum: 15, maximum: 1440 },
  startMap: { type: "string", pattern: "^[a-zA-Z0-9_]*$", maxLength: 64 },
  enabled: { type: "boolean" },
};

export const eventIdPath = {
  type: "object",
  properties: { id: { type: "string", format: "uuid" } },
  required: ["id"],
  additionalProperties: false,
};
