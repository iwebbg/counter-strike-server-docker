import test from 'node:test';
import assert from 'node:assert/strict';
import { parseA2SInfo } from "../src/infrastructure/A2S.mjs";

test('parses a protocol 48 A2S info response', () => {
  const strings = Buffer.from('Arena\0gg_3way\0cstrike\0Counter-Strike\0');
  const header = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49, 48]);
  const appId = Buffer.alloc(2);
  appId.writeUInt16LE(10);
  const response = Buffer.concat([header, strings, appId, Buffer.from([3, 24, 1])]);
  assert.deepEqual(parseA2SInfo(response), {
    name: 'Arena',
    map: 'gg_3way',
    players: 3,
    maxPlayers: 24,
    bots: 1,
  });
});
