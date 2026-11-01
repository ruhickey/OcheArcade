import test from 'node:test';
import assert from 'node:assert/strict';
import { toPlayer } from '../src/players.js';
import { GAMES } from '../src/games.js';

test('a bare name is not a beginner', () => {
  assert.deepEqual(toPlayer('A'), { name: 'A', beginner: false });
});

test('a player keeps their beginner setting, and only true counts', () => {
  assert.deepEqual(toPlayer({ name: 'A', beginner: true }), { name: 'A', beginner: true });
  assert.deepEqual(toPlayer({ name: 'A', beginner: 'yes' }), { name: 'A', beginner: false });
});

test('every game keeps each player’s setting in the right seat', () => {
  for (const definition of Object.values(GAMES)) {
    const { players } = definition.newGame([{ name: 'A', beginner: false }, { name: 'B', beginner: true }]);
    assert.deepEqual(players.map((p) => p.beginner), [false, true], definition.id);
  }
});
