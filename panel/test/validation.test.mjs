import test from 'node:test';
import assert from 'node:assert/strict';
import { demuxDockerStream } from '../src/docker.mjs';
import { parseAdminEntries, validateAdmins, validateCreateInput } from '../src/validation.mjs';

test('validates a GunGame server and applies its default map', () => {
  const value = validateCreateInput({ name: 'Arena One', mode: 'gungame', maxPlayers: 20 }, 27015, 27115);
  assert.equal(value.startMap, 'gg_3way');
  assert.equal(value.maxPlayers, 20);
  assert.equal(value.port, null);
});

test('rejects max players outside the GoldSrc limit', () => {
  assert.throws(() => validateCreateInput({ name: 'Bad server', mode: 'classic', maxPlayers: 33 }, 27015, 27115), /between 2 and 32/);
});

test('validates optional admin Steam IDs', () => {
  const value = validateCreateInput({ name: 'Admin server', mode: 'classic', maxPlayers: 16, adminSteamIds: 'STEAM_0:1:123456, STEAM_0:0:654321' }, 27015, 27115);
  assert.deepEqual(value.adminSteamIds, ['STEAM_0:1:123456', 'STEAM_0:0:654321']);
  assert.throws(() => validateCreateInput({ name: 'Bad admin', mode: 'classic', maxPlayers: 16, adminSteamIds: 'root' }, 27015, 27115), /Admin Steam IDs/);
});

test('demultiplexes Docker stdout frames', () => {
  const payload = Buffer.from('server ready\n');
  const header = Buffer.alloc(8);
  header[0] = 1;
  header.writeUInt32BE(payload.length, 4);
  assert.equal(demuxDockerStream(Buffer.concat([header, payload])), 'server ready\n');
});

test('validates, normalizes and parses live admins', () => {
  assert.deepEqual(validateAdmins({ admins: [{ steamId: 'steam_0:1:123', flags: 'ABC' }] }), [
    { steamId: 'STEAM_0:1:123', flags: 'abc' },
  ]);
  assert.deepEqual(parseAdminEntries('STEAM_0:1:123|abc;STEAM_0:0:42|fju'), [
    { steamId: 'STEAM_0:1:123', flags: 'abc' },
    { steamId: 'STEAM_0:0:42', flags: 'fju' },
  ]);
  assert.throws(() => validateAdmins({ admins: [{ steamId: 'STEAM_0:1:123', flags: 'z' }] }), /only a-u/);
  assert.throws(() => validateAdmins({ admins: [
    { steamId: 'STEAM_0:1:123', flags: 'a' },
    { steamId: 'STEAM_0:1:123', flags: 'b' },
  ] }), /Duplicate/);
});
