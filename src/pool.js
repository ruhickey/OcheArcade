import { DARTS_PER_TURN, nextPlayer } from './turns.js';
import { arrange, sideNames, sideOf, turnOrderFor } from './teams.js';
import { shuffled } from './shuffle.js';

export { arrange };

export const BALLS = 7;
export const BULL = 25;
export const MODES = {
  Normal: { tough: 0, note: 'Any part of the number pots a ball' },
  Hard: { tough: 4, note: '4 balls need a double or triple, and 3 can be any segment. A single on the right number keeps your turn going' },
};
export const DEFAULT_MODE = 'Normal';

const TOUGH_BEDS = ['Double', 'Triple'];
const SINGLE_BEDS = ['SingleInner', 'SingleOuter'];
const NUMBER_BEDS = [...SINGLE_BEDS, ...TOUGH_BEDS];
const BULL_BEDS = ['InnerBull', 'OuterBull'];
const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

function rack(numbers, toughCount) {
  const tough = new Set(shuffled(numbers).slice(0, toughCount));
  return { balls: numbers.map((number) => ({ number, tough: tough.has(number) })), potted: 0, thrown: 0, finished: false };
}

export function newGame(names, { mode = DEFAULT_MODE } = {}) {
  const deck = shuffled(NUMBERS);
  const { tough } = MODES[mode];
  return {
    type: 'pool',
    players: names.map((name, i) => ({ name, side: sideOf(i, names.length), thrown: 0 })),
    current: 0,
    turnOrder: turnOrderFor(names.length),
    turnStep: 0,
    sides: {
      left: rack(deck.slice(0, BALLS), tough),
      right: rack(deck.slice(BALLS, BALLS * 2), tough),
    },
    lastChance: false,
    shootout: null, // one dart each at the bull when the dart counts are level
    turnOver: false,
    darts: [],
    phase: 'throwing',
    winner: null,
    winnerText: null,
    seq: 0,
    last: null,
  };
}

function isOnTarget(game, side, dart) {
  const { balls, potted } = game.sides[side];
  if (game.shootout || potted === BALLS) return BULL_BEDS.includes(dart.id);
  const ball = balls[potted];
  if (dart.number !== ball.number) return false;
  return (ball.tough ? TOUGH_BEDS : NUMBER_BEDS).includes(dart.id);
}

// A single on a double-or-triple ball pots nothing, but doesn't cost the rest of the turn.
function isNearMiss(game, side, dart) {
  const { balls, potted } = game.sides[side];
  if (game.shootout || potted === BALLS) return false;
  const ball = balls[potted];
  return ball.tough && dart.number === ball.number && SINGLE_BEDS.includes(dart.id);
}

const other = (side) => (side === 'left' ? 'right' : 'left');
const isSolo = (game) => game.players.length === 1;

function win(game, side, text) {
  return { ...game, darts: [], phase: 'over', winner: side, winnerText: text };
}

function dartsText(game, side) {
  const names = sideNames(game.players, side);
  const verb = names.length === 1 ? 'wins' : 'win';
  return `${names.join(' & ')} ${verb} in ${game.sides[side].thrown} darts!`;
}

// Both sides get the same number of turns, so the first to finish gives the other a last chance.
function afterEightBall(game, side) {
  if (isSolo(game)) {
    return win(game, side, `${game.players[0].name} clears the table in ${game.sides[side].thrown} darts!`);
  }
  if (side === 'left') return { ...game, lastChance: true, turnOver: true, phase: 'takeout' };

  const { left, right } = game.sides;
  if (!left.finished) return win(game, 'right', dartsText(game, 'right'));
  if (right.thrown < left.thrown) return win(game, 'right', dartsText(game, 'right'));
  if (left.thrown < right.thrown) return win(game, 'left', dartsText(game, 'left'));
  return { ...game, shootout: { left: null, right: null, round: 1 }, turnOver: true, phase: 'takeout' };
}

function shootoutDart(game, side, hit) {
  const shootout = { ...game.shootout, [side]: hit };
  if (shootout.left === null || shootout.right === null) return { ...game, shootout, turnOver: true, phase: 'takeout' };
  if (shootout.left !== shootout.right) {
    const winner = shootout.left ? 'left' : 'right';
    const names = sideNames(game.players, winner);
    return win({ ...game, shootout }, winner, `${names.join(' & ')} ${names.length === 1 ? 'wins' : 'win'} the shootout!`);
  }
  return { ...game, shootout: { left: null, right: null, round: shootout.round + 1 }, turnOver: true, phase: 'takeout' };
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const { side } = game.players[game.current];
  const hit = isOnTarget(game, side, dart);
  const near = isNearMiss(game, side, dart);
  const darts = [...game.darts, { name: dart.name, hit }];
  const moved = {
    ...game,
    players: game.players.map((p, i) => (i === game.current && !game.shootout ? { ...p, thrown: p.thrown + 1 } : p)),
    darts,
    seq: game.seq + 1,
    last: { player: game.current, name: dart.name, hit, near, eightBall: false, shootout: Boolean(game.shootout) },
  };

  if (game.shootout) return shootoutDart(moved, side, hit);

  const state = game.sides[side];
  const thrown = state.thrown + 1;

  if (!hit) {
    const counted = { ...moved, sides: { ...game.sides, [side]: { ...state, thrown } } };
    const turnGoesOn = near && darts.length < DARTS_PER_TURN;
    if (turnGoesOn && !(game.lastChance && thrown >= game.sides[other(side)].thrown)) return counted;
    if (game.lastChance) return win(counted, other(side), dartsText(counted, other(side)));
    return { ...counted, turnOver: true, phase: 'takeout' };
  }

  const eightBall = state.potted === BALLS;
  const updated = { ...state, thrown, potted: eightBall ? BALLS : state.potted + 1, finished: eightBall };
  const scored = { ...moved, sides: { ...game.sides, [side]: updated }, last: { ...moved.last, eightBall } };

  if (eightBall) return afterEightBall(scored, side);
  // Once the chasing side has thrown as many as the leader, they can't finish in fewer.
  if (game.lastChance && thrown >= game.sides[other(side)].thrown) {
    return win(scored, other(side), dartsText(scored, other(side)));
  }
  // A streak carries on, but only three darts fit in the board at once.
  return { ...scored, phase: darts.length >= DARTS_PER_TURN ? 'takeout' : 'throwing' };
}

// A miss hands over to the next player, while pulling out mid-streak lets the same player carry on.
export function endTurn(game) {
  if (game.phase === 'over' || game.darts.length === 0) return game;
  if (!game.turnOver) return { ...game, darts: [], phase: 'throwing', last: null };
  return { ...nextPlayer(game), turnOver: false };
}
