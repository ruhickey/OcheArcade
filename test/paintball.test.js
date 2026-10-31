import test from 'node:test';
import assert from 'node:assert/strict';
import { dartFromThrow, makeDart } from '../src/segments.js';
import { DEFAULT_ROUNDS, endTurn, newGame, throwDart, zoneOf } from '../src/paintball.js';
import { boardCleared } from '../src/turns.js';

const miss = makeDart('Miss');
const T20 = makeDart('Triple', 20);
const throwAll = (game, ...darts) => darts.reduce(throwDart, game);
const zones = (game) => game.players.map((p) => p.zones);

test('hitting an empty zone claims it', () => {
  const game = throwDart(newGame(['A', 'B']), T20);
  assert.deepEqual(zones(game), [1, 0]);
  assert.equal(game.zoneOwners['Triple-20'], 0);
  assert.equal(game.last.result, 'claim');
});

test('hitting an opponent’s zone steals it', () => {
  let game = endTurn(throwDart(newGame(['A', 'B']), T20));
  game = throwDart(game, T20);
  assert.deepEqual(zones(game), [0, 1]);
  assert.equal(game.zoneOwners['Triple-20'], 1);
  assert.equal(game.last.result, 'steal');
  assert.equal(game.last.from, 0);
});

test('hitting your own zone changes nothing', () => {
  const game = throwAll(newGame(['A', 'B']), T20, T20);
  assert.deepEqual(zones(game), [1, 0]);
  assert.equal(game.last.result, 'own');
});

test('single inner, single outer, double and triple are separate zones', () => {
  const beds = ['SingleInner', 'SingleOuter', 'Double', 'Triple'];
  const ids = beds.map((bed) => zoneOf(makeDart(bed, 20)));
  assert.equal(new Set(ids).size, 4);
  assert.notEqual(zoneOf(makeDart('Triple', 20)), zoneOf(makeDart('Triple', 19)));
});

test('each bull is its own zone and misses paint nothing', () => {
  assert.equal(zoneOf(makeDart('InnerBull')), 'InnerBull');
  assert.equal(zoneOf(makeDart('OuterBull')), 'OuterBull');
  assert.equal(zoneOf(miss), null);
  const game = throwDart(newGame(['A', 'B']), miss);
  assert.deepEqual(zones(game), [0, 0]);
  assert.equal(game.last.result, 'miss');
  assert.equal(game.darts.length, 1);
});

test('real throws map to zones, and bouncers miss', () => {
  const dart = dartFromThrow({ bed: 'SingleInner', multiplier: 1, segmentName: 'S18', segmentNumber: 18 });
  assert.equal(zoneOf(dart), 'SingleInner-18');
  const bouncer = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T1', segmentNumber: 1, bouncer: true });
  assert.equal(zoneOf(bouncer), null);
});

test('a turn lasts three darts and ends at takeout', () => {
  let game = throwAll(newGame(['A', 'B']), miss, miss, miss);
  assert.equal(game.phase, 'takeout');
  assert.equal(throwDart(game, T20), game);
  game = boardCleared(game, endTurn);
  assert.equal(game.current, 1);
  assert.equal(game.phase, 'throwing');
});

test('ending a turn with no darts does nothing', () => {
  const game = newGame(['A', 'B']);
  assert.equal(endTurn(game), game);
});

test('rounds advance once everyone has thrown', () => {
  let game = endTurn(throwDart(newGame(['A', 'B']), miss));
  assert.equal(game.round, 1);
  game = endTurn(throwDart(game, miss));
  assert.equal(game.round, 2);
  assert.equal(game.current, 0);
});

test('the match has a default length and can be changed', () => {
  assert.equal(newGame(['A', 'B']).rounds, DEFAULT_ROUNDS);
  assert.equal(newGame(['A', 'B'], { rounds: 5 }).rounds, 5);
});

test('the most zones wins when the rounds run out', () => {
  let game = newGame(['A', 'B'], { rounds: 1 });
  game = endTurn(throwAll(game, T20, makeDart('Triple', 19)));
  game = throwDart(game, makeDart('Triple', 18));
  assert.equal(game.phase, 'throwing');
  game = endTurn(game);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(game.winnerText, 'A wins with 2 zones!');
});

test('the final dart ends a decided match without waiting for takeout', () => {
  let game = newGame(['A', 'B'], { rounds: 1 });
  game = endTurn(throwDart(game, T20));
  game = throwAll(game, miss, miss, miss);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(game.winnerText, 'A wins with 1 zone!');
});

test('a draw plays on between the leaders only, until one is ahead', () => {
  let game = newGame(['A', 'B', 'C'], { rounds: 1 });
  game = endTurn(throwDart(game, T20));
  game = endTurn(throwDart(game, makeDart('Triple', 19)));
  game = throwAll(game, miss, miss, miss);
  assert.equal(game.phase, 'takeout');
  game = endTurn(game);
  assert.equal(game.phase, 'throwing');
  assert.deepEqual(game.playoff.queue, [0, 1]);
  assert.equal(game.current, 0);

  game = endTurn(throwDart(game, miss));
  assert.equal(game.current, 1);
  game = endTurn(throwDart(game, miss));
  assert.equal(game.playoff.round, 2);
  assert.equal(game.current, 0);

  game = endTurn(throwDart(game, makeDart('Triple', 18)));
  game = throwAll(game, miss, miss, miss);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
});

test('a steal in the playoff can decide it', () => {
  let game = newGame(['A', 'B'], { rounds: 1 });
  game = endTurn(throwDart(game, T20));
  game = endTurn(throwDart(game, makeDart('Triple', 19)));
  game = endTurn(throwDart(game, makeDart('Triple', 19)));
  assert.deepEqual(zones(game), [2, 0]);
  game = endTurn(throwDart(game, miss));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
});

test('nobody painting anything still gets a winner through the playoff', () => {
  let game = newGame(['A', 'B'], { rounds: 1 });
  game = endTurn(throwDart(game, miss));
  game = endTurn(throwDart(game, miss));
  assert.ok(game.playoff);
  game = endTurn(throwDart(game, T20));
  game = endTurn(throwDart(game, miss));
  assert.equal(game.winner, 0);
});
