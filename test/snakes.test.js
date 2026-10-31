import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedTracker } from '../src/feed.js';
import { bedById, bedForThrow, dartFromThrow } from '../src/segments.js';
import { FINISH, LADDERS, SNAKES, newGame, throwDart, walk } from '../src/snakes.js';
import { boardCleared, nextPlayer } from '../src/turns.js';

const bed = bedById;
const at = (pos, names = ['A', 'B']) => {
  const game = newGame(names);
  game.players[0].pos = pos;
  return game;
};

test('each bed moves the spaces in the rules', () => {
  const spaces = (dart) => bedForThrow(dart).spaces;
  assert.equal(spaces({ bed: 'Double', multiplier: 2, segmentName: 'Bull', segmentNumber: 25 }), 6);
  assert.equal(spaces({ bed: 'SingleOuter', multiplier: 1, segmentName: '25', segmentNumber: 25 }), 5);
  assert.equal(spaces({ bed: 'SingleOuter', multiplier: 1, segmentName: 'S1', segmentNumber: 1 }), 4);
  assert.equal(spaces({ bed: 'Triple', multiplier: 3, segmentName: 'T20', segmentNumber: 20 }), 3);
  assert.equal(spaces({ bed: 'SingleInner', multiplier: 1, segmentName: 'S18', segmentNumber: 18 }), 2);
  assert.equal(spaces({ bed: 'Double', multiplier: 2, segmentName: 'D20', segmentNumber: 20 }), 1);
});

test('the number hit makes no difference', () => {
  const t1 = bedForThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T1', segmentNumber: 1 });
  const t20 = bedForThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T20', segmentNumber: 20 });
  assert.equal(t1.spaces, t20.spaces);
});

test('misses, bouncers and failed detections do not move', () => {
  assert.equal(bedForThrow({ bed: 'Outside', multiplier: 0, segmentName: 'M4', segmentNumber: 4 }).spaces, 0);
  assert.equal(bedForThrow({ bed: 'Triple', multiplier: 3, bouncer: true }).spaces, 0);
  assert.equal(bedForThrow({ bed: 'Triple', multiplier: 3, failed: true }).spaces, 0);
});

test('board layout has no chained or impossible tiles', () => {
  const starts = [...Object.keys(LADDERS), ...Object.keys(SNAKES)].map(Number);
  const ends = [...Object.values(LADDERS), ...Object.values(SNAKES)];
  assert.equal(new Set(starts).size, starts.length);
  for (const end of ends) assert.ok(!starts.includes(end), `${end} is both an end and a start`);
  for (const start of starts) assert.ok(start > 0 && start < FINISH);
  for (const [from, to] of Object.entries(LADDERS)) assert.ok(to > Number(from));
  for (const [from, to] of Object.entries(SNAKES)) assert.ok(to < Number(from));
});

test('landing exactly on 100 wins and ends the game', () => {
  const game = throwDart(at(97), bed('Triple'));
  assert.equal(game.players[0].pos, 100);
  assert.equal(game.winner, 0);
  assert.equal(game.phase, 'over');
  assert.equal(throwDart(game, bed('Double')), game);
});

test('overshooting bounces back off the finish line', () => {
  assert.deepEqual(walk(98, 5), { path: [99, 100, 99, 98, 97], bounced: true });
  const game = throwDart(at(96), bed('OuterBull')); // 97 98 99 100 99 -> snake at 99
  assert.equal(game.last.bounced, true);
  assert.equal(game.winner, null);
});

test('a bounce can land on a snake', () => {
  const game = throwDart(at(98), bed('Triple')); // 99 100 99
  assert.equal(game.players[0].pos, SNAKES[99]);
  assert.equal(game.last.kind, 'snake');
});

test('ladder bottoms climb and snake heads slide, only on the exact tile', () => {
  assert.equal(throwDart(at(1), bed('SingleInner')).players[0].pos, LADDERS[3]);
  assert.equal(throwDart(at(13), bed('SingleOuter')).players[0].pos, SNAKES[17]);
  assert.equal(throwDart(at(1), bed('SingleOuter')).players[0].pos, 5); // passes over 3
});

test('a miss on a ladder tile does not climb again', () => {
  const game = throwDart(at(3), bed('Miss'));
  assert.equal(game.players[0].pos, 3);
  assert.equal(game.last.slide, null);
});

test('turn lasts three darts, then waits for takeout', () => {
  let game = at(10);
  game = throwDart(throwDart(game, bed('Double')), bed('Miss'));
  assert.equal(game.phase, 'throwing');
  game = throwDart(game, bed('Miss'));
  assert.equal(game.phase, 'takeout');
  const pos = game.players[0].pos;
  assert.equal(throwDart(game, bed('InnerBull')).players[0].pos, pos);
  game = boardCleared(game);
  assert.equal(game.current, 1);
  assert.deepEqual(game.darts, []);
  assert.equal(game.phase, 'throwing');
});

test('clearing the board after Next player does not skip the next player', () => {
  let game = throwDart(at(10), bed('Double'));
  game = nextPlayer(game);
  assert.equal(game.current, 1);
  assert.equal(boardCleared(game).current, 1);
});

test('turn order wraps around', () => {
  assert.equal(nextPlayer(nextPlayer(newGame(['A', 'B']))).current, 0);
  assert.equal(nextPlayer(newGame(['Solo'])).current, 0);
});

test('feed tracker reports only new darts and clears', () => {
  const track = createFeedTracker();
  assert.deepEqual(track(['old']), { darts: [], cleared: false });
  assert.deepEqual(track(['old', 'a', 'b']), { darts: ['a', 'b'], cleared: false });
  assert.deepEqual(track(['old', 'a', 'b']), { darts: [], cleared: false });
  assert.deepEqual(track([]), { darts: [], cleared: true });
  assert.deepEqual(track([]), { darts: [], cleared: false });
  assert.deepEqual(track(['c']), { darts: ['c'], cleared: false });
});

test('real throws convert to their dart score', () => {
  const points = (dart) => dartFromThrow(dart).points;
  assert.equal(points({ bed: 'Triple', multiplier: 3, segmentName: 'T20', segmentNumber: 20 }), 60);
  assert.equal(points({ bed: 'Double', multiplier: 2, segmentName: 'D16', segmentNumber: 16 }), 32);
  assert.equal(points({ bed: 'SingleInner', multiplier: 1, segmentName: 'S18', segmentNumber: 18 }), 18);
  assert.equal(points({ bed: 'SingleOuter', multiplier: 1, segmentName: 'S1', segmentNumber: 1 }), 1);
  assert.equal(points({ bed: 'Double', multiplier: 2, segmentName: 'Bull', segmentNumber: 25 }), 50);
  assert.equal(points({ bed: 'SingleOuter', multiplier: 1, segmentName: '25', segmentNumber: 25 }), 25);
  assert.equal(points({ bed: 'Outside', multiplier: 0, segmentName: 'M4', segmentNumber: 4 }), 0);
  assert.equal(points({ bed: 'Triple', multiplier: 3, segmentNumber: 20, bouncer: true }), 0);
});

test('real throws measure distance from the bull using the feed coordinates', () => {
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} vs ${expected}`);
  near(dartFromThrow({ bed: 'Triple', multiplier: 3, segmentNumber: 1, coordsX: 0.3, coordsY: 0.4 }).distance, 0.5);
  assert.equal(dartFromThrow({ bed: 'Triple', multiplier: 3, segmentNumber: 1, coordsX: 0.3, coordsY: 0.4, bouncer: true }).distance, null);
  assert.equal(dartFromThrow({ bed: 'SingleInner', multiplier: 1, segmentNumber: 1 }).distance, null);
});
