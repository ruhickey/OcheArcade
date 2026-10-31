import { DARTS_PER_TURN, nextPlayer } from './turns.js';
import { matches } from '../public/games/circuit-rules.js';
import { TURN_MS, elapsedMs, freshClock, isExpired, isFromEarlierTurn, startedClock } from '../public/games/turn-clock.js';

export const WIRES = 3;
export const DIFFICULTY = {
  Easy: { lives: 3, note: 'Odd, even or board halves, with 3 lives' },
  Medium: { lives: 5, note: 'Regions and single numbers, with 5 lives' },
  Hard: { lives: 10, note: 'Exact singles, doubles and triples, with 10 lives' },
};
export const DEFAULT_DIFFICULTY = 'Medium';
export const BOMB_CHOICES = [1, 3, 5];
export const DEFAULT_BOMBS = 3;

const REGION_KINDS = ['odd', 'even', 'left', 'right'];
const PRECISE_KINDS = ['single', 'double', 'triple'];

const pick = (items) => items[Math.floor(Math.random() * items.length)];
const randomNumber = () => 1 + Math.floor(Math.random() * 20);
const region = () => ({ kind: pick(REGION_KINDS) });

const GENERATORS = {
  Easy: region,
  Medium: () => (Math.random() < 0.5 ? region() : { kind: 'single', number: randomNumber() }),
  Hard: () => ({ kind: pick(PRECISE_KINDS), number: randomNumber() }),
};

const sameTarget = (a, b) => a.kind === b.kind && a.number === b.number;

// Each wire on a bomb has a different target.
function newBomb(difficulty) {
  const wires = [];
  while (wires.length < WIRES) {
    const target = GENERATORS[difficulty]();
    if (!wires.some((wire) => sameTarget(wire, target))) wires.push(target);
  }
  return wires;
}

export function newGame(names, { difficulty = DEFAULT_DIFFICULTY, bombs = DEFAULT_BOMBS } = {}) {
  const { lives } = DIFFICULTY[difficulty];
  return {
    type: 'circuit',
    difficulty,
    players: names.map((name) => ({ name, cuts: 0 })),
    current: 0,
    lives,
    maxLives: lives,
    bombs,
    defused: 0,
    wires: newBomb(difficulty),
    wire: 0,
    darts: [],
    phase: 'throwing',
    clock: freshClock(Date.now()),
    winner: null,
    winnerText: null,
    seq: 0,
    last: null,
  };
}

const DETONATED = 'The bomb detonated!';
const SAVED = 'Bomb squad wins!';

function explode(game) {
  const lives = game.lives - 1;
  return { lives, over: lives === 0 ? { phase: 'over', winner: false, winnerText: DETONATED, darts: [] } : null };
}

function cutWire(game) {
  const wire = game.wire + 1;
  if (wire < WIRES) return { wire };
  const defused = game.defused + 1;
  if (defused === game.bombs) return { wire, defused, phase: 'over', winner: true, winnerText: SAVED, darts: [] };
  return { defused, wire: 0, wires: newBomb(game.difficulty) };
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const now = Date.now();
  const landed = dart.at ?? now;
  if (isFromEarlierTurn(game.clock, landed)) return game;
  const clock = startedClock(game.clock, now);
  const ms = elapsedMs(clock, landed);
  const tooLate = ms > TURN_MS;
  const target = game.wires[game.wire];
  const hit = !tooLate && matches(target, dart.id, dart.number);

  const darts = [...game.darts, { name: dart.name, hit }];
  const full = darts.length >= DARTS_PER_TURN;
  const base = {
    ...game,
    darts,
    phase: full || tooLate ? 'takeout' : 'throwing',
    clock: { ...clock, heldMs: Math.min(ms, TURN_MS), frozen: full || tooLate },
    seq: game.seq + 1,
    last: { player: game.current, name: dart.name, hit, tooLate, target },
  };

  if (hit) {
    const players = game.players.map((p, i) => (i === game.current ? { ...p, cuts: p.cuts + 1 } : p));
    const cut = cutWire(game);
    return { ...base, players, ...cut, last: { ...base.last, defusedBomb: cut.wire === 0 || cut.wire === WIRES } };
  }
  const { lives, over } = explode(game);
  return { ...base, lives, ...over };
}

function startNextTurn(game) {
  return { ...nextPlayer(game), clock: freshClock(Date.now()) };
}

export function endTurn(game) {
  if (game.phase === 'over' || game.darts.length === 0) return game;
  return startNextTurn(game);
}

// Called regularly by the server: running out of time costs a life.
export function tick(game) {
  if (game.phase !== 'throwing' || !isExpired(game.clock, Date.now())) return game;
  const { lives, over } = explode(game);
  const timedOut = { ...game, lives, last: { player: game.current, timedOut: true } };
  if (over) return { ...timedOut, ...over };
  // With no darts in the board there's no takeout to wait for.
  if (game.darts.length === 0) return { ...startNextTurn(timedOut), last: timedOut.last };
  return { ...timedOut, phase: 'takeout', clock: { ...game.clock, heldMs: TURN_MS, frozen: true } };
}

// After an undo, the turn picks up where it was with a fresh countdown.
export function resume(game) {
  if (game.phase !== 'throwing') return game;
  return { ...game, clock: freshClock(Date.now(), game.clock.heldMs) };
}
