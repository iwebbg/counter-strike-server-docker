import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRconChallenge } from '../src/rcon.mjs';

test('parses a GoldSource RCON challenge', () => {
  assert.equal(parseRconChallenge('challenge rcon 18472391'), '18472391');
  assert.throws(() => parseRconChallenge('bad response'), /Invalid RCON challenge/);
});
