import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, newBullOff, rankedPlayers, throwDart } from '../src/bulloff.js';

const play = (bullOff, distance) => advance(throwDart(bullOff, { distance }));
const rankedNames = (bullOff) => rankedPlayers(bullOff).map((player) => player.name);

test('beginners stay marked after the ranking reorders them', () => {
  let b = newBullOff([{ name: 'A', beginner: true }, { name: 'B', beginner: false }]);
  b = play(play(b, 0.5), 0.1);
  assert.deepEqual(rankedPlayers(b), [{ name: 'B', beginner: false }, { name: 'A', beginner: true }]);
});

test('everyone throws once and the closest ranks first', () => {
  let b = newBullOff(['A', 'B', 'C']);
  b = play(b, 0.5);
  b = play(b, 0.1);
  assert.equal(b.phase, 'throwing');
  b = play(b, 0.9);
  assert.equal(b.phase, 'done');
  assert.deepEqual(rankedNames(b), ['B', 'A', 'C']);
});

test('the next player waits until the dart is out', () => {
  let b = throwDart(newBullOff(['A', 'B']), { distance: 0.5 });
  assert.equal(b.phase, 'takeout');
  const second = throwDart(b, { distance: 0.1 });
  assert.equal(second, b);
  assert.equal(advance(b).queue[advance(b).position], 1);
});

test('only tied players rethrow, and they stay in their place', () => {
  let b = newBullOff(['A', 'B', 'C']);
  b = play(play(play(b, 0.02), 0.02), 0.5);
  assert.equal(b.phase, 'throwing');
  assert.equal(b.round, 2);
  assert.deepEqual(b.queue, [0, 1]);
  b = play(play(b, 0.4), 0.3);
  assert.equal(b.phase, 'done');
  assert.deepEqual(rankedNames(b), ['B', 'A', 'C']);
});

test('a dart with no distance loses to any measured dart', () => {
  let b = newBullOff(['A', 'B']);
  b = play(play(b, null), 1.1);
  assert.deepEqual(rankedNames(b), ['B', 'A']);
});

test('two darts with no distance rethrow', () => {
  let b = newBullOff(['A', 'B']);
  b = play(play(b, null), null);
  assert.equal(b.phase, 'throwing');
  assert.deepEqual(b.queue, [0, 1]);
});
