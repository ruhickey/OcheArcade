import test from 'node:test';
import assert from 'node:assert/strict';
import { advance } from '../src/rounds.js';

const rules = {
  score: (player) => player.points,
  winnerText: (winner) => `${winner.name} wins`,
  startTurn: (game) => game,
};

function endOfPlayoff(a, b, c) {
  return {
    players: [{ name: 'A', points: a }, { name: 'B', points: b }, { name: 'C', points: c }],
    current: 1,
    round: 3,
    rounds: 3,
    playoff: { queue: [0, 1], position: 1, round: 1 },
    darts: [],
    phase: 'takeout',
  };
}

test('a playoff is won by one of its players, even if someone outside it now has more', () => {
  const game = advance(endOfPlayoff(6, 5, 7), rules);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(game.winnerText, 'A wins');
});

test('a level playoff repeats with the same players, leaving out anyone who drew level with them', () => {
  const game = advance(endOfPlayoff(6, 6, 6), rules);
  assert.equal(game.phase, 'takeout');
  assert.deepEqual(game.playoff.queue, [0, 1]);
  assert.equal(game.playoff.round, 2);
});

test('the first playoff is decided across every player', () => {
  const game = advance({ ...endOfPlayoff(8, 8, 7), playoff: null, current: 2 }, rules);
  assert.deepEqual(game.playoff.queue, [0, 1]);
});
