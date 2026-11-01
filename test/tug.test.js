import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDart } from '../src/segments.js';
import { GOALS, arrange, newGame, throwDart } from '../src/tug.js';
import { boardCleared, nextPlayer } from '../src/turns.js';

const T20 = makeDart('Triple', 20);

test('player 1 pulls left and player 2 pulls right', () => {
  let game = newGame(['A', 'B']);
  game = throwDart(game, T20);
  assert.equal(game.rope, -60);
  game = throwDart(throwDart(game, makeDart('Miss')), makeDart('Miss'));
  game = boardCleared(game);
  game = throwDart(game, makeDart('Double', 10));
  assert.equal(game.rope, -40);
  assert.equal(game.players[1].points, 20);
});

test('reaching the goal wins immediately, mid-turn', () => {
  let game = newGame(['A', 'B']);
  game.rope = -50;
  game = throwDart(game, T20);
  assert.equal(game.rope, -100);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 'left');
  assert.equal(game.winnerText, 'A wins!');
  assert.equal(game.darts.length, 1);
  assert.equal(throwDart(game, T20), game);
});

test('the right side can win too', () => {
  let game = newGame(['A', 'B']);
  game.current = 1;
  game.rope = 50;
  game = throwDart(game, T20);
  assert.equal(game.winner, 'right');
  assert.equal(game.winnerText, 'B wins!');
});

test('the goal choices are 100 and 200, defaulting to 100', () => {
  assert.deepEqual(GOALS, [100, 200]);
  assert.equal(newGame(['A', 'B']).winPull, 100);
});

test('a 200 goal needs 200 points of lead, so it cannot be won from the centre in one turn', () => {
  let game = newGame(['A', 'B'], { goal: 200 });
  game = throwDart(throwDart(throwDart(game, T20), T20), T20);
  assert.equal(game.rope, -180);
  assert.equal(game.phase, 'takeout');

  game = boardCleared(game);
  game.current = 0;
  game = throwDart(game, T20);
  assert.equal(game.rope, -200);
  assert.equal(game.winner, 'left');
});

test('a miss does not move the laser but uses a dart', () => {
  const game = throwDart(newGame(['A', 'B']), makeDart('Miss'));
  assert.equal(game.rope, 0);
  assert.equal(game.darts.length, 1);
});

test('four players alternate into two teams', () => {
  const game = newGame(['A', 'B', 'C', 'D']);
  assert.deepEqual(game.players.map((p) => p.side), ['left', 'right', 'left', 'right']);
  let current = game;
  const turns = [];
  for (let i = 0; i < 5; i++) {
    turns.push(current.players[current.current].name);
    current = nextPlayer(current);
  }
  assert.deepEqual(turns, ['A', 'B', 'C', 'D', 'A']);
});

test('three players go one against two, and sides still take equal turns', () => {
  let game = newGame(['A', 'B', 'C']);
  assert.deepEqual(game.players.map((p) => p.side), ['left', 'right', 'right']);
  const turns = [];
  for (let i = 0; i < 8; i++) {
    turns.push(game.players[game.current].name);
    game = nextPlayer(game);
  }
  assert.deepEqual(turns, ['A', 'B', 'A', 'C', 'A', 'B', 'A', 'C']);
});

test('team wins name everyone on the side', () => {
  let game = newGame(['A', 'B', 'C']);
  game.current = 2;
  game.rope = 50;
  game = throwDart(game, T20);
  assert.equal(game.winnerText, 'B & C win!');
});

test('bull rankings balance four players: 1st and 4th against 2nd and 3rd', () => {
  const game = newGame(arrange(['First', 'Second', 'Third', 'Fourth']));
  const side = (side) => game.players.filter((p) => p.side === side).map((p) => p.name).sort();
  assert.deepEqual(side('left'), ['First', 'Fourth']);
  assert.deepEqual(side('right'), ['Second', 'Third']);
});

test('bull rankings put the closest of three alone', () => {
  const game = newGame(arrange(['First', 'Second', 'Third']));
  assert.deepEqual(game.players.map((p) => p.side), ['left', 'right', 'right']);
  assert.equal(game.players[0].name, 'First');
});

const beginnerFirst = () => newGame([{ name: 'A', beginner: true }, { name: 'B', beginner: false }]);

test('a beginner’s points count 1.5 times, rounded, across the rope, pips and totals', () => {
  const game = throwDart(beginnerFirst(), makeDart('SingleOuter', 20));
  assert.equal(game.rope, -30);
  assert.equal(game.players[0].points, 30);
  assert.equal(game.darts[0].points, 30);
  assert.equal(game.last.points, 30);
  assert.equal(throwDart(beginnerFirst(), makeDart('SingleOuter', 5)).last.points, 8);
});

test('anyone else’s points count as usual', () => {
  const game = throwDart({ ...beginnerFirst(), current: 1 }, makeDart('SingleOuter', 20));
  assert.equal(game.rope, 20);
  assert.equal(game.players[1].points, 20);
});

test('a beginner’s miss still pulls nothing', () => {
  assert.equal(throwDart(beginnerFirst(), makeDart('Miss')).rope, 0);
});
