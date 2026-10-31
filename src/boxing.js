import { DARTS_PER_TURN } from './turns.js';

export const TARGET_CHOICES = [2, 3];
export const DEFAULT_TARGETS = 3;
export const DIFFICULTY = {
  Easy: { lives: 10, damageScale: 2, note: '10 lives, and hits do double damage' },
  Normal: { lives: 15, damageScale: 2, note: '15 lives, and hits do double damage' },
  Hard: { lives: 20, damageScale: 1, note: '20 lives, and hits do normal damage' },
};
export const DEFAULT_DIFFICULTY = 'Normal';

const BED_POWER = { SingleInner: 1, SingleOuter: 1, Double: 2, Triple: 3 };
const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function newGame(names, { targets = DEFAULT_TARGETS, difficulty = DEFAULT_DIFFICULTY } = {}) {
  const { lives, damageScale } = DIFFICULTY[difficulty];
  const deck = shuffled(NUMBERS);
  return {
    type: 'boxing',
    players: names.map((name, i) => ({
      name,
      lives,
      targets: deck.slice(i * targets, (i + 1) * targets).sort((a, b) => a - b),
    })),
    maxLives: lives,
    damageScale,
    current: 0,
    darts: [],
    phase: 'throwing',
    winner: null,
    winnerText: null,
    seq: 0,
    last: null,
  };
}

function resolve(game, dart) {
  const power = BED_POWER[dart.id];
  const owner = power ? game.players.findIndex((p) => p.targets.includes(dart.number)) : -1;
  if (owner === -1) return { result: 'miss', owner: null, change: 0 };
  if (game.players[owner].lives === 0) return { result: 'out', owner, change: 0 };

  if (owner === game.current) {
    const change = Math.min(power, game.maxLives - game.players[owner].lives);
    return { result: change ? 'heal' : 'full', owner, change };
  }
  const change = -Math.min(power * game.damageScale, game.players[owner].lives);
  return { result: 'hit', owner, change };
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const { result, owner, change } = resolve(game, dart);
  const players = game.players.map((p, i) => (i === owner ? { ...p, lives: p.lives + change } : p));
  const standing = players.map((_, i) => i).filter((i) => players[i].lives > 0);
  const darts = [...game.darts, { name: dart.name, result, change }];
  const next = {
    ...game,
    players,
    darts,
    seq: game.seq + 1,
    last: { player: game.current, name: dart.name, result, owner, change, knockedOut: result === 'hit' && players[owner].lives === 0 },
  };

  if (standing.length === 1) {
    return { ...next, darts: [], phase: 'over', winner: standing[0], winnerText: `${players[standing[0]].name} wins by knockout!` };
  }
  return { ...next, phase: darts.length >= DARTS_PER_TURN ? 'takeout' : 'throwing' };
}

// The next player still standing takes over.
export function endTurn(game) {
  if (game.phase === 'over' || game.darts.length === 0) return game;
  let current = game.current;
  do {
    current = (current + 1) % game.players.length;
  } while (game.players[current].lives === 0);
  return { ...game, current, darts: [], phase: 'throwing', last: null };
}
