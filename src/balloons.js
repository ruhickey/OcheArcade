import { DARTS_PER_TURN } from './turns.js';
import { advance, isFinalTurn } from './rounds.js';
import { TURN_MS, elapsedMs, freshClock, isExpired, startedClock } from '../public/games/turn-clock.js';

export const ROUND_CHOICES = [3, 5, 10];
export const DEFAULT_ROUNDS = 5;
export const CLOCK_CHOICES = ['20 seconds', 'No clock'];
const NO_CLOCK = 'No clock';

// The edge of a bubble scores half its value, rising to the full value at its centre.
const EDGE_SHARE = 0.5;

// Smaller bubbles are worth more. Sizes use board radii, with 1 at the edge of the doubles.
const BUBBLES = [
  { value: 10, r: 0.2 },
  { value: 20, r: 0.17 },
  { value: 30, r: 0.145 },
  { value: 50, r: 0.12 },
  { value: 100, r: 0.1 },
];
const BUBBLE_GAP = 0.02;
const PLACEMENT_TRIES = 200;

// Anywhere fully inside the scoring area, equally likely across the board.
function randomSpot(r) {
  const distance = Math.sqrt(Math.random()) * (1 - r);
  const angle = Math.random() * Math.PI * 2;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

// Bubbles stay put for the whole turn, so they're placed clear of each other. Largest go first.
function placeBubbles() {
  const placed = [];
  for (const { value, r } of BUBBLES) {
    let spot = randomSpot(r);
    for (let tries = 0; tries < PLACEMENT_TRIES; tries++) {
      const clear = placed.every((other) => Math.hypot(spot.x - other.x, spot.y - other.y) >= r + other.r + BUBBLE_GAP);
      if (clear) break;
      spot = randomSpot(r);
    }
    placed.push({ value, r, ...spot, popped: false });
  }
  return placed;
}

function startTurn(game) {
  return { ...game, darts: [], phase: 'throwing', last: null, bubbles: placeBubbles(), clock: game.timed ? freshClock(Date.now()) : null };
}

function winnerText(winner, game) {
  const verb = game.players.length === 1 ? 'finishes' : 'wins';
  return `${winner.name} ${verb} with ${winner.points} points!`;
}

const rules = { score: (player) => player.points, winnerText, startTurn };

export function newGame(names, { rounds = DEFAULT_ROUNDS, clock = CLOCK_CHOICES[0] } = {}) {
  return startTurn({
    type: 'balloons',
    players: names.map((name) => ({ name, points: 0 })),
    current: 0,
    round: 1,
    rounds,
    timed: clock !== NO_CLOCK,
    playoff: null,
    phase: 'throwing',
    winner: null,
    winnerText: null,
    seq: 0,
  });
}

// Finds the bubble this dart scores most on. Placement keeps them apart, but a dart could still be level.
function bestHit(bubbles, dart) {
  if (!Number.isFinite(dart.x) || !Number.isFinite(dart.y)) return null;
  let best = null;
  bubbles.forEach((bubble, index) => {
    if (bubble.popped) return;
    const distance = Math.hypot(dart.x - bubble.x, dart.y - bubble.y);
    if (distance > bubble.r) return;
    const share = 1 - (1 - EDGE_SHARE) * (distance / bubble.r);
    const points = Math.round(bubble.value * share);
    if (!best || points > best.points) best = { index, points, x: bubble.x, y: bubble.y };
  });
  return best;
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const now = Date.now();
  const landed = dart.at ?? now;
  const started = game.timed ? startedClock(game.clock, now) : null;
  const ms = game.timed ? elapsedMs(started, landed) : 0;
  const tooLate = ms > TURN_MS;
  const hit = tooLate ? null : bestHit(game.bubbles, dart);

  const darts = [...game.darts, { x: dart.x ?? null, y: dart.y ?? null, points: hit?.points ?? 0, tooLate, value: hit ? game.bubbles[hit.index].value : null }];
  const full = darts.length >= DARTS_PER_TURN;
  const next = {
    ...game,
    players: game.players.map((p, i) => (i === game.current ? { ...p, points: p.points + (hit?.points ?? 0) } : p)),
    bubbles: hit ? game.bubbles.map((b, i) => (i === hit.index ? { ...b, popped: true } : b)) : game.bubbles,
    darts,
    phase: full ? 'takeout' : 'throwing',
    clock: game.timed ? { ...started, heldMs: Math.min(ms, TURN_MS), frozen: full } : null,
    seq: game.seq + 1,
    last: {
      player: game.current,
      points: hit?.points ?? 0,
      value: hit ? game.bubbles[hit.index].value : null,
      popX: hit?.x ?? null,
      popY: hit?.y ?? null,
      tooLate,
    },
  };
  // A decided match ends on the final dart. If it goes to a playoff, the darts come out first.
  if (full && isFinalTurn(game)) {
    const ended = advance(next, rules);
    if (ended.phase === 'over') return ended;
  }
  return next;
}

export function endTurn(game) {
  if (game.phase === 'over' || game.darts.length === 0) return game;
  return advance(game, rules);
}

// Called regularly by the server to enforce the 20 seconds.
export function tick(game) {
  if (game.phase !== 'throwing' || !game.timed) return game;
  if (!isExpired(game.clock, Date.now())) return game;
  // With no darts in the board there's no takeout to wait for.
  if (game.darts.length === 0) return advance(game, rules);
  return { ...game, phase: 'takeout', clock: { ...game.clock, heldMs: TURN_MS, frozen: true } };
}

// After an undo, the turn picks up where it was with a fresh countdown.
export function resume(game) {
  if (game.phase !== 'throwing' || !game.timed) return game;
  return { ...game, clock: freshClock(Date.now(), game.clock.heldMs) };
}
