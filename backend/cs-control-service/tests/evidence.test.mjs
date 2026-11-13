import assert from "node:assert/strict";
import test from "node:test";
import { evidenceContainerName, safeEvidenceFilename } from "../src/controllers/evidence/services/EvidenceService.mjs";

test("evidence filenames reject traversal and non-demo content", () => {
  assert.equal(safeEvidenceFilename("evidence-2026.dem"), "evidence-2026.dem");
  assert.equal(safeEvidenceFilename("../secret.dem"), null);
  assert.equal(safeEvidenceFilename("evidence.cfg"), null);
});

test("evidence sidecar names are deterministic and Docker safe", () => {
  const name = evidenceContainerName("server-id");
  assert.match(name, /^cs16-hltv-[a-f0-9]{12}$/);
  assert.equal(name, evidenceContainerName("server-id"));
  assert.notEqual(name, evidenceContainerName("another-server"));
});
