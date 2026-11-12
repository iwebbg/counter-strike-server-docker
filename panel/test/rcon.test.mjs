import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRconChallenge, parseStatusPlayers } from '../src/rcon.mjs';

test('parses a GoldSource RCON challenge', () => {
  assert.equal(parseRconChallenge('challenge rcon 18472391'), '18472391');
  assert.throws(() => parseRconChallenge('bad response'), /Invalid RCON challenge/);
});

test('parses GoldSource status players with quoted names', () => {
  const output = '#      name userid uniqueid frag time ping loss adr\n# 1 "Player One" 7 STEAM_0:1:123456 12 00:42 35 0 10.0.0.1:27005\n2 users';
  assert.deepEqual(parseStatusPlayers(output), [{
    name: 'Player One', userId: 7, steamId: 'STEAM_0:1:123456', frags: 12, time: '00:42', ping: 35, loss: 0, address: '10.0.0.1:27005',
  }]);
});
