import test from 'node:test';
import assert from 'node:assert/strict';
import { dartFromThrow, makeDart } from '../src/segments.js';
import { DIFFICULTY, endTurn, newGame, throwDart } from '../src/boxing.js';
import { boardCleared } from '../src/turns.js';

const lives = (game) => game.players.map((p) => p.lives);
const miss = makeDart('Miss');

// Two players with known targets: A has 1 and 2, B has 3 and 4.
function fight(difficulty = 'Normal', names = ['A', 'B']) {
  const game = newGame(names, { targets: 2, difficulty });
  const players = game.players.map((p, i) => ({ ...p, targets: [i * 2 + 1, i * 2 + 2] }));
  return { ...game, players };
}

test('each player gets the chosen number of distinct targets', () => {
  for (let run = 0; run < 200; run++) {
    for (const targets of [2, 3]) {
      const game = newGame(['A', 'B', 'C', 'D'], { targets });
      const all = game.players.flatMap((p) => p.targets);
      assert.equal(all.length, targets * 4);
      assert.equal(new Set(all).size, all.length);
      for (const number of all) assert.ok(number >= 1 && number <= 20);
    }
  }
});

test('targets are random between games', () => {
  const seen = new Set();
  for (let run = 0; run < 50; run++) seen.add(newGame(['A', 'B']).players[0].targets.join());
  assert.ok(seen.size > 10);
});

test('difficulty sets the starting lives', () => {
  for (const [difficulty, { lives: expected }] of Object.entries(DIFFICULTY)) {
    assert.deepEqual(lives(newGame(['A', 'B'], { difficulty })), [expected, expected]);
  }
});

test('hitting an opponent’s target deals damage, scaled by difficulty and bed', () => {
  assert.deepEqual(lives(throwDart(fight('Normal'), makeDart('SingleOuter', 3))), [15, 13]);
  assert.deepEqual(lives(throwDart(fight('Normal'), makeDart('Double', 3))), [15, 11]);
  assert.deepEqual(lives(throwDart(fight('Normal'), makeDart('Triple', 3))), [15, 9]);
  assert.deepEqual(lives(throwDart(fight('Hard'), makeDart('SingleInner', 4))), [20, 19]);
  assert.deepEqual(lives(throwDart(fight('Hard'), makeDart('Triple', 4))), [20, 17]);
  assert.deepEqual(lives(throwDart(fight('Easy'), makeDart('Double', 4))), [10, 6]);
});

test('hitting your own target heals you, without going over the start', () => {
  const hurt = fight();
  hurt.players[0].lives = 10;
  assert.deepEqual(lives(throwDart(hurt, makeDart('SingleOuter', 1))), [11, 15]);
  assert.deepEqual(lives(throwDart(hurt, makeDart('Triple', 2))), [13, 15]);
  hurt.players[0].lives = 14;
  assert.deepEqual(lives(throwDart(hurt, makeDart('Triple', 1))), [15, 15]);
  hurt.players[0].lives = 15;
  const full = throwDart(hurt, makeDart('SingleOuter', 1));
  assert.equal(full.last.result, 'full');
  assert.deepEqual(lives(full), [15, 15]);
});

test('healing ignores the difficulty’s damage scaling', () => {
  const hurt = fight('Normal');
  hurt.players[0].lives = 5;
  assert.equal(throwDart(hurt, makeDart('Double', 1)).players[0].lives, 7);
});

test('other numbers, bulls and misses do nothing but use a dart', () => {
  for (const dart of [makeDart('Triple', 20), makeDart('InnerBull'), makeDart('OuterBull'), miss]) {
    const game = throwDart(fight(), dart);
    assert.deepEqual(lives(game), [15, 15]);
    assert.equal(game.last.result, 'miss');
    assert.equal(game.darts.length, 1);
  }
});

test('real throws count, and bouncers do not', () => {
  const real = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T3', segmentNumber: 3 });
  assert.deepEqual(lives(throwDart(fight(), real)), [15, 9]);
  const bouncer = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T3', segmentNumber: 3, bouncer: true });
  assert.deepEqual(lives(throwDart(fight(), bouncer)), [15, 15]);
});

test('a turn is three darts then takeout', () => {
  let game = fight();
  for (let i = 0; i < 2; i++) game = throwDart(game, miss);
  assert.equal(game.phase, 'throwing');
  game = throwDart(game, miss);
  assert.equal(game.phase, 'takeout');
  assert.equal(throwDart(game, makeDart('Triple', 3)), game);
  game = boardCleared(game, endTurn);
  assert.equal(game.current, 1);
  assert.deepEqual(game.darts, []);
});

test('ending a turn with no darts does nothing', () => {
  const game = fight();
  assert.equal(endTurn(game), game);
});

test('roles swap with the turn: B now heals on 3 and hurts on 1', () => {
  let game = endTurn(throwDart(fight(), makeDart('SingleOuter', 3)));
  game = throwDart(game, makeDart('SingleOuter', 3));
  assert.deepEqual(lives(game), [15, 14]);
  game = throwDart(game, makeDart('SingleOuter', 1));
  assert.deepEqual(lives(game), [13, 14]);
});

test('knocking out the last opponent wins at once, without going below zero', () => {
  const nearly = fight();
  nearly.players[1].lives = 1;
  const game = throwDart(nearly, makeDart('Triple', 3));
  assert.deepEqual(lives(game), [15, 0]);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(game.winnerText, 'A wins by knockout!');
  assert.equal(game.last.knockedOut, true);
  assert.equal(throwDart(game, miss), game);
});

test('with more players, the knocked out are skipped until one is left', () => {
  let game = fight('Normal', ['A', 'B', 'C']);
  game.players[1].lives = 1;
  game = throwDart(game, makeDart('SingleOuter', 3));
  assert.equal(game.phase, 'throwing');
  assert.equal(game.players[1].lives, 0);
  game = endTurn(game);
  assert.equal(game.current, 2);
  game = endTurn(throwDart(game, miss));
  assert.equal(game.current, 0);
});

test('a knocked out player’s targets do nothing', () => {
  const game = fight('Normal', ['A', 'B', 'C']);
  game.players[1].lives = 0;
  const after = throwDart(game, makeDart('Triple', 3));
  assert.equal(after.last.result, 'out');
  assert.deepEqual(lives(after), [15, 0, 15]);
});

test('the last two fight it out and the final knockout wins', () => {
  let game = fight('Normal', ['A', 'B', 'C']);
  game.players[1].lives = 0;
  game.players[2].lives = 1;
  game = throwDart(game, makeDart('SingleOuter', 5));
  assert.equal(game.winnerText, 'A wins by knockout!');
});

const players = [{ name: 'A', beginner: true }, { name: 'B', beginner: false }];

test('a beginner gets 1.5 times the lives, rounded, and anyone else the usual number', () => {
  for (const [difficulty, expected] of [['Easy', 15], ['Normal', 23], ['Hard', 30]]) {
    const game = newGame(players, { difficulty });
    assert.equal(game.players[0].lives, expected);
    assert.equal(game.players[0].maxLives, expected);
    assert.equal(game.players[1].lives, DIFFICULTY[difficulty].lives);
    assert.equal(game.players[1].maxLives, DIFFICULTY[difficulty].lives);
  }
});

test('a beginner heals up to their own higher maximum', () => {
  const start = fight('Normal', players);
  const hurt = { ...start, players: start.players.map((p, i) => (i === 0 ? { ...p, lives: 22 } : p)) };
  const healed = throwDart(hurt, makeDart('Triple', 1));
  assert.equal(healed.players[0].lives, 23);
  assert.equal(healed.last.change, 1);
});
