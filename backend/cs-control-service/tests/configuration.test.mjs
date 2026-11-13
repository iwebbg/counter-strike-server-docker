import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConfiguration } from "../src/controllers/configurationTemplates/services/ConfigurationTemplateService.mjs";
import { configurationDocumentSchema } from "../src/controllers/servers/services/configurationSchema.mjs";
import { validate } from "../src/utils/helpers/validator.mjs";

const configuration = {
  name: "Reusable Classic",
  mode: "classic",
  maxPlayers: 24,
  startMap: "de_dust2",
  maps: ["de_dust2", "de_inferno"],
  port: 27015,
  rconPassword: "must-not-be-exported",
  serverPassword: "must-not-be-exported",
  clearServerPassword: false,
  welcomeMessage: "Welcome",
  warmupEnabled: true,
  warmupSeconds: 45,
  spawnProtectionEnabled: false,
  spawnProtectionSeconds: 3,
  semiclipEnabled: true,
  doubleJumpEnabled: false,
  doubleJumpVelocity: 350,
  afkEnabled: true,
  rtvEnabled: true,
  killstreakEnabled: true,
  killstreakSoundsEnabled: true,
  killstreakHudEnabled: true,
};

test("normalizes reusable configurations without exporting secrets", () => {
  const normalized = normalizeConfiguration(configuration);
  assert.equal(normalized.rconPassword, "");
  assert.equal(normalized.serverPassword, "");
  assert.equal(normalized.name, "Reusable Classic");
  assert.deepEqual(normalized.maps, ["de_dust2", "de_inferno"]);
});

test("accepts only versioned allowlisted configuration documents", () => {
  const safe = normalizeConfiguration(configuration);
  assert.equal(validate({ schemaVersion: 1, configuration: safe }, configurationDocumentSchema), null);
  assert.ok(validate({ schemaVersion: 2, configuration: safe }, configurationDocumentSchema));
  assert.ok(
    validate(
      { schemaVersion: 1, configuration: { ...safe, arbitraryDockerOption: "--privileged" } },
      configurationDocumentSchema,
    ),
  );
});
