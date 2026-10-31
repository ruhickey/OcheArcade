import test from 'node:test';
import assert from 'node:assert/strict';
import { dartFromThrow, makeDart } from '../src/segments.js';
import { COLUMNS, ROWS, columnFor, findLine, newGame, throwDart } from '../src/fourinarow.js';
import { boardCleared, nextPlayer } from '../src/turns.js';

const hit = (number) => makeDart('SingleOuter', number);
const miss = makeDart('Miss');

function board(pieces) {
  const game = newGame(['A', 'B']);
  return { ...game, columns: pieces.map((column) => [...column]) };
}
const EMPTY = Array.from({ length: COLUMNS }, () => []);

test('numbers map to columns as in the rules', () => {
  const expected = [[1, 8, 15], [2, 9, 16], [3, 10, 17], [4, 11, 18], [5, 12, 19], [6, 13, 20], [7, 14]];
  expected.forEach((numbers, column) => {
    for (const number of numbers) assert.equal(columnFor(hit(number)), column, `number ${number}`);
  });
});

test('both bulls map to column 7', () => {
  assert.equal(columnFor(makeDart('InnerBull')), 6);
  assert.equal(columnFor(makeDart('OuterBull')), 6);
});

test('doubles and trebles land in the same column as the number', () => {
  assert.equal(columnFor(makeDart('Triple', 20)), 5);
  assert.equal(columnFor(makeDart('Double', 8)), 0);
  assert.equal(columnFor(makeDart('SingleInner', 14)), 6);
});

test('pieces stack up from the bottom of the column', () => {
  let game = throwDart(newGame(['A', 'B']), hit(3));
  assert.deepEqual(game.columns[2], ['left']);
  assert.equal(game.last.row, 0);
  game = throwDart(game, hit(10));
  assert.deepEqual(game.columns[2], ['left', 'left']);
  assert.equal(game.last.row, 1);
});

test('a full column loses the dart', () => {
  const pieces = EMPTY.map((c) => [...c]);
  pieces[0] = ['left', 'right', 'left', 'right', 'left', 'right'];
  const game = throwDart(board(pieces), hit(1));
  assert.equal(game.last.result, 'bust');
  assert.equal(game.columns[0].length, ROWS);
  assert.equal(game.darts.length, 1);
  assert.equal(game.phase, 'throwing');
});

test('a miss loses the dart', () => {
  const game = throwDart(newGame(['A', 'B']), miss);
  assert.equal(game.last.result, 'miss');
  assert.ok(game.columns.every((c) => c.length === 0));
  assert.equal(game.darts.length, 1);
});

test('real throws place pieces, and bouncers miss', () => {
  const real = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T16', segmentNumber: 16 });
  assert.deepEqual(throwDart(newGame(['A', 'B']), real).columns[1], ['left']);
  const bouncer = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T16', segmentNumber: 16, bouncer: true });
  assert.equal(throwDart(newGame(['A', 'B']), bouncer).last.result, 'miss');
});

test('three darts per turn, then takeout', () => {
  let game = newGame(['A', 'B']);
  game = throwDart(throwDart(game, hit(1)), hit(2));
  assert.equal(game.phase, 'throwing');
  game = throwDart(game, hit(3));
  assert.equal(game.phase, 'takeout');
  assert.equal(throwDart(game, hit(4)), game);
  game = boardCleared(game);
  assert.equal(game.current, 1);
  game = throwDart(game, hit(1));
  assert.deepEqual(game.columns[0], ['left', 'right']);
});

test('four vertically wins', () => {
  const pieces = EMPTY.map((c) => [...c]);
  pieces[3] = ['left', 'left', 'left'];
  const game = throwDart(board(pieces), hit(4));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 'left');
  assert.equal(game.winnerText, 'A wins!');
  assert.equal(game.winningCells.length, 4);
});

test('four horizontally wins, including filling a gap', () => {
  const pieces = EMPTY.map((c) => [...c]);
  pieces[0] = ['left'];
  pieces[1] = ['left'];
  pieces[3] = ['left'];
  const game = throwDart(board(pieces), hit(3));
  assert.equal(game.winner, 'left');
  assert.equal(game.winningCells.length, 4);
});

test('four diagonally wins in both directions', () => {
  const rising = EMPTY.map((c) => [...c]);
  rising[0] = ['left'];
  rising[1] = ['right', 'left'];
  rising[2] = ['right', 'right', 'left'];
  rising[3] = ['right', 'right', 'right'];
  assert.equal(throwDart(board(rising), hit(4)).winner, 'left');

  const falling = EMPTY.map((c) => [...c]);
  falling[6] = ['left'];
  falling[5] = ['right', 'left'];
  falling[4] = ['right', 'right', 'left'];
  falling[3] = ['right', 'right', 'right'];
  assert.equal(throwDart(board(falling), hit(4)).winner, 'left');
});

test('a win ends the game at once, even on the first dart of a turn', () => {
  const pieces = EMPTY.map((c) => [...c]);
  pieces[0] = ['left', 'left', 'left'];
  const game = throwDart(board(pieces), hit(1));
  assert.equal(game.phase, 'over');
  assert.equal(throwDart(game, hit(2)), game);
  assert.equal(nextPlayer(game), game);
});

test('three in a row does not win, and neither do mixed sides', () => {
  const pieces = EMPTY.map((c) => [...c]);
  pieces[0] = ['left', 'left'];
  assert.equal(throwDart(board(pieces), hit(1)).phase, 'throwing');
  const mixed = EMPTY.map((c) => [...c]);
  mixed[0] = ['right', 'left', 'left'];
  assert.equal(throwDart(board(mixed), hit(1)).phase, 'throwing');
});

test('lines do not wrap around the edge of the board', () => {
  const pieces = EMPTY.map((c) => [...c]);
  pieces[5] = ['left'];
  pieces[6] = ['left'];
  pieces[0] = ['left'];
  assert.equal(throwDart(board(pieces), hit(2)).phase, 'throwing');
});

test('a full board with no line is a draw', () => {
  const side = (column, row) => ((Math.floor(column / 2) + row) % 2 === 0 ? 'left' : 'right');
  const pieces = Array.from({ length: COLUMNS }, (_, c) => Array.from({ length: ROWS }, (__, r) => side(c, r)));
  pieces.forEach((column, c) => column.forEach((_, r) => assert.equal(findLine(pieces, c, r), null)));

  const nearly = pieces.map((column) => [...column]);
  const lastSide = nearly[0].pop();
  assert.equal(lastSide, 'right');
  const start = board(nearly);
  const game = throwDart({ ...start, current: 1 }, hit(1));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, null);
  assert.equal(game.winnerText, 'It’s a draw!');
});

test('three and four players split into two teams with equal turns', () => {
  let trio = newGame(['A', 'B', 'C']);
  assert.deepEqual(trio.players.map((p) => p.side), ['left', 'right', 'right']);
  const turns = [];
  for (let i = 0; i < 4; i++) {
    turns.push(trio.players[trio.current].name);
    trio = nextPlayer(trio);
  }
  assert.deepEqual(turns, ['A', 'B', 'A', 'C']);
});

test('teammates build the same line, and team wins name everyone', () => {
  const start = newGame(['A', 'B', 'C', 'D']);
  const pieces = EMPTY.map((c) => [...c]);
  pieces[0] = ['right', 'right', 'right'];
  const game = throwDart({ ...start, columns: pieces, current: 3 }, hit(1));
  assert.equal(game.winner, 'right');
  assert.equal(game.winnerText, 'B & D win!');
});
