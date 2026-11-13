import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSIONS, hasPermission, permissionsForRole, permissionsForUser } from "../src/auth/permissions.mjs";
import { discoverRests } from "../src/config/server.mjs";

test("roles expose the intended inherited permission boundaries", () => {
  const viewer = permissionsForRole("viewer");
  const moderator = permissionsForRole("moderator");
  const admin = permissionsForRole("admin");
  const owner = permissionsForRole("owner");

  assert.deepEqual(viewer.sort(), [PERMISSIONS.SERVERS_READ, PERMISSIONS.STATS_READ].sort());
  assert.ok(moderator.includes(PERMISSIONS.PLAYERS_MODERATE));
  assert.ok(moderator.includes(PERMISSIONS.MAPS_MANAGE));
  assert.equal(moderator.includes(PERMISSIONS.SERVERS_OPERATE), false);
  assert.ok(admin.includes(PERMISSIONS.SERVERS_MANAGE));
  assert.ok(admin.includes(PERMISSIONS.AUDIT_READ));
  assert.equal(admin.includes(PERMISSIONS.OPERATORS_MANAGE), false);
  assert.ok(owner.includes(PERMISSIONS.OPERATORS_MANAGE));
});

test("custom operators receive only their explicit permissions", () => {
  const custom = {
    role: "custom",
    customPermissions: [PERMISSIONS.SERVERS_READ, PERMISSIONS.PLAYERS_MODERATE, "unknown.permission"],
  };

  assert.deepEqual(permissionsForUser(custom), [PERMISSIONS.SERVERS_READ, PERMISSIONS.PLAYERS_MODERATE]);
  assert.equal(hasPermission(custom, PERMISSIONS.SERVERS_READ), true);
  assert.equal(hasPermission(custom, PERMISSIONS.MAPS_MANAGE), false);
});

test("owner permissions cannot be reduced by a custom override", () => {
  const owner = { role: "owner", customPermissions: [] };

  assert.ok(permissionsForUser(owner).includes(PERMISSIONS.OPERATORS_MANAGE));
});

test("every authenticated non-session route declares an API permission", async () => {
  const missing = [];
  for (const descriptorUrl of discoverRests()) {
    const descriptor = (await import(descriptorUrl)).default;
    const isUserSessionRoute = descriptor.route.startsWith("/v1/users/");
    if (descriptor.bearerAuth && !isUserSessionRoute && !descriptor.permission) {
      missing.push(`${descriptor.method} ${descriptor.route}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("every authenticated mutation route has an audit action", async () => {
  const missing = [];
  for (const descriptorUrl of discoverRests()) {
    const descriptor = (await import(descriptorUrl)).default;
    if (descriptor.bearerAuth && !["GET"].includes(descriptor.method) && !descriptor.route.startsWith("/v1/users/")) {
      if (!descriptor.audit) missing.push(`${descriptor.method} ${descriptor.route}`);
    }
  }
  assert.deepEqual(missing, []);
});
