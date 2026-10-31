import test from 'node:test';
import assert from 'node:assert/strict';
import { dartFromThrow, makeDart } from '../src/segments.js';
import { BULL, MAX_SHIELDS, endTurn, newGame, throwDart } from '../src/conquer.js';
import { canReach, neighbours } from '../public/games/conquer-rules.js';
import { boardCleared } from '../src/turns.js';

const single = (n) => makeDart('SingleOuter', n);
const miss = makeDart('Miss');
const throwAll = (game, ...darts) => darts.reduce(throwDart, game);

// A with home 20, B with home 3, on opposite sides of the board.
function match(regions = {}, names = ['A', 'B'], options = {}) {
  const game = newGame(names, options);
  const all = { 20: { owner: 0, shields: 1 }, 3: { owner: 1, shields: 1 }, ...regions };
  const held = names.map((_, i) => Object.values(all).filter((r) => r.owner === i));
  return {
    ...game,
    regions: all,
    players: game.players.map((p, i) => ({ ...p, score: held[i].reduce((t, r) => t + 1 + r.shields, 0) })),
  };
}

test('everyone starts on a home base with one shield, spread around the board', () => {
  for (let run = 0; run < 100; run++) {
    for (const count of [2, 3, 4]) {
      const game = newGame(Array.from({ length: count }, (_, i) => `P${i}`));
      const homes = game.players.map((p) => p.home);
      assert.equal(new Set(homes).size, count);
      homes.forEach((home, owner) => assert.deepEqual(game.regions[home], { owner, shields: 1 }));
      assert.equal(Object.keys(game.regions).length, count);
      for (const home of homes) for (const next of neighbours(home)) assert.equal(game.regions[next], undefined);
    }
  }
});

test('neighbours follow the real board, wrapping past 20', () => {
  assert.deepEqual(neighbours(20), [5, 1]);
  assert.deepEqual(neighbours(5), [12, 20]);
  assert.deepEqual(neighbours(6), [13, 10]);
});

test('you can claim a neutral number next to your region, with one shield', () => {
  const game = throwDart(match(), single(1));
  assert.deepEqual(game.regions[1], { owner: 0, shields: 1 });
  assert.equal(game.last.result, 'claim');
  assert.equal(game.players[0].score, 4);
});

test('numbers out of reach lose the dart', () => {
  const game = throwDart(match(), single(6));
  assert.equal(game.regions[6], undefined);
  assert.equal(game.last.result, 'blocked');
  assert.equal(game.darts.length, 1);
});

test('new regions extend your reach', () => {
  const game = throwAll(match(), single(1), single(18));
  assert.deepEqual(game.regions[18], { owner: 0, shields: 1 });
  assert.equal(game.last.result, 'claim');
});

test('enemy numbers need to be in reach as well', () => {
  const far = throwDart(match(), single(3));
  assert.equal(far.last.result, 'blocked');
  assert.equal(far.regions[3].shields, 1);
  const near = throwDart(match({ 1: { owner: 1, shields: 2 } }), single(1));
  assert.equal(near.last.result, 'damage');
  assert.equal(near.regions[1].shields, 1);
});

test('breaking shields takes hits, then a further hit steals', () => {
  let game = match({ 1: { owner: 1, shields: 1 } });
  game = throwDart(game, single(1));
  assert.equal(game.last.result, 'broken');
  assert.deepEqual(game.regions[1], { owner: 1, shields: 0 });
  game = throwDart(game, single(1));
  assert.equal(game.last.result, 'steal');
  assert.equal(game.last.from, 1);
  assert.deepEqual(game.regions[1], { owner: 0, shields: 1 });
});

test('doubles and trebles hit shields harder, but never steal in one dart', () => {
  const two = throwDart(match({ 1: { owner: 1, shields: 3 } }), makeDart('Double', 1));
  assert.equal(two.regions[1].shields, 1);
  const three = throwDart(match({ 1: { owner: 1, shields: 1 } }), makeDart('Triple', 1));
  assert.equal(three.regions[1].owner, 1);
  assert.equal(three.regions[1].shields, 0);
});

test('stealing and claiming always start at one shield', () => {
  assert.equal(throwDart(match(), makeDart('Triple', 1)).regions[1].shields, 1);
  assert.equal(throwDart(match({ 1: { owner: 1, shields: 0 } }), makeDart('Triple', 1)).regions[1].shields, 1);
});

test('hitting your own region reinforces it up to the maximum', () => {
  let game = throwDart(match(), single(20));
  assert.equal(game.regions[20].shields, 2);
  assert.equal(game.last.result, 'reinforce');
  game = throwDart(game, makeDart('Triple', 20));
  assert.equal(game.regions[20].shields, MAX_SHIELDS);
  game = throwDart(game, single(20));
  assert.equal(game.regions[20].shields, MAX_SHIELDS);
  assert.equal(game.last.result, 'full');
});

test('your own regions can always be reinforced', () => {
  assert.equal(canReach({ 6: { owner: 0, shields: 1 } }, 0, 6), true);
});

test('the bull can always be hit, and either ring counts', () => {
  const outer = throwDart(match(), makeDart('OuterBull'));
  assert.deepEqual(outer.regions[BULL], { owner: 0, shields: 1 });
  const inner = throwDart(match(), makeDart('InnerBull'));
  assert.equal(inner.regions[BULL].owner, 0);
});

test('holding the bull lifts the adjacency rule', () => {
  let game = throwDart(match(), single(6));
  assert.equal(game.last.result, 'blocked');
  game = throwDart(match({ [BULL]: { owner: 0, shields: 1 } }), single(6));
  assert.equal(game.last.result, 'claim');
  game = throwDart(match({ [BULL]: { owner: 0, shields: 1 } }), single(3));
  assert.equal(game.last.result, 'broken');
});

test('losing the bull brings the adjacency rule back', () => {
  let game = match({ [BULL]: { owner: 1, shields: 0 } });
  game = throwDart(game, makeDart('OuterBull'));
  assert.equal(game.regions[BULL].owner, 0);
  assert.equal(canReach(game.regions, 1, 7), false);
  assert.equal(canReach(game.regions, 0, 7), true);
});

test('the inner bull counts as 2 against shields', () => {
  const game = throwDart(match({ [BULL]: { owner: 1, shields: 3 } }), makeDart('InnerBull'));
  assert.equal(game.regions[BULL].shields, 1);
});

test('a player with no regions left can hit anywhere', () => {
  assert.equal(canReach({ 20: { owner: 1, shields: 1 } }, 0, 6), true);
});

test('misses and bouncers do nothing but use a dart', () => {
  const game = throwDart(match(), miss);
  assert.equal(game.last.result, 'miss');
  assert.equal(game.darts.length, 1);
  const bouncer = dartFromThrow({ bed: 'SingleOuter', multiplier: 1, segmentName: 'S1', segmentNumber: 1, bouncer: true });
  assert.equal(throwDart(match(), bouncer).last.result, 'miss');
});

test('real throws count', () => {
  const dart = dartFromThrow({ bed: 'SingleInner', multiplier: 1, segmentName: 'S1', segmentNumber: 1 });
  assert.equal(throwDart(match(), dart).regions[1].owner, 0);
});

test('a score is one for each region and each shield', () => {
  const game = throwDart(match({ 1: { owner: 0, shields: 3 }, 5: { owner: 1, shields: 0 } }), miss);
  assert.equal(game.players[0].score, 2 + 4);
  assert.equal(game.players[1].score, 2 + 1);
});

test('a turn is three darts, then takeout', () => {
  let game = throwAll(match(), miss, miss);
  assert.equal(game.phase, 'throwing');
  game = throwDart(game, miss);
  assert.equal(game.phase, 'takeout');
  assert.equal(throwDart(game, single(1)), game);
  game = boardCleared(game, endTurn);
  assert.equal(game.current, 1);
  assert.equal(game.round, 1);
  game = boardCleared(throwDart(game, miss), endTurn);
  assert.equal(game.current, 0);
  assert.equal(game.round, 2);
});

test('ending a turn with no darts does nothing', () => {
  const game = match();
  assert.equal(endTurn(game), game);
});

test('the highest score wins after the final round', () => {
  let game = match({ 1: { owner: 0, shields: 1 } }, ['A', 'B'], { rounds: 1 });
  game = endTurn(throwDart(game, miss));
  game = throwAll(game, miss, miss, miss);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(game.winnerText, 'A wins the campaign!');
});

test('a draw plays on between the leaders until one is ahead', () => {
  let game = match({}, ['A', 'B'], { rounds: 1 });
  game = endTurn(throwDart(game, miss));
  game = endTurn(throwDart(game, miss));
  assert.deepEqual(game.playoff.queue, [0, 1]);
  game = endTurn(throwDart(game, single(1)));
  game = endTurn(throwDart(game, miss));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
});

test('with more players it’s every player for themselves', () => {
  let game = match({ 1: { owner: 1, shields: 0 }, 5: { owner: 2, shields: 0 } }, ['A', 'B', 'C']);
  game = throwAll(game, single(1), single(5));
  assert.equal(game.regions[1].owner, 0);
  assert.equal(game.regions[5].owner, 0);
});
