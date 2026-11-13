import assert from "node:assert/strict";
import test from "node:test";
import { buildManagedResourceInventory } from "../src/controllers/managedResources/services/ManagedResourceService.mjs";

const inspect = (serverId, running = true) => ({
  Id: `${serverId}-container`,
  Name: `/cs16-instance-${serverId}`,
  Config: {
    Env: [`SERVER_ID=${serverId}`, "SERVER_NAME=Arena", "SERVER_MODE=classic"],
    Labels: { "com.cs16.managed-by": "panel", "com.cs16.instance-id": serverId },
  },
  State: { Running: running, Paused: false },
});

const volume = (serverId, kind, size) => ({
  serverId,
  kind,
  name: `cs16_${serverId}_${kind}`,
  size,
  refCount: 0,
});

test("managed resource inventory classifies every lifecycle state", () => {
  const result = buildManagedResourceInventory({
    inspections: [inspect("managed")],
    definitions: [
      { server_id: "managed", desired_state: "running", enabled: 1 },
      { server_id: "missing", desired_state: "paused", enabled: 1, last_error: null },
    ],
    registry: [
      { server_id: "legacy", display_name: "Old arena", mode: "classic", max_players: 24 },
      { server_id: "stale", display_name: "Stale", mode: "classic", max_players: 16 },
    ],
    volumes: [volume("legacy", "data", 100), volume("legacy", "logs", 50), volume("orphan", "data", 25)],
  });
  assert.deepEqual(Object.fromEntries(result.resources.map((entry) => [entry.serverId, entry.classification])), {
    legacy: "legacy",
    managed: "managed",
    missing: "recoverable",
    orphan: "orphaned",
    stale: "stale-registry",
  });
  assert.deepEqual(result.summary, { total: 5, recoverable: 1, retained: 2, reclaimableBytes: 175 });
});

test("compose containers are excluded from the panel resource inventory", () => {
  const compose = inspect("compose");
  compose.Config.Labels["com.cs16.managed-by"] = "compose";
  const result = buildManagedResourceInventory({ inspections: [compose] });
  assert.equal(result.resources.length, 0);
});
