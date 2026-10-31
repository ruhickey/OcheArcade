import test from 'node:test';
import assert from 'node:assert/strict';
import { dartFromThrow, makeDart } from '../src/segments.js';
import { BLACK, NOMINATE_ANY, endTurn, newGame, nominate, throwDart } from '../src/snooker.js';
import { boardCleared } from '../src/turns.js';

const red = (n) => makeDart('SingleOuter', n);
const colour = (n) => (n === BLACK ? makeDart('OuterBull') : makeDart('SingleOuter', n));
const miss = makeDart('Miss');
const left = (g) => g.scores.left;
const right = (g) => g.scores.right;

// Pots every red but the last few without any colours, by ending the turn on each colour.
function withReds(game, count) {
  return { ...game, reds: Array.from({ length: count }, (_, i) => i + 1) };
}

function atClearance(colourNumber, options) {
  const game = withReds(newGame(['A', 'B'], options), 15);
  return { ...game, clearance: colourNumber, target: { kind: 'clearance', colour: colourNumber } };
}

test('the game opens on the reds with 15 still to clear', () => {
  const game = newGame(['A', 'B']);
  assert.deepEqual(game.target, { kind: 'red' });
  assert.equal(game.reds.length, 0);
  assert.equal(game.players[0].side, 'left');
});

test('hitting a red scores 1 and moves on to a nominated colour', () => {
  const game = throwDart(newGame(['A', 'B']), red(7));
  assert.equal(left(game), 1);
  assert.deepEqual(game.reds, [7]);
  assert.equal(game.target.kind, 'colour');
  assert.equal(game.phase, 'throwing');
});

test('any part of the number counts, and multipliers add nothing', () => {
  const treble = throwDart(newGame(['A', 'B']), makeDart('Triple', 7));
  const doubled = throwDart(newGame(['A', 'B']), makeDart('Double', 7));
  assert.equal(left(treble), 1);
  assert.equal(left(doubled), 1);
});

test('a nominated colour scores its value and goes back to a red, staying on the table', () => {
  let game = throwDart(newGame(['A', 'B']), red(1));
  game = nominate(game, 19);
  game = throwDart(game, colour(19));
  assert.equal(left(game), 6);
  assert.deepEqual(game.target, { kind: 'red' });
  assert.equal(game.clearance, 16);
});

test('colours are worth 2 to 7, with either bull as black', () => {
  const values = { 16: 2, 17: 3, 18: 4, 19: 5, 20: 6 };
  for (const [number, value] of Object.entries(values)) {
    let game = throwDart(newGame(['A', 'B']), red(1));
    game = throwDart(nominate(game, Number(number)), colour(Number(number)));
    assert.equal(left(game), 1 + value);
  }
  for (const bull of ['InnerBull', 'OuterBull']) {
    let game = throwDart(newGame(['A', 'B']), red(1));
    game = throwDart(nominate(game, BLACK), makeDart(bull));
    assert.equal(left(game), 8);
  }
});

test('hitting a different colour to the one nominated is a foul', () => {
  let game = nominate(throwDart(newGame(['A', 'B']), red(1)), 19);
  game = throwDart(game, colour(20));
  assert.equal(left(game), 1);
  assert.equal(right(game), 6);
  assert.equal(game.phase, 'takeout');
  assert.equal(game.last.foul, true);
});

test('throwing before nominating is a foul when nomination is on the iPad', () => {
  const game = throwDart(throwDart(newGame(['A', 'B']), red(1)), colour(16));
  assert.equal(game.last.foul, true);
  assert.equal(right(game), 4);
});

test('with any colour counting, no nomination is needed', () => {
  let game = throwDart(newGame(['A', 'B'], { nominate: NOMINATE_ANY }), red(1));
  assert.equal(nominate(game, 19), game);
  game = throwDart(game, colour(20));
  assert.equal(left(game), 7);
  assert.deepEqual(game.target, { kind: 'red' });
});

test('with any colour counting, a red number is still a foul', () => {
  const game = throwDart(throwDart(newGame(['A', 'B'], { nominate: NOMINATE_ANY }), red(1)), red(2));
  assert.equal(game.last.foul, true);
  assert.equal(right(game), 4);
});

test('nominating only works when a colour is on', () => {
  const game = newGame(['A', 'B']);
  assert.equal(nominate(game, 19), game);
  const onColour = throwDart(game, red(1));
  assert.equal(nominate(onColour, 7), onColour);
});

test('fouls award at least 4 to the opponent', () => {
  const offBoard = throwDart(newGame(['A', 'B']), miss);
  assert.equal(right(offBoard), 4);
  assert.equal(left(offBoard), 0);
  const wrongNumber = throwDart(newGame(['A', 'B']), colour(16));
  assert.equal(right(wrongNumber), 4);
});

test('fouls cost more for a higher ball on or hit', () => {
  const hitPink = throwDart(newGame(['A', 'B']), colour(20));
  assert.equal(right(hitPink), 6);
  const blackOn = throwDart(atClearance(BLACK), miss);
  assert.equal(right(blackOn), 7);
  const blueOn = throwDart(atClearance(19), colour(16));
  assert.equal(right(blueOn), 5);
});

test('a red that has already gone counts as missing the target', () => {
  const game = throwDart({ ...newGame(['A', 'B']), reds: [5] }, red(5));
  assert.equal(game.last.foul, true);
  assert.deepEqual(game.reds, [5]);
});

test('a foul ends the turn straight away, and the darts come out first', () => {
  const fouled = throwDart(newGame(['A', 'B']), miss);
  assert.equal(fouled.phase, 'takeout');
  assert.equal(throwDart(fouled, red(1)), fouled);
  const next = boardCleared(fouled, endTurn);
  assert.equal(next.current, 1);
  assert.equal(next.phase, 'throwing');
  assert.deepEqual(next.darts, []);
});

test('three good darts end the turn, and a pending colour does not carry over', () => {
  let game = newGame(['A', 'B'], { nominate: NOMINATE_ANY });
  game = throwDart(game, red(1));
  game = throwDart(game, colour(16));
  game = throwDart(game, red(2));
  assert.equal(game.phase, 'takeout');
  assert.equal(game.target.kind, 'colour');
  game = endTurn(game);
  assert.equal(game.current, 1);
  assert.deepEqual(game.target, { kind: 'red' });
  assert.equal(game.breakScore, 0);
});

test('the break score adds up during a turn', () => {
  let game = newGame(['A', 'B'], { nominate: NOMINATE_ANY });
  game = throwDart(throwDart(game, red(1)), colour(20));
  assert.equal(game.breakScore, 7);
});

test('colours start only after the last red and its colour', () => {
  let game = withReds(newGame(['A', 'B'], { nominate: NOMINATE_ANY }), 14);
  game = throwDart(game, red(15));
  assert.equal(game.reds.length, 15);
  assert.equal(game.target.kind, 'colour');
  game = throwDart(game, colour(20));
  assert.deepEqual(game.target, { kind: 'clearance', colour: 16 });
});

test('a foul on the last colour moves the next player on to the colours', () => {
  let game = withReds(newGame(['A', 'B']), 14);
  game = throwDart(game, red(15));
  game = endTurn(throwDart(game, miss));
  assert.deepEqual(game.target, { kind: 'clearance', colour: 16 });
});

test('the colours go in order and cannot be skipped', () => {
  let game = atClearance(16);
  const skipped = throwDart(game, colour(17));
  assert.equal(skipped.last.foul, true);
  game = throwDart(game, colour(16));
  assert.deepEqual(game.target, { kind: 'clearance', colour: 17 });
  assert.equal(left(game), 2);
  assert.equal(game.clearance, 17);
});

test('a missed colour stays on for the next player', () => {
  const game = endTurn(throwDart(atClearance(18), miss));
  assert.deepEqual(game.target, { kind: 'clearance', colour: 18 });
});

test('potting the black ends the frame and the higher score wins', () => {
  const leading = { ...atClearance(BLACK), scores: { left: 3, right: 40 } };
  const game = throwDart(leading, colour(BLACK));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 'right');
  assert.equal(game.winnerText, 'B wins!');
  assert.equal(game.scores.left, 10);
});

test('level scores after the black go to a re-spotted black', () => {
  const level = { ...atClearance(BLACK), scores: { left: 13, right: 20 } };
  let game = throwDart(level, colour(BLACK));
  assert.equal(game.phase, 'takeout');
  assert.equal(game.respottedBlack, true);
  game = endTurn(game);
  assert.equal(game.current, 1);
  assert.deepEqual(game.target, { kind: 'clearance', colour: BLACK });
  game = throwDart(game, colour(BLACK));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 'right');
});

test('a foul on the re-spotted black loses the frame', () => {
  const game = throwDart({ ...atClearance(BLACK), respottedBlack: true, scores: { left: 20, right: 20 } }, miss);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 'right');
  assert.equal(right(game), 27);
});

test('three and four players split into two teams with equal turns', () => {
  let trio = newGame(['A', 'B', 'C']);
  assert.deepEqual(trio.players.map((p) => p.side), ['left', 'right', 'right']);
  const turns = [];
  for (let i = 0; i < 4; i++) {
    turns.push(trio.players[trio.current].name);
    trio = endTurn(throwDart(trio, miss));
  }
  assert.deepEqual(turns, ['A', 'B', 'A', 'C']);
  const four = newGame(['A', 'B', 'C', 'D']);
  assert.deepEqual(four.players.map((p) => p.side), ['left', 'right', 'left', 'right']);
});

test('a teammate’s foul gives points to the other team', () => {
  const game = throwDart({ ...newGame(['A', 'B', 'C', 'D']), current: 2, turnStep: 2 }, miss);
  assert.equal(right(game), 4);
  assert.equal(left(game), 0);
});

test('team wins name both players', () => {
  const game = throwDart({ ...atClearance(BLACK), players: newGame(['A', 'B', 'C', 'D']).players, turnOrder: [0, 1, 2, 3], current: 1, scores: { left: 1, right: 30 } }, colour(BLACK));
  assert.equal(game.winnerText, 'B & D win!');
});

test('real throws work, and bouncers count as a foul', () => {
  const dart = dartFromThrow({ bed: 'SingleInner', multiplier: 1, segmentName: 'S9', segmentNumber: 9 });
  assert.deepEqual(throwDart(newGame(['A', 'B']), dart).reds, [9]);
  const bouncer = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T9', segmentNumber: 9, bouncer: true });
  assert.equal(throwDart(newGame(['A', 'B']), bouncer).last.foul, true);
});
