import assert from "node:assert/strict";
import test from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { ROLES, permissionsForRole } from "../src/auth/permissions.mjs";
import { discoverRests } from "../src/config/server.mjs";

const descriptors = await Promise.all(discoverRests().map(async (url) => (await import(url)).default));
const protectedDescriptors = descriptors.filter(
  (descriptor) => descriptor.bearerAuth && !descriptor.route.startsWith("/v1/users/"),
);

const expectedRoles = new Map([
  ["servers.read", ["owner", "admin", "moderator", "viewer"]],
  ["stats.read", ["owner", "admin", "moderator", "viewer"]],
  ["players.moderate", ["owner", "admin", "moderator"]],
  ["maps.manage", ["owner", "admin", "moderator"]],
  ["moderation.manage", ["owner", "admin", "moderator"]],
  ["servers.operate", ["owner", "admin"]],
  ["servers.manage", ["owner", "admin"]],
  ["admins.manage", ["owner", "admin"]],
  ["backups.manage", ["owner", "admin"]],
  ["seasons.manage", ["owner", "admin"]],
  ["audit.read", ["owner", "admin"]],
  ["operators.manage", ["owner"]],
]);

test("the role matrix covers every protected backend route", () => {
  assert.ok(protectedDescriptors.length >= 30, "expected the complete backend route set");
  const routeKeys = descriptors.map((descriptor) => `${descriptor.method} ${descriptor.route}`);
  assert.equal(new Set(routeKeys).size, routeKeys.length, "duplicate method/route registration");
  for (const descriptor of protectedDescriptors) {
    assert.ok(
      expectedRoles.has(descriptor.permission),
      `missing role expectation for ${descriptor.method} ${descriptor.route} (${descriptor.permission})`,
    );
    assert.ok(
      descriptor.middlewares?.some((middleware) => middleware.name === "checkAuth"),
      `${descriptor.method} ${descriptor.route} is missing checkAuth`,
    );
  }
});

for (const descriptor of protectedDescriptors) {
  for (const role of ROLES) {
    test(`${role}: ${descriptor.method} ${descriptor.route}`, () => {
      const expected = expectedRoles.get(descriptor.permission).includes(role);
      const actual = permissionsForRole(role).includes(descriptor.permission);
      assert.equal(actual, expected, `${role} access mismatch for ${descriptor.permission}`);
    });
  }
}

test("every backend route exposes compilable validation contracts and an entry point", () => {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const descriptor of descriptors) {
    assert.equal(typeof descriptor.entryPoint, "function", `${descriptor.method} ${descriptor.route}`);
    assert.ok(["GET", "POST", "PATCH", "PUT", "DELETE"].includes(descriptor.method));
    for (const location of ["query", "path", "body"]) {
      const schema = descriptor.validation?.[location];
      if (schema && Object.keys(schema).length) {
        assert.doesNotThrow(() => ajv.compile(schema), `${descriptor.method} ${descriptor.route} ${location}`);
      }
    }
  }
});
