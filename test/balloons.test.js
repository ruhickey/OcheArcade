import test from 'node:test';
import assert from 'node:assert/strict';
import { dartFromThrow, makeDart } from '../src/segments.js';
import { CLOCK_CHOICES, endTurn, newGame, resume, throwDart, tick } from '../src/balloons.js';
import { PREP_MS, TURN_MS, elapsedMs } from '../public/games/turn-clock.js';

const still = (value, x, y, r = 0.2) => ({ value, r, x, y, popped: false });
const dartAt = (x, y, at) => ({ x, y, at });
const missDart = (at) => ({ x: null, y: null, at });

function setup(t, names = ['A', 'B'], options = {}) {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const clock = { advance: (ms) => { now += ms; }, get now() { return now; } };
  const game = newGame(names, options);
  return { game, clock };
}

function withBubbles(game, bubbles) {
  return { ...game, bubbles };
}

test('bubbles land fully on the board, clear of each other, with smaller ones worth more', (t) => {
  const { game } = setup(t);
  assert.equal(game.bubbles.length, 5);
  const byValue = [...game.bubbles].sort((a, b) => a.value - b.value);
  for (let i = 1; i < byValue.length; i++) assert.ok(byValue[i].r < byValue[i - 1].r);

  let current = game;
  const seen = new Set();
  for (let turn = 0; turn < 500; turn++) {
    for (const [i, b] of current.bubbles.entries()) {
      assert.ok(Math.hypot(b.x, b.y) <= 1 - b.r + 1e-9, 'off the board');
      for (const other of current.bubbles.slice(i + 1)) {
        assert.ok(Math.hypot(b.x - other.x, b.y - other.y) >= b.r + other.r, 'overlapping');
      }
    }
    seen.add(current.bubbles[0].x);
    current = newGame(['A', 'B']);
  }
  assert.ok(seen.size > 400, 'placement should vary');
});

test('bubbles stay in the same place throughout a turn', (t) => {
  const { game, clock } = setup(t);
  clock.advance(PREP_MS + 5000);
  const after = throwDart(game, { x: null, y: null });
  clock.advance(5000);
  const later = throwDart(after, { x: null, y: null });
  for (const [i, b] of later.bubbles.entries()) {
    assert.equal(b.x, game.bubbles[i].x);
    assert.equal(b.y, game.bubbles[i].y);
  }
});

test('closer to the centre of a bubble scores more', (t) => {
  const { game } = setup(t);
  const board = withBubbles(game, [still(100, 0, 0)]);
  assert.equal(throwDart(board, dartAt(0, 0)).players[0].points, 100);
  assert.equal(throwDart(board, dartAt(0.1, 0)).players[0].points, 75);
  assert.equal(throwDart(board, dartAt(0.2, 0)).players[0].points, 50);
});

test('darts outside every bubble, or without a position, score nothing', (t) => {
  const { game } = setup(t);
  const board = withBubbles(game, [still(100, 0, 0)]);
  assert.equal(throwDart(board, dartAt(0.21, 0)).players[0].points, 0);
  const noPosition = throwDart(board, missDart());
  assert.equal(noPosition.players[0].points, 0);
  assert.equal(noPosition.darts.length, 1);
});

test('a popped bubble cannot be hit again', (t) => {
  const { game } = setup(t);
  let board = withBubbles(game, [still(100, 0, 0)]);
  board = throwDart(board, dartAt(0, 0));
  assert.equal(board.bubbles[0].popped, true);
  board = throwDart(board, dartAt(0, 0));
  assert.equal(board.players[0].points, 100);
});

test('overlapping bubbles award the better score', (t) => {
  const { game } = setup(t);
  const board = withBubbles(game, [still(10, 0, 0), still(100, 0.05, 0)]);
  const after = throwDart(board, dartAt(0.05, 0));
  assert.equal(after.players[0].points, 100);
  assert.equal(after.bubbles[0].popped, false);
});

test('real throws carry their position, and bouncers do not', () => {
  const dart = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentNumber: 1, coordsX: 0.25, coordsY: 0.55 });
  assert.equal(dart.x, 0.25);
  assert.equal(dart.y, 0.55);
  const bouncer = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentNumber: 1, coordsX: 0.25, coordsY: 0.55, bouncer: true });
  assert.equal(bouncer.x, undefined);
  assert.equal(makeDart('Triple', 1).x, undefined);
});

test('the clock holds through the countdown, then runs for 20 seconds', (t) => {
  const { game, clock } = setup(t);
  assert.equal(elapsedMs(game.clock, clock.now), 0);
  clock.advance(PREP_MS - 1);
  assert.equal(elapsedMs(game.clock, clock.now), 0);
  clock.advance(1 + 1500);
  assert.equal(elapsedMs(game.clock, clock.now), 1500);
});

test('throwing during the countdown starts the clock straight away', (t) => {
  const { game, clock } = setup(t);
  clock.advance(1000);
  const after = throwDart(withBubbles(game, [still(10, 0, 0)]), dartAt(0.9, 0.9));
  assert.equal(after.clock.prepUntil, clock.now);
  clock.advance(2000);
  assert.equal(elapsedMs(after.clock, clock.now), 2000);
});

test('time running out with no darts moves straight to the next player', (t) => {
  const { game, clock } = setup(t);
  assert.equal(tick(game), game);
  clock.advance(PREP_MS + TURN_MS);
  assert.equal(tick(game), game);
  clock.advance(1000);
  const after = tick(game);
  assert.equal(after.current, 1);
  assert.equal(after.phase, 'throwing');
});

test('time running out after a dart waits for takeout, and new darts are ignored', (t) => {
  const { game, clock } = setup(t);
  clock.advance(PREP_MS + 1000);
  let after = throwDart(game, missDart());
  clock.advance(TURN_MS);
  after = tick(after);
  assert.equal(after.phase, 'takeout');
  assert.equal(throwDart(after, dartAt(0, 0)), after);
  assert.equal(endTurn(after).current, 1);
});

test('a dart landing after the buzzer scores nothing but one before it counts', (t) => {
  const { game, clock } = setup(t);
  const board = withBubbles(game, [still(100, 0, 0)]);
  clock.advance(PREP_MS + TURN_MS + 500);
  const late = throwDart(board, dartAt(0, 0));
  assert.equal(late.players[0].points, 0);
  assert.equal(late.last.tooLate, true);
  const inTime = throwDart(board, dartAt(0, 0, clock.now - 800));
  assert.equal(inTime.players[0].points, 100);
});

test('the clock stops after the third dart', (t) => {
  const { game, clock } = setup(t);
  clock.advance(PREP_MS + 3000);
  let after = game;
  for (let i = 0; i < 3; i++) after = throwDart(after, missDart());
  assert.equal(after.phase, 'takeout');
  clock.advance(60000);
  assert.equal(elapsedMs(after.clock, clock.now), 3000);
  assert.equal(tick(after), after);
});

test('each turn gets fresh bubbles and a fresh clock', (t) => {
  const { game, clock } = setup(t);
  clock.advance(PREP_MS + 3000);
  const after = endTurn(throwDart(game, dartAt(game.bubbles[0].x, game.bubbles[0].y)));
  assert.equal(after.current, 1);
  assert.ok(after.bubbles.every((b) => !b.popped));
  assert.equal(elapsedMs(after.clock, clock.now), 0);
  assert.equal(after.clock.prepUntil, clock.now + PREP_MS);
});

test('undo resumes the turn from its held time after a fresh countdown', (t) => {
  const { game, clock } = setup(t);
  clock.advance(PREP_MS + 4000);
  const first = throwDart(game, missDart());
  clock.advance(30000);
  const resumed = resume(first);
  assert.equal(elapsedMs(resumed.clock, clock.now), 4000);
  clock.advance(PREP_MS + 1000);
  assert.equal(elapsedMs(resumed.clock, clock.now), 5000);
});

test('the clock is on unless turned off', (t) => {
  const { game } = setup(t);
  assert.equal(game.timed, true);
  assert.equal(CLOCK_CHOICES[0], '20 seconds');
  assert.ok(game.clock);
});

test('with no clock, a turn never expires and late darts still score', (t) => {
  const { game, clock } = setup(t, ['A', 'B'], { clock: 'No clock' });
  assert.equal(game.timed, false);
  assert.equal(game.clock, null);

  clock.advance(PREP_MS + TURN_MS * 10);
  assert.equal(tick(game), game);

  const board = withBubbles(game, [still(100, 0, 0)]);
  const after = throwDart(board, dartAt(0, 0, clock.now - 800));
  assert.equal(after.players[0].points, 100);
  assert.equal(after.last.tooLate, false);
  assert.equal(after.clock, null);
  assert.equal(after.phase, 'throwing');

  clock.advance(TURN_MS * 10);
  assert.equal(tick(after), after);
  assert.equal(resume(after), after);
});

test('with no clock, three darts still end the turn and the next player stays untimed', (t) => {
  const { game } = setup(t, ['A', 'B'], { clock: 'No clock' });
  let after = game;
  for (let i = 0; i < 3; i++) after = throwDart(after, missDart());
  assert.equal(after.phase, 'takeout');
  after = endTurn(after);
  assert.equal(after.current, 1);
  assert.equal(after.clock, null);
  assert.ok(after.bubbles.every((b) => !b.popped));
});

test('the most points wins when the rounds run out', (t) => {
  const { game, clock } = setup(t, ['A', 'B'], { rounds: 1 });
  clock.advance(PREP_MS + 100);
  let g = endTurn(throwDart(withBubbles(game, [still(100, 0, 0)]), dartAt(0, 0)));
  clock.advance(PREP_MS + 100);
  g = endTurn(throwDart(g, missDart()));
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
  assert.equal(g.winnerText, 'A wins with 100 points!');
});

test('a draw plays on between the leaders', (t) => {
  const { game } = setup(t, ['A', 'B', 'C'], { rounds: 1 });
  let g = endTurn(throwDart(game, missDart()));
  g = endTurn(throwDart(g, missDart()));
  g = endTurn(throwDart(g, missDart()));
  assert.equal(g.phase, 'throwing');
  assert.deepEqual(g.playoff.queue, [0, 1, 2]);
  g = endTurn(throwDart(withBubbles(g, [still(100, 0, 0)]), dartAt(0, 0)));
  g = endTurn(throwDart(g, missDart()));
  g = endTurn(throwDart(g, missDart()));
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
});

test('one player just gets a final score', (t) => {
  const { game } = setup(t, ['Solo'], { rounds: 1 });
  const g = endTurn(throwDart(withBubbles(game, [still(50, 0, 0)]), dartAt(0, 0)));
  assert.equal(g.winnerText, 'Solo finishes with 50 points!');
});

test('time running out on the last turn with no darts ends the match', (t) => {
  const { game, clock } = setup(t, ['Solo'], { rounds: 1 });
  clock.advance(PREP_MS + TURN_MS + 1000);
  assert.equal(tick(game).phase, 'over');
});
