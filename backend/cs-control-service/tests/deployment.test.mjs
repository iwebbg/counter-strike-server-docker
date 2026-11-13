import assert from "node:assert/strict";
import test from "node:test";
import { previewDeployment } from "../src/controllers/deployment/services/DeploymentService.mjs";

test("previews allowlisted deployment changes without applying them", () => {
  const preview = previewDeployment({ SERVER_MODE: "gungame", MAX_PLAYERS: 20 });
  assert.equal(preview.readOnly, true);
  assert.equal(preview.valid, true);
  assert.match(preview.dotenv, /SERVER_MODE=gungame/);
});

test("rejects unknown deployment keys and reports invalid values", () => {
  assert.throws(() => previewDeployment({ DOCKER_HOST: "tcp://attacker" }), /Unsupported/);
  assert.equal(previewDeployment({ MAX_PLAYERS: 99 }).valid, false);
});
