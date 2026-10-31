import test from 'node:test';
import assert from 'node:assert/strict';
import { dartFromThrow, makeDart } from '../src/segments.js';
import { MAX_CODE, MIN_CODE, endTurn, newGame, throwDart } from '../src/heist.js';
import { boardCleared } from '../src/turns.js';

const miss = makeDart('Miss');
const single = (n) => makeDart('SingleOuter', n);
const withCode = (game, code) => ({ ...game, code, remaining: code });
const throwAll = (game, ...darts) => darts.reduce(throwDart, game);
const points = (game) => game.players.map((p) => p.points);

test('codes are between 10 and 50, reaching both ends', (t) => {
  for (const [random, expected] of [[0, MIN_CODE], [0.999999, MAX_CODE], [0.5, 30]]) {
    t.mock.method(Math, 'random', () => random);
    assert.equal(newGame(['A']).code, expected);
    t.mock.restoreAll();
  }
  for (let i = 0; i < 300; i++) {
    const { code } = newGame(['A']);
    assert.ok(Number.isInteger(code) && code >= 10 && code <= 50);
  }
});

test('darts take base times multiplier off the code', () => {
  let game = withCode(newGame(['A', 'B']), 50);
  game = throwDart(game, makeDart('Triple', 5));
  assert.equal(game.remaining, 35);
  game = throwDart(game, makeDart('Double', 10));
  assert.equal(game.remaining, 15);
  assert.equal(game.phase, 'throwing');
  assert.equal(throwDart(withCode(newGame(['A', 'B']), 50), single(7)).remaining, 43);
  assert.equal(throwDart(withCode(newGame(['A', 'B']), 50), makeDart('SingleInner', 7)).remaining, 43);
});

test('both bulls count, as 25 and 50', () => {
  assert.equal(throwDart(withCode(newGame(['A', 'B']), 40), makeDart('OuterBull')).remaining, 15);
  const bull = throwDart(withCode(newGame(['A', 'B']), 50), makeDart('InnerBull'));
  assert.equal(bull.remaining, 0);
  assert.equal(bull.last.result, 'looted');
});

test('hitting exactly zero loots the vault for the code’s points', () => {
  const game = throwAll(withCode(newGame(['A', 'B']), 30), makeDart('Triple', 5), makeDart('Triple', 5));
  assert.equal(game.remaining, 0);
  assert.deepEqual(points(game), [30, 0]);
  assert.equal(game.last.result, 'looted');
  assert.equal(game.phase, 'takeout');
});

test('looting early ends the turn, leaving the other darts unused', () => {
  const game = throwDart(withCode(newGame(['A', 'B']), 20), single(20));
  assert.equal(game.phase, 'takeout');
  assert.equal(game.darts.length, 1);
  assert.equal(throwDart(game, single(1)), game);
});

test('going below zero is a bust, worth nothing, and ends the turn', () => {
  const game = throwDart(withCode(newGame(['A', 'B']), 15), single(20));
  assert.equal(game.last.result, 'bust');
  assert.equal(game.remaining, -5);
  assert.deepEqual(points(game), [0, 0]);
  assert.equal(game.phase, 'takeout');
});

test('three darts without reaching zero sets off the alarm, worth nothing', () => {
  const game = throwAll(withCode(newGame(['A', 'B']), 50), single(1), single(1), single(1));
  assert.equal(game.last.result, 'alarm');
  assert.equal(game.remaining, 47);
  assert.deepEqual(points(game), [0, 0]);
  assert.equal(game.phase, 'takeout');
});

test('zero on the third dart still loots', () => {
  const game = throwAll(withCode(newGame(['A', 'B']), 30), single(10), single(10), single(10));
  assert.equal(game.last.result, 'looted');
  assert.deepEqual(points(game), [30, 0]);
});

test('misses and bouncers use a dart but take nothing off', () => {
  const game = throwDart(withCode(newGame(['A', 'B']), 30), miss);
  assert.equal(game.remaining, 30);
  assert.equal(game.darts.length, 1);
  const bouncer = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T20', segmentNumber: 20, bouncer: true });
  assert.equal(throwDart(withCode(newGame(['A', 'B']), 30), bouncer).remaining, 30);
});

test('real throws use their full score', () => {
  const real = dartFromThrow({ bed: 'Double', multiplier: 2, segmentName: 'D8', segmentNumber: 8 });
  assert.equal(throwDart(withCode(newGame(['A', 'B']), 30), real).remaining, 14);
});

test('everyone in a round gets the same code, starting from full', () => {
  let game = withCode(newGame(['A', 'B']), 30);
  game = boardCleared(throwDart(game, single(20)), endTurn);
  assert.equal(game.current, 1);
  assert.equal(game.code, 30);
  assert.equal(game.remaining, 30);
  assert.deepEqual(game.darts, []);
});

test('each new round brings a new code and clears the results', (t) => {
  const values = [0, 0.5];
  t.mock.method(Math, 'random', () => values.shift());
  let game = newGame(['A', 'B']);
  assert.equal(game.code, 10);
  game = endTurn(throwDart(game, single(10)));
  assert.equal(game.roundResults[0], 'looted');
  game = endTurn(throwDart(game, miss));
  assert.equal(game.round, 2);
  assert.equal(game.code, 30);
  assert.deepEqual(game.roundResults, {});
});

test('the round’s results list each player', () => {
  let game = withCode(newGame(['A', 'B', 'C']), 20);
  game = endTurn(throwDart(game, single(20)));
  game = endTurn(throwDart(game, makeDart('Triple', 20)));
  assert.deepEqual(game.roundResults, { 0: 'looted', 1: 'bust' });
});

test('pulling the darts out early counts as the alarm', () => {
  const game = endTurn(throwDart(withCode(newGame(['A', 'B']), 40), single(1)));
  assert.equal(game.roundResults[0], 'alarm');
  assert.equal(game.current, 1);
});

test('ending a turn with no darts does nothing', () => {
  const game = newGame(['A', 'B']);
  assert.equal(endTurn(game), game);
});

test('the most points wins when the rounds run out', () => {
  let game = withCode(newGame(['A', 'B'], { rounds: 1 }), 20);
  game = endTurn(throwDart(game, single(20)));
  game = throwDart(game, makeDart('Triple', 20));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(game.winnerText, 'A wins with 20 points!');
});

test('a draw plays on between the leaders with a new code', (t) => {
  const values = [0, 0.5];
  t.mock.method(Math, 'random', () => values.shift());
  let game = newGame(['A', 'B', 'C'], { rounds: 1 });
  game = endTurn(throwDart(game, single(10)));
  game = endTurn(throwDart(game, single(10)));
  game = throwDart(game, miss);
  game = endTurn(game);
  assert.deepEqual(game.playoff.queue, [0, 1]);
  assert.equal(game.code, 30);
  assert.deepEqual(game.roundResults, {});
  game = endTurn(throwAll(game, single(10), single(20)));
  assert.equal(game.current, 1);
  assert.equal(game.code, 30);
  game = throwDart(game, makeDart('Triple', 20));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.deepEqual(points(game), [40, 10, 0]);
});

test('one player just gets a final score', () => {
  const game = endTurn(throwDart(withCode(newGame(['Solo'], { rounds: 1 }), 20), single(20)));
  assert.equal(game.winnerText, 'Solo finishes with 20 points!');
});
