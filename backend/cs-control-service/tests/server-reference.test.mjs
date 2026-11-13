import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { DockerError } from "../src/infrastructure/Docker.mjs";
import { resolveControlledServer } from "../src/controllers/servers/services/ServersService.mjs";

const containerId = "a".repeat(64);
const controlled = (id = containerId, serverId = "arena-1") => ({
  Id: id,
  Config: {
    Env: [`SERVER_ID=${serverId}`],
    Labels: { "com.cs16.controlled": "true", "com.cs16.instance-id": serverId },
  },
});

function fakeDocker(inspections, direct = new Map()) {
  return {
    async request(method, path) {
      assert.equal(method, "GET");
      if (path.startsWith("/containers/json?")) return inspections.map(({ Id }) => ({ Id }));
      const id = path.match(/^\/containers\/([^/]+)\/json$/)?.[1];
      if (direct.has(id)) return direct.get(id);
      const inspect = inspections.find((entry) => entry.Id === id);
      if (inspect) return inspect;
      throw new DockerError("missing", 404, "No such container");
    },
  };
}

test("resolves a stable SERVER_ID to the current Docker container", async () => {
  const inspect = controlled();
  assert.equal(await resolveControlledServer(fakeDocker([inspect]), "arena-1"), inspect);
});

test("keeps full and legacy Docker container IDs backward compatible", async () => {
  const inspect = controlled();
  const docker = fakeDocker(
    [inspect],
    new Map([
      [containerId, inspect],
      [containerId.slice(0, 12), inspect],
    ]),
  );
  assert.equal(await resolveControlledServer(docker, containerId), inspect);
  assert.equal(await resolveControlledServer(docker, containerId.slice(0, 12)), inspect);
});

test("rejects invalid, missing, duplicate, and uncontrolled references", async () => {
  await assert.rejects(() => resolveControlledServer(fakeDocker([]), "bad/id"), { code: "INVALID_SERVER_ID" });
  await assert.rejects(() => resolveControlledServer(fakeDocker([]), "missing-server"), { code: "SERVER_NOT_FOUND" });
  await assert.rejects(
    () => resolveControlledServer(fakeDocker([controlled("a".repeat(64)), controlled("b".repeat(64))]), "arena-1"),
    { code: "DUPLICATE_SERVER_ID" },
  );
  const inspect = controlled();
  inspect.Config.Labels["com.cs16.controlled"] = "false";
  await assert.rejects(() => resolveControlledServer(fakeDocker([inspect]), "arena-1"), /not managed/);
});

test("public server operations never pass the logical route id to Docker helpers", async () => {
  const source = await fs.readFile(
    new URL("../src/controllers/servers/services/ServersService.mjs", import.meta.url),
    "utf8",
  );
  const directDockerReferences = source.match(/`\/containers\/\$\{id\}/g) || [];
  assert.equal(directDockerReferences.length, 1, "only the backward-compatible resolver may inspect by route id");
  const publicOperations = source.slice(source.indexOf("export async function serverAction"));
  for (const forbidden of [
    "readAdmins(id, inspect)",
    "reloadAdmins(id, inspect",
    "readMaps(id, inspect)",
    "saveMaps(id, inspect",
    "categorizedMaps(id, inspect)",
    "moderatePlayer(id, inspect",
  ]) {
    assert.equal(publicOperations.includes(forbidden), false, `logical id leaked into ${forbidden}`);
  }
});
