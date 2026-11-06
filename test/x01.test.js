import test from 'node:test';
import assert from 'node:assert/strict';
import { dartFromThrow, makeDart } from '../src/segments.js';
import { endTurn, newGame, threeDartAverage, throwDart } from '../src/x01.js';
import { boardCleared } from '../src/turns.js';

const miss = makeDart('Miss');
const single = (n) => makeDart('SingleOuter', n);
const double = (n) => makeDart('Double', n);
const triple = (n) => makeDart('Triple', n);
const bull = makeDart('InnerBull');
const throwAll = (game, ...darts) => darts.reduce(throwDart, game);
const remaining = (game) => game.players.map((p) => p.remaining);
// Puts the current player on a score, as if the turn started there.
const leave = (game, score) => ({
  ...game,
  turnStart: score,
  players: game.players.map((p, i) => (i === game.current ? { ...p, remaining: score } : p)),
});

test('both starting scores, with 501 the default', () => {
  assert.deepEqual(remaining(newGame(['A', 'B'])), [501, 501]);
  assert.deepEqual(remaining(newGame(['A', 'B'], { start: 301 })), [301, 301]);
});

test('darts take their full score off', () => {
  const game = throwAll(newGame(['A', 'B']), triple(20), single(5), makeDart('OuterBull'));
  assert.deepEqual(remaining(game), [411, 501]);
  assert.equal(game.phase, 'takeout');
  assert.equal(throwDart(game, single(1)), game);
});

test('the turn passes on after the darts come out', () => {
  let game = throwAll(newGame(['A', 'B']), triple(20), triple(20), triple(20));
  game = boardCleared(game, endTurn);
  assert.equal(game.current, 1);
  assert.equal(game.turnStart, 501);
  assert.deepEqual(game.darts, []);
  game = boardCleared(throwDart(game, single(1)), endTurn);
  assert.equal(game.current, 0);
  assert.equal(game.turnStart, 321);
});

test('a double finishes the leg', () => {
  const game = throwDart(leave(newGame(['A', 'B']), 40), double(20));
  assert.equal(game.players[0].remaining, 0);
  assert.equal(game.players[0].legs, 1);
  assert.equal(game.last.result, 'leg');
  assert.equal(game.phase, 'takeout');
});

test('the bull counts as a double for the finish', () => {
  const game = throwDart(leave(newGame(['A', 'B']), 50), bull);
  assert.equal(game.last.result, 'leg');
});

test('zero without a double is bust', () => {
  for (const dart of [single(20), triple(10), makeDart('OuterBull')]) {
    const score = dart.points;
    const game = throwDart(leave(newGame(['A', 'B']), score), dart);
    assert.equal(game.last.result, 'bust');
    assert.equal(game.players[0].remaining, score);
    assert.equal(game.phase, 'takeout');
  }
});

test('going below zero or leaving 1 is bust, and the whole turn comes off', () => {
  let game = throwAll(leave(newGame(['A', 'B']), 60), single(20), single(20));
  assert.equal(game.players[0].remaining, 20);
  game = throwDart(game, single(19));
  assert.equal(game.last.result, 'bust');
  assert.equal(game.players[0].remaining, 60);
  assert.equal(game.last.remaining, 60);

  const below = throwDart(leave(newGame(['A', 'B']), 30), triple(20));
  assert.equal(below.last.result, 'bust');
  assert.equal(below.players[0].remaining, 30);
});

test('a bust still counts its darts in the average, but not its points', () => {
  const game = throwAll(leave(newGame(['A', 'B']), 60), single(20), single(20), single(19));
  assert.equal(game.players[0].dartsThrown, 3);
  assert.equal(game.players[0].pointsScored, 0);
});

test('the average is per three darts', () => {
  const game = throwAll(newGame(['A', 'B']), triple(20), triple(20), single(20));
  assert.equal(threeDartAverage(game.players[0]), 140);
});

test('the next leg starts everyone again, with the next player throwing first', () => {
  let game = newGame(['A', 'B', 'C']);
  game = throwDart(leave(game, 40), double(20));
  game = endTurn(game);
  assert.deepEqual(remaining(game), [501, 501, 501]);
  assert.equal(game.current, 1);
  assert.equal(game.leg, 2);
  assert.deepEqual(game.players.map((p) => p.legs), [1, 0, 0]);
  game = endTurn(throwDart(leave(game, 40), double(20)));
  assert.equal(game.current, 2);
});

test('the first to the legs wins a single-set match', () => {
  let game = newGame(['A', 'B'], { legs: 2 });
  game = endTurn(throwDart(leave(game, 40), double(20)));
  game = endTurn(throwDart(game, miss));
  game = throwDart(leave(game, 40), double(20));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(game.last.result, 'match');
  assert.equal(game.winnerText, 'A wins the match!');
  assert.equal(game.players[0].legs, 2);
});

test('winning the legs wins a set, and the legs start again', () => {
  let game = newGame(['A', 'B'], { sets: 2, legs: 1 });
  game = throwDart(leave(game, 40), double(20));
  assert.equal(game.last.result, 'set');
  assert.equal(game.phase, 'takeout');
  assert.equal(game.players[0].sets, 1);
  assert.equal(game.players[0].legs, 0);
  game = endTurn(game);
  assert.equal(game.set, 2);
  assert.equal(game.leg, 1);
  assert.equal(game.current, 1);
  game = throwDart(leave(game, 40), double(20));
  assert.equal(game.last.result, 'set');
  game = endTurn(game);
  game = throwDart(leave(game, 40), double(20));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.deepEqual(game.players.map((p) => p.sets), [2, 1]);
});

test('double in scores nothing until a double or the bull', () => {
  let game = newGame(['A', 'B'], { in: 'Double in' });
  game = throwAll(game, triple(20), single(20));
  assert.equal(game.players[0].remaining, 501);
  assert.equal(game.last.result, 'closed');
  game = throwDart(game, double(10));
  assert.equal(game.players[0].remaining, 481);
  assert.equal(game.players[0].opened, true);
  assert.equal(game.last.opening, true);
  game = endTurn(game);
  game = throwDart(game, bull);
  assert.equal(game.players[1].remaining, 451);
});

test('under double in, a player stays in for the rest of the leg but not the next', () => {
  let game = newGame(['A', 'B'], { in: 'Double in' });
  game = endTurn(throwDart(game, double(1)));
  game = endTurn(throwDart(game, miss));
  game = throwDart(game, single(20));
  assert.equal(game.players[0].remaining, 479);
  game = endTurn(throwDart(leave(game, 40), double(20)));
  assert.deepEqual(game.players.map((p) => p.opened), [false, false]);
});

test('straight in scores from the first dart', () => {
  const game = throwDart(newGame(['A', 'B'], { in: 'Straight in' }), single(20));
  assert.equal(game.players[0].remaining, 481);
  assert.equal(game.last.result, null);
});

test('moving on early keeps the darts thrown', () => {
  let game = throwDart(newGame(['A', 'B']), triple(20));
  game = endTurn(game);
  assert.equal(game.players[0].remaining, 441);
  assert.equal(game.current, 1);
});

test('real throws score their full value', () => {
  const real = dartFromThrow({ bed: 'Double', multiplier: 2, segmentName: 'D16', segmentNumber: 16 });
  const game = throwDart(leave(newGame(['A', 'B']), 32), real);
  assert.equal(game.last.result, 'leg');
});

test('one player plays for an average', () => {
  const game = throwDart(leave(newGame(['Solo'], { legs: 1 }), 40), double(20));
  assert.equal(game.phase, 'over');
  assert.match(game.winnerText, /^Solo finishes with a [\d.]+ average!$/);
});
