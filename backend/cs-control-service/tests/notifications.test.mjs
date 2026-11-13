import assert from "node:assert/strict";
import test from "node:test";
import { discordPayload, validDiscordWebhook } from "../src/infrastructure/DiscordNotifier.mjs";
import { ipAllowed } from "../src/utils/Server.mjs";
import {
  trustedSsoEmail,
  trustedSsoEnabled,
  trustedSsoSecretMatches,
} from "../src/controllers/users/services/trustedSso.mjs";

test("accepts only Discord HTTPS webhook endpoints", () => {
  assert.equal(validDiscordWebhook("https://discord.com/api/webhooks/123/token"), true);
  assert.equal(validDiscordWebhook("http://discord.com/api/webhooks/123/token"), false);
  assert.equal(validDiscordWebhook("https://example.com/api/webhooks/123/token"), false);
});

test("Discord payload avoids mentions and exposes only safe audit context", () => {
  const payload = discordPayload({ action: "server.restart", status: "success", serverId: "server-1" }, "Owner");
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
  assert.equal(payload.embeds[0].fields[0].value, "Owner");
  assert.equal(JSON.stringify(payload).includes("password"), false);
});

test("optional IP allowlist normalizes IPv4-mapped addresses", () => {
  assert.equal(ipAllowed("::ffff:127.0.0.1", "127.0.0.1,10.0.0.2"), true);
  assert.equal(ipAllowed("10.0.0.3", "127.0.0.1,10.0.0.2"), false);
  assert.equal(ipAllowed("10.0.0.3", ""), true);
});

test("trusted SSO requires explicit enablement and a timing-safe shared secret", () => {
  const environment = { SSO_ENABLED: "1", SSO_SHARED_SECRET: "long-test-secret" };
  assert.equal(trustedSsoEnabled(environment), true);
  assert.equal(trustedSsoSecretMatches("long-test-secret", environment), true);
  assert.equal(trustedSsoSecretMatches("wrong", environment), false);
  assert.equal(trustedSsoEnabled({ SSO_ENABLED: "0", SSO_SHARED_SECRET: "long-test-secret" }), false);
});

test("trusted SSO reads only a safe configured identity header", () => {
  const request = { get: (name) => ({ "x-forwarded-user": " Admin@Example.COM " })[name] };
  assert.equal(trustedSsoEmail(request, { SSO_EMAIL_HEADER: "x-forwarded-user" }), "admin@example.com");
  assert.equal(trustedSsoEmail(request, { SSO_EMAIL_HEADER: "bad header" }), "");
});
