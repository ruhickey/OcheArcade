import test from 'node:test';
import assert from 'node:assert/strict';
import { dartFromThrow, makeDart } from '../src/segments.js';
import { HOLES, endTurn, holeScore, newGame, throwDart } from '../src/golf.js';
import { boardCleared } from '../src/turns.js';

const miss = makeDart('Miss');
const throwAll = (game, ...darts) => darts.reduce(throwDart, game);
const score = (...darts) => endTurn(throwAll(newGame(['A', 'B']), ...darts)).players[0].total;

test('each bed of the target scores its strokes', () => {
  assert.equal(score(makeDart('Triple', 1)), 1);
  assert.equal(score(makeDart('Double', 1)), 2);
  assert.equal(score(makeDart('SingleInner', 1)), 3);
  assert.equal(score(makeDart('SingleOuter', 1)), 4);
});

test('misses, wrong numbers and bulls cost 7', () => {
  assert.equal(score(miss), 7);
  assert.equal(score(makeDart('Triple', 20)), 7);
  assert.equal(score(makeDart('InnerBull')), 7);
  assert.equal(score(makeDart('OuterBull')), 7);
});

test('the target follows the hole number', () => {
  let game = newGame(['Solo']);
  game = endTurn(throwDart(game, makeDart('Triple', 1)));
  assert.equal(game.hole, 2);
  game = endTurn(throwDart(game, makeDart('Triple', 1)));
  assert.deepEqual(game.players[0].holes, [1, 7]);
});

test('the best dart scores', () => {
  assert.equal(score(miss, makeDart('SingleOuter', 1), makeDart('Double', 1)), 2);
  assert.equal(score(makeDart('Triple', 1), miss, miss), 1);
});

test('a hat trick takes one off the best score', () => {
  const t = makeDart('Triple', 1);
  const i = makeDart('SingleInner', 1);
  assert.equal(score(t, t, t), 0);
  assert.equal(score(i, i, i), 2);
});

test('inner and outer singles are different beds, so no hat trick', () => {
  const inner = makeDart('SingleInner', 1);
  const outer = makeDart('SingleOuter', 1);
  assert.equal(score(inner, inner, outer), 3);
});

test('no hat trick for the same bed of the wrong number, or three misses', () => {
  const wrong = makeDart('Triple', 20);
  assert.equal(score(wrong, wrong, wrong), 7);
  assert.equal(score(miss, miss, miss), 7);
});

test('no hat trick with fewer than three darts', () => {
  const t = makeDart('Triple', 1);
  assert.equal(holeScore([{ id: 'Triple', strokes: 1 }, { id: 'Triple', strokes: 1 }]), 1);
  assert.equal(score(t, t), 1);
});

test('real throws score against the target', () => {
  const thrown = dartFromThrow({ bed: 'SingleInner', multiplier: 1, segmentName: 'S1', segmentNumber: 1 });
  assert.equal(score(thrown), 3);
  const bouncer = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T1', segmentNumber: 1, bouncer: true });
  assert.equal(score(bouncer), 7);
});

test('pulling out early scores what was thrown, and players then take the same hole', () => {
  let game = throwDart(newGame(['A', 'B']), makeDart('Double', 1));
  game = boardCleared(game, endTurn);
  assert.equal(game.current, 1);
  assert.equal(game.hole, 1);
  assert.deepEqual(game.players[0].holes, [2]);
  game = boardCleared(throwDart(game, miss), endTurn);
  assert.equal(game.current, 0);
  assert.equal(game.hole, 2);
});

test('ending a turn with no darts does nothing', () => {
  const game = newGame(['A', 'B']);
  assert.equal(endTurn(game), game);
  assert.equal(boardCleared(game, endTurn), game);
});

test('a turn waits for takeout after three darts', () => {
  const game = throwAll(newGame(['A', 'B']), miss, miss, miss);
  assert.equal(game.phase, 'takeout');
  assert.equal(throwDart(game, makeDart('Triple', 1)), game);
});

function playAll(game, dartFor) {
  let current = game;
  while (current.phase !== 'over') {
    current = throwDart(current, dartFor(current));
    if (current.phase !== 'over') current = endTurn(current);
  }
  return current;
}

test('the game ends after 18 holes and the lowest total wins', () => {
  const game = playAll(newGame(['A', 'B']), (g) => (g.current === 0 ? makeDart('Triple', g.hole) : makeDart('Double', g.hole)));
  assert.equal(game.players[0].holes.length, HOLES);
  assert.equal(game.players[0].total, 18);
  assert.equal(game.players[1].total, 36);
  assert.equal(game.winnerText, 'A wins on 18!');
});

test('one player just finishes', () => {
  const solo = playAll(newGame(['A']), (g) => makeDart('Triple', g.hole));
  assert.equal(solo.winnerText, 'A finishes on 18!');
});

// Plays every player level through to the end of hole 18, one dart a hole.
function levelThrough18(names) {
  let game = newGame(names);
  while (!game.playoff) {
    game = throwDart(game, makeDart('Double', game.hole));
    game = endTurn(game);
  }
  return game;
}

test('a draw goes to a playoff on a random hole, without changing totals', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const game = levelThrough18(['A', 'B']);
  assert.equal(game.phase, 'throwing');
  assert.equal(game.hole, 10);
  assert.equal(game.current, 0);
  assert.deepEqual(game.playoff.queue, [0, 1]);
  assert.deepEqual(game.players.map((p) => p.total), [36, 36]);
});

test('every hole can come up in a playoff', (t) => {
  const values = [0, 0.999];
  const seen = [];
  for (const value of values) {
    t.mock.method(Math, 'random', () => value);
    seen.push(levelThrough18(['A', 'B']).hole);
    t.mock.restoreAll();
  }
  assert.deepEqual(seen, [1, 18]);
});

test('the playoff scores against its hole and the lowest wins', () => {
  let game = levelThrough18(['A', 'B']);
  const { hole } = game;
  game = endTurn(throwDart(game, makeDart('Double', hole)));
  assert.equal(game.current, 1);
  assert.equal(game.phase, 'throwing');
  game = endTurn(throwDart(game, makeDart('Triple', hole)));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  assert.equal(game.winnerText, 'B wins the playoff!');
  assert.deepEqual(game.players.map((p) => p.total), [36, 36]);
});

test('only players tied for the lead go to the playoff', () => {
  let game = newGame(['A', 'B', 'C']);
  while (!game.playoff) {
    const bed = game.current === 1 ? 'SingleOuter' : 'Double';
    game = endTurn(throwDart(game, makeDart(bed, game.hole)));
  }
  assert.deepEqual(game.playoff.queue, [0, 2]);
  const { hole } = game;
  game = endTurn(throwDart(game, makeDart('Triple', hole)));
  assert.equal(game.current, 2);
  game = endTurn(throwDart(game, makeDart('Double', hole)));
  assert.equal(game.winnerText, 'A wins the playoff!');
});

test('a tied playoff replays between those still level, on a different hole', () => {
  let game = levelThrough18(['A', 'B', 'C']);
  const first = game.hole;
  game = endTurn(throwDart(game, makeDart('Triple', first)));
  game = endTurn(throwDart(game, makeDart('Triple', first)));
  game = endTurn(throwDart(game, makeDart('Double', first)));
  assert.equal(game.phase, 'throwing');
  assert.equal(game.playoff.rounds.length, 2);
  assert.deepEqual(game.playoff.queue, [0, 1]);
  assert.notEqual(game.hole, first);
  game = endTurn(throwDart(game, makeDart('Miss')));
  game = endTurn(throwDart(game, makeDart('Triple', game.hole)));
  assert.equal(game.winnerText, 'B wins the playoff!');
});

test('a tie on the final dart waits for takeout before the playoff', () => {
  let game = newGame(['A', 'B']);
  game.hole = HOLES;
  game = endTurn(throwDart(game, makeDart('Double', HOLES)));
  const d = makeDart('Double', HOLES);
  const miss3 = makeDart('Miss');
  game = throwAll(game, d, miss3, miss3);
  assert.equal(game.phase, 'takeout');
  assert.equal(game.playoff, null);
  game = boardCleared(game, endTurn);
  assert.ok(game.playoff);
});

test('a playoff can end on the third dart', () => {
  let game = levelThrough18(['A', 'B']);
  game = endTurn(throwDart(game, makeDart('Miss')));
  const t = makeDart('Triple', game.hole);
  game = throwAll(game, t, t, t);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
});

test('the last player finishing the last hole ends the game on the third dart', () => {
  let game = newGame(['A']);
  game.hole = HOLES;
  const t = makeDart('Triple', HOLES);
  game = throwAll(game, t, t);
  assert.equal(game.phase, 'throwing');
  game = throwDart(game, t);
  assert.equal(game.phase, 'over');
  assert.equal(game.players[0].total, 0);
  assert.equal(game.last.hatTrick, true);
});

test('a hat trick needs all three darts on the number, not just the same kind of bed', () => {
  const game = throwAll(newGame(['A', 'B']), makeDart('Triple', 1), makeDart('Triple', 20), makeDart('Triple', 2));
  assert.equal(game.last.hatTrick, false);
  assert.equal(endTurn(game).players[0].total, 1);
});
