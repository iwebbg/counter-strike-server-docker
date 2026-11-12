import assert from "node:assert/strict";
import test from "node:test";
import { discoverRests } from "../src/config/server.mjs";

test("discovers REST descriptors using the framework layout", () => {
  const routes = discoverRests();
  assert.ok(routes.some((route) => route.endsWith("/controllers/users/rest/signin.mjs")));
  assert.ok(routes.some((route) => route.endsWith("/controllers/users/rest/session.mjs")));
  assert.deepEqual([...routes].sort(), routes);
});
