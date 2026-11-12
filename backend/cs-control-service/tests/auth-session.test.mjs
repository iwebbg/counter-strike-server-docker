import assert from "node:assert/strict";
import test from "node:test";
import signout from "../src/controllers/users/rest/signout.mjs";
import { sessionCookieClearOptions, sessionCookieOptions } from "../src/controllers/users/services/sessionCookie.mjs";
import { csrfRequestAllowed } from "../src/utils/Server.mjs";

test("session cookie clear options never preserve the positive max age", () => {
  const request = { secure: false };
  const setOptions = sessionCookieOptions(request);
  const clearOptions = sessionCookieClearOptions(request);

  assert.equal(setOptions.maxAge > 0, true);
  assert.equal(Object.hasOwn(clearOptions, "maxAge"), false);
  assert.deepEqual(clearOptions, {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: false,
  });
});

test("signout remains available without a valid bearer session and clears an absent cookie", async () => {
  assert.equal(signout.bearerAuth, false);
  assert.deepEqual(signout.middlewares, []);

  const request = { cookies: {}, secure: false };
  const response = {
    clearCookie(name, options) {
      this.cleared = { name, options };
    },
    jsonOk(status, message) {
      return { status, message };
    },
  };
  const result = await signout.entryPoint(request, response);

  assert.equal(result.status, 200);
  assert.equal(response.cleared.options.maxAge, undefined);
});

test("CSRF accepts the browser origin when the reverse proxy preserves its public port", () => {
  const request = {
    method: "POST",
    protocol: "http",
    cookies: { cs_control_session: "session" },
    get(name) {
      return {
        host: "localhost:8080",
        origin: "http://localhost:8080",
        "sec-fetch-site": "same-origin",
      }[name];
    },
  };

  assert.equal(csrfRequestAllowed(request), true);
  request.get = (name) =>
    ({ host: "localhost", origin: "http://localhost:8080", "sec-fetch-site": "same-origin" })[name];
  assert.equal(csrfRequestAllowed(request), false);
});
