import test from 'node:test';
import assert from 'node:assert/strict';
import { dartFromThrow, makeDart } from '../src/segments.js';
import { DIFFICULTY, endTurn, newGame, resume, throwDart, tick } from '../src/circuit.js';
import { LEFT_HALF, RIGHT_HALF, matches, targetText } from '../public/games/circuit-rules.js';
import { PREP_MS, TURN_MS, elapsedMs } from '../public/games/turn-clock.js';
import { boardCleared } from '../src/turns.js';

const miss = makeDart('Miss');
const single = (n) => makeDart('SingleOuter', n);

function setup(t, names = ['A', 'B'], options = {}) {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  return { game: newGame(names, options), advance: (ms) => { now += ms; }, get now() { return now; } };
}

// Fixes the wires to known targets: odd, then even, then odd.
const fixed = (game, wires = [{ kind: 'odd' }, { kind: 'even' }, { kind: 'odd' }]) => ({ ...game, wires });

test('board halves cover all 20 numbers once', () => {
  assert.equal(LEFT_HALF.length, 10);
  assert.equal(RIGHT_HALF.length, 10);
  assert.equal(new Set([...LEFT_HALF, ...RIGHT_HALF]).size, 20);
});

test('regions accept any bed of the right numbers, but never a bull', () => {
  for (const bed of ['SingleInner', 'SingleOuter', 'Double', 'Triple']) {
    assert.equal(matches({ kind: 'odd' }, bed, 7), true);
    assert.equal(matches({ kind: 'even' }, bed, 7), false);
    assert.equal(matches({ kind: 'left' }, bed, 11), true);
    assert.equal(matches({ kind: 'right' }, bed, 11), false);
    assert.equal(matches({ kind: 'right' }, bed, 20), true);
  }
  for (const bed of ['InnerBull', 'OuterBull']) {
    for (const kind of ['odd', 'even', 'left', 'right']) assert.equal(matches({ kind }, bed, 25), false);
  }
  assert.equal(matches({ kind: 'odd' }, 'Miss', 7), false);
});

test('precise targets need the right number and bed', () => {
  assert.equal(matches({ kind: 'single', number: 5 }, 'SingleInner', 5), true);
  assert.equal(matches({ kind: 'single', number: 5 }, 'SingleOuter', 5), true);
  assert.equal(matches({ kind: 'single', number: 5 }, 'Double', 5), false);
  assert.equal(matches({ kind: 'single', number: 5 }, 'SingleOuter', 6), false);
  assert.equal(matches({ kind: 'double', number: 5 }, 'Double', 5), true);
  assert.equal(matches({ kind: 'double', number: 5 }, 'Triple', 5), false);
  assert.equal(matches({ kind: 'triple', number: 5 }, 'Triple', 5), true);
  assert.equal(matches({ kind: 'triple', number: 5 }, 'SingleInner', 5), false);
});

test('target text reads clearly', () => {
  assert.equal(targetText({ kind: 'left' }), 'Left half');
  assert.equal(targetText({ kind: 'triple', number: 20 }), 'Triple 20');
});

test('each difficulty deals its own kinds of target, three different ones to a bomb', (t) => {
  const kinds = { Easy: new Set(), Medium: new Set(), Hard: new Set() };
  for (const difficulty of Object.keys(kinds)) {
    for (let run = 0; run < 200; run++) {
      const { wires } = newGame(['A'], { difficulty });
      assert.equal(wires.length, 3);
      assert.equal(new Set(wires.map((w) => targetText(w))).size, 3);
      wires.forEach((wire) => kinds[difficulty].add(wire.kind));
    }
  }
  assert.deepEqual([...kinds.Easy].sort(), ['even', 'left', 'odd', 'right']);
  assert.deepEqual([...kinds.Medium].sort(), ['even', 'left', 'odd', 'right', 'single']);
  assert.deepEqual([...kinds.Hard].sort(), ['double', 'single', 'triple']);
});

test('difficulty sets the lives', () => {
  for (const [difficulty, { lives }] of Object.entries(DIFFICULTY)) {
    assert.equal(newGame(['A'], { difficulty }).lives, lives);
  }
});

test('hitting the target cuts the wire and moves to the next', (t) => {
  const { game } = setup(t);
  const after = throwDart(fixed(game), single(1));
  assert.equal(after.wire, 1);
  assert.equal(after.lives, game.lives);
  assert.equal(after.players[0].cuts, 1);
  assert.equal(after.last.hit, true);
});

test('missing costs a life and the wire stays', (t) => {
  const { game } = setup(t);
  for (const dart of [single(2), makeDart('InnerBull'), miss]) {
    const after = throwDart(fixed(game), dart);
    assert.equal(after.lives, game.lives - 1);
    assert.equal(after.wire, 0);
    assert.equal(after.darts.length, 1);
    assert.equal(after.phase, 'throwing');
  }
});

test('bouncers count as a miss, and real throws count', (t) => {
  const { game } = setup(t);
  const bouncer = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T1', segmentNumber: 1, bouncer: true });
  assert.equal(throwDart(fixed(game), bouncer).lives, game.lives - 1);
  const real = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T1', segmentNumber: 1 });
  assert.equal(throwDart(fixed(game), real).wire, 1);
});

test('cutting all three wires defuses the bomb and brings the next, with darts carrying on', (t) => {
  const { game } = setup(t, ['A', 'B'], { bombs: 3 });
  let after = fixed(game);
  after = throwDart(throwDart(after, single(1)), single(2));
  assert.equal(after.defused, 0);
  after = throwDart(after, single(3));
  assert.equal(after.defused, 1);
  assert.equal(after.wire, 0);
  assert.equal(after.last.defusedBomb, true);
  assert.equal(after.phase, 'takeout');
  assert.notEqual(after.wires, game.wires);
});

test('defusing the last bomb wins for the team, even mid-turn', (t) => {
  const { game } = setup(t, ['A', 'B'], { bombs: 1 });
  let after = { ...fixed(game), wire: 2 };
  after = throwDart(after, single(1));
  assert.equal(after.phase, 'over');
  assert.equal(after.winner, true);
  assert.equal(after.winnerText, 'Bomb squad wins!');
  assert.equal(throwDart(after, single(1)), after);
});

test('losing the last life detonates the bomb', (t) => {
  const { game } = setup(t);
  const after = throwDart({ ...fixed(game), lives: 1 }, miss);
  assert.equal(after.lives, 0);
  assert.equal(after.phase, 'over');
  assert.equal(after.winner, false);
  assert.equal(after.winnerText, 'The bomb detonated!');
});

test('three darts then takeout, then the next player takes over the same bomb', (t) => {
  const { game } = setup(t);
  let after = fixed(game);
  after = throwDart(throwDart(after, single(1)), single(2));
  after = throwDart(after, miss);
  assert.equal(after.phase, 'takeout');
  assert.equal(throwDart(after, single(1)), after);
  after = boardCleared(after, endTurn);
  assert.equal(after.current, 1);
  assert.equal(after.wire, 2);
  assert.deepEqual(after.darts, []);
});

test('ending a turn with no darts does nothing', (t) => {
  const { game } = setup(t);
  assert.equal(endTurn(game), game);
});

test('the clock waits through the countdown and gives 20 seconds', (t) => {
  const s = setup(t);
  assert.equal(tick(s.game), s.game);
  s.advance(PREP_MS + TURN_MS);
  assert.equal(tick(s.game), s.game);
  assert.equal(elapsedMs(s.game.clock, s.now), TURN_MS);
});

test('timing out with no darts costs a life and moves on', (t) => {
  const s = setup(t);
  s.advance(PREP_MS + TURN_MS + 1000);
  const after = tick(s.game);
  assert.equal(after.lives, s.game.lives - 1);
  assert.equal(after.current, 1);
  assert.equal(after.phase, 'throwing');
  assert.equal(after.last.timedOut, true);
  assert.equal(elapsedMs(after.clock, s.now), 0);
});

test('timing out with darts in the board waits for takeout', (t) => {
  const s = setup(t);
  s.advance(PREP_MS + 1000);
  const thrown = throwDart(fixed(s.game), single(1));
  s.advance(TURN_MS);
  const after = tick(thrown);
  assert.equal(after.lives, s.game.lives - 1);
  assert.equal(after.phase, 'takeout');
  assert.equal(after.current, 0);
  assert.equal(endTurn(after).current, 1);
});

test('timing out on the last life detonates', (t) => {
  const s = setup(t);
  s.advance(PREP_MS + TURN_MS + 1000);
  const after = tick({ ...s.game, lives: 1 });
  assert.equal(after.phase, 'over');
  assert.equal(after.winner, false);
});

test('a dart landing after the buzzer costs a life and ends the turn', (t) => {
  const s = setup(t);
  s.advance(PREP_MS + TURN_MS + 500);
  const after = throwDart(fixed(s.game), single(1));
  assert.equal(after.lives, s.game.lives - 1);
  assert.equal(after.wire, 0);
  assert.equal(after.last.tooLate, true);
  assert.equal(after.phase, 'takeout');
});

test('a dart thrown before the buzzer but detected after still counts', (t) => {
  const s = setup(t);
  s.advance(PREP_MS + TURN_MS + 500);
  const after = throwDart(fixed(s.game), { ...single(1), at: s.now - 800 });
  assert.equal(after.wire, 1);
  assert.equal(after.lives, s.game.lives);
});

test('the clock stops at takeout', (t) => {
  const s = setup(t);
  s.advance(PREP_MS + 2000);
  let after = fixed(s.game);
  for (let i = 0; i < 3; i++) after = throwDart(after, miss);
  s.advance(60000);
  assert.equal(elapsedMs(after.clock, s.now), 2000);
  assert.equal(tick(after), after);
});

test('undo resumes from the held time after a new countdown', (t) => {
  const s = setup(t);
  s.advance(PREP_MS + 4000);
  const first = throwDart(fixed(s.game), miss);
  s.advance(30000);
  const resumed = resume(first);
  assert.equal(elapsedMs(resumed.clock, s.now), 4000);
  s.advance(PREP_MS + 1000);
  assert.equal(elapsedMs(resumed.clock, s.now), 5000);
});

test('one player can defuse alone', (t) => {
  const { game } = setup(t, ['Solo'], { bombs: 1 });
  let after = fixed(game);
  after = throwDart(throwDart(after, single(1)), single(2));
  after = throwDart(after, single(3));
  assert.equal(after.winner, true);
});

test('a dart thrown before the buzzer but arriving on the next turn counts for nobody', (t) => {
  const s = setup(t);
  s.advance(PREP_MS + TURN_MS + 1000);
  const next = tick(fixed(s.game));
  assert.equal(next.current, 1);
  const livesLeft = next.lives;

  s.advance(300);
  const late = { ...single(2), at: s.now - 700 };
  assert.equal(throwDart(next, late), next);
  assert.equal(next.lives, livesLeft);

  const real = throwDart(fixed(next), { ...single(1), at: s.now });
  assert.equal(real.darts.length, 1);
  assert.equal(real.last.player, 1);
});

const beginnerWires = [{ kind: 'double', number: 20 }, { kind: 'triple', number: 5 }, { kind: 'odd' }];
const beginnerFirst = () => fixed(
  newGame([{ name: 'A', beginner: true }, { name: 'B', beginner: false }]),
  beginnerWires,
);

test('any bed of the number cuts a beginner’s wire, but not anyone else’s', () => {
  assert.equal(throwDart(beginnerFirst(), single(20)).wire, 1);
  const other = throwDart({ ...beginnerFirst(), current: 1 }, single(20));
  assert.equal(other.wire, 0);
  assert.equal(other.last.hit, false);
});

test('only a beginner’s first miss of a turn is free', () => {
  const start = beginnerFirst();
  const first = throwDart(start, single(1));
  assert.equal(first.lives, start.lives);
  assert.equal(first.last.spared, true);
  const second = throwDart(first, single(1));
  assert.equal(second.lives, start.lives - 1);
  assert.equal(second.last.spared, false);
});

test('anyone else’s first miss costs a life', () => {
  const start = { ...beginnerFirst(), current: 1 };
  assert.equal(throwDart(start, single(1)).lives, start.lives - 1);
});

test('a beginner’s free miss comes back the next turn', () => {
  const miss = single(1);
  const turn = [miss, miss, miss].reduce(throwDart, beginnerFirst());
  const next = endTurn(turn);
  assert.equal(next.darts.length, 0);
  assert.equal(throwDart({ ...next, current: 0 }, miss).last.spared, true);
});

test('matches and targetText accept any bed when asked', () => {
  const target = { kind: 'triple', number: 5 };
  assert.equal(matches(target, 'SingleOuter', 5), false);
  assert.equal(matches(target, 'SingleOuter', 5, true), true);
  assert.equal(matches(target, 'SingleOuter', 6, true), false);
  assert.equal(targetText(target), 'Triple 5');
  assert.equal(targetText(target, true), 'Any 5');
  assert.equal(targetText({ kind: 'odd' }, true), 'Odd');
});
