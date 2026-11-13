import assert from "node:assert/strict";
import test from "node:test";
import {
  evidenceContainerName,
  evidenceRetentionSettings,
  safeEvidenceFilename,
} from "../src/controllers/evidence/services/EvidenceService.mjs";

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

test("evidence retention settings use safe bounded integers", () => {
  assert.deepEqual(evidenceRetentionSettings({}), { evidenceDays: 30, evidenceCount: 50, logDays: 30 });
  assert.deepEqual(
    evidenceRetentionSettings({
      EVIDENCE_RETENTION_DAYS: "0",
      EVIDENCE_RETENTION_COUNT: "999999",
      SERVER_LOG_RETENTION_DAYS: "invalid",
    }),
    { evidenceDays: 1, evidenceCount: 10000, logDays: 30 },
  );
});
