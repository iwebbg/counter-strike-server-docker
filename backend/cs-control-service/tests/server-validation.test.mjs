import test from "node:test";
import assert from "node:assert/strict";
import { demuxDockerStream } from "../src/infrastructure/Docker.mjs";
import {
  parseAdminEntries,
  validateAdmins,
  validateCreateInput,
  validateEditInput,
  validateMapList,
  validateMapUpload,
  validateModerationInput,
} from "../src/controllers/servers/services/schemas.mjs";

test("validates a GunGame server and applies its default map", () => {
  const value = validateCreateInput({ name: "Arena One", mode: "gungame", maxPlayers: 20 }, 27015, 27115);
  assert.equal(value.startMap, "gg_3way");
  assert.equal(value.maxPlayers, 20);
  assert.equal(value.port, null);
  assert.ok(value.maps.includes("gg_3way"));
});

test("validates moderation reasons and ban durations", () => {
  assert.deepEqual(validateModerationInput({ reason: "Repeated team killing", minutes: 60 }, "ban"), {
    reason: "Repeated team killing",
    minutes: 60,
    scope: "fleet",
  });
  assert.equal(validateModerationInput({ reason: "Map exploit", minutes: 30, scope: "server" }, "ban").scope, "server");
  assert.throws(() => validateModerationInput({ reason: "bad; quit", minutes: 10 }, "ban"), /safe printable/);
  assert.throws(() => validateModerationInput({ reason: "Cheating", minutes: -1 }, "ban"), /between 0 and 525600/);
  assert.throws(() => validateModerationInput({ reason: "Cheating", minutes: 60, scope: "planet" }, "ban"), /scope/);
});

test("validates map rotations and requires the start map", () => {
  assert.deepEqual(validateMapList(["de_dust2", "de_nuke"]), ["de_dust2", "de_nuke"]);
  assert.throws(() => validateMapList([]), /between 1 and 128/);
  assert.throws(() => validateMapList(["de_dust2", "de_dust2"]), /duplicate/);
  assert.throws(
    () =>
      validateCreateInput(
        {
          name: "Map server",
          mode: "classic",
          maxPlayers: 16,
          startMap: "de_dust2",
          maps: ["de_nuke"],
        },
        27015,
        27115,
      ),
    /Start map must be selected/,
  );
  assert.throws(
    () =>
      validateCreateInput(
        {
          name: "Mixed server",
          mode: "gungame",
          maxPlayers: 16,
          startMap: "gg_3way",
          maps: ["gg_3way", "de_dust2"],
        },
        27015,
        27115,
      ),
    /do not belong to the gungame category/,
  );
});

test("rejects max players outside the GoldSrc limit", () => {
  assert.throws(
    () => validateCreateInput({ name: "Bad server", mode: "classic", maxPlayers: 33 }, 27015, 27115),
    /between 2 and 32/,
  );
});

test("validates optional admin Steam IDs", () => {
  const value = validateCreateInput(
    { name: "Admin server", mode: "classic", maxPlayers: 16, adminSteamIds: "STEAM_0:1:123456, STEAM_0:0:654321" },
    27015,
    27115,
  );
  assert.deepEqual(value.adminSteamIds, ["STEAM_0:1:123456", "STEAM_0:0:654321"]);
  assert.throws(
    () =>
      validateCreateInput({ name: "Bad admin", mode: "classic", maxPlayers: 16, adminSteamIds: "root" }, 27015, 27115),
    /Admin Steam IDs/,
  );
});

test("validates editable server settings without changing blank passwords", () => {
  const value = validateEditInput(
    {
      name: "Edited Arena",
      mode: "gungame",
      maxPlayers: 18,
      startMap: "gg_3way",
      maps: ["gg_3way", "gg_buzz"],
      port: 27016,
      rconPassword: "",
      serverPassword: "",
      clearServerPassword: true,
    },
    27015,
    27115,
  );
  assert.equal(value.maxPlayers, 18);
  assert.equal(value.rconPassword, "");
  assert.equal(value.clearServerPassword, true);
  assert.deepEqual(value.maps, ["gg_3way", "gg_buzz"]);
});

test("normalizes and validates extracted custom map packages", () => {
  const payload = validateMapUpload({
    mode: "gungame",
    files: [
      { path: "my-package/cstrike/maps/gg_custom_test.bsp", content: Buffer.from("bsp-data").toString("base64") },
      { path: "my-package/cstrike/sound/custom/test.wav", content: Buffer.from("wav-data").toString("base64") },
      { path: "my-package/custom.wad", content: Buffer.from("wad-data").toString("base64") },
    ],
  });
  assert.deepEqual(payload.maps, ["gg_custom_test"]);
  assert.deepEqual(
    payload.files.map((file) => file.path),
    ["maps/gg_custom_test.bsp", "sound/custom/test.wav", "custom.wad"],
  );
  assert.throws(
    () =>
      validateMapUpload({
        mode: "classic",
        files: [{ path: "../server.cfg", content: Buffer.from("bad").toString("base64") }],
      }),
    /Invalid map resource path/,
  );
});

test("demultiplexes Docker stdout frames", () => {
  const payload = Buffer.from("server ready\n");
  const header = Buffer.alloc(8);
  header[0] = 1;
  header.writeUInt32BE(payload.length, 4);
  assert.equal(demuxDockerStream(Buffer.concat([header, payload])), "server ready\n");
});

test("validates, normalizes and parses live admins", () => {
  assert.deepEqual(validateAdmins({ admins: [{ steamId: "steam_0:1:123", flags: "ABC" }] }), [
    { steamId: "STEAM_0:1:123", flags: "abc" },
  ]);
  assert.deepEqual(parseAdminEntries("STEAM_0:1:123|abc;STEAM_0:0:42|fju"), [
    { steamId: "STEAM_0:1:123", flags: "abc" },
    { steamId: "STEAM_0:0:42", flags: "fju" },
  ]);
  assert.throws(() => validateAdmins({ admins: [{ steamId: "STEAM_0:1:123", flags: "z" }] }), /only a-u/);
  assert.throws(
    () =>
      validateAdmins({
        admins: [
          { steamId: "STEAM_0:1:123", flags: "a" },
          { steamId: "STEAM_0:1:123", flags: "b" },
        ],
      }),
    /Duplicate/,
  );
});
