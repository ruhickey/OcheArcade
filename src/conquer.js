import { DARTS_PER_TURN } from './turns.js';
import { advance, isFinalTurn } from './rounds.js';
import { BOARD_ORDER, BULL, canReach } from '../public/games/conquer-rules.js';

export const ROUND_CHOICES = [5, 10, 15, 20];
export const DEFAULT_ROUNDS = 10;
export const MAX_SHIELDS = 3;
const STARTING_SHIELDS = 1;
const POWER = { SingleInner: 1, SingleOuter: 1, OuterBull: 1, Double: 2, InnerBull: 2, Triple: 3 };

// Home bases are spread evenly around the board, from a random starting point.
function homeBases(count) {
  const offset = Math.floor(Math.random() * BOARD_ORDER.length);
  return Array.from({ length: count }, (_, i) => (
    BOARD_ORDER[(offset + Math.round((i * BOARD_ORDER.length) / count)) % BOARD_ORDER.length]
  ));
}

// One point for each region and each shield.
function withScores(players, regions) {
  return players.map((player, index) => {
    const held = Object.values(regions).filter((region) => region.owner === index);
    return { ...player, score: held.reduce((total, region) => total + 1 + region.shields, 0) };
  });
}

function startTurn(game) {
  return { ...game, darts: [], phase: 'throwing', last: null };
}

const rules = {
  score: (player) => player.score,
  winnerText: (winner) => `${winner.name} wins the campaign!`,
  startTurn,
};

export function newGame(names, { rounds = DEFAULT_ROUNDS } = {}) {
  const homes = homeBases(names.length);
  const regions = Object.fromEntries(homes.map((home, owner) => [home, { owner, shields: STARTING_SHIELDS }]));
  return startTurn({
    type: 'conquer',
    players: withScores(names.map((name, i) => ({ name, home: homes[i], score: 0 })), regions),
    regions,
    current: 0,
    round: 1,
    rounds,
    playoff: null,
    winner: null,
    winnerText: null,
    seq: 0,
  });
}

function regionHit(dart) {
  if (dart.id === 'Miss' || !dart.number) return null;
  return dart.number;
}

// Works out what a dart does. Doubles and trebles count as 2 and 3 for shields only.
function resolve(game, number, power) {
  if (number === null) return { result: 'miss' };
  if (!canReach(game.regions, game.current, number)) return { result: 'blocked' };

  const region = game.regions[number];
  if (!region) return { result: 'claim', region: { owner: game.current, shields: STARTING_SHIELDS } };
  if (region.owner === game.current) {
    if (region.shields === MAX_SHIELDS) return { result: 'full' };
    return { result: 'reinforce', region: { ...region, shields: Math.min(region.shields + power, MAX_SHIELDS) } };
  }
  if (region.shields === 0) {
    return { result: 'steal', from: region.owner, region: { owner: game.current, shields: STARTING_SHIELDS } };
  }
  const shields = Math.max(region.shields - power, 0);
  return { result: shields === 0 ? 'broken' : 'damage', from: region.owner, region: { ...region, shields } };
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const number = regionHit(dart);
  const { result, from = null, region } = resolve(game, number, POWER[dart.id]);
  const regions = region ? { ...game.regions, [number]: region } : game.regions;
  const darts = [...game.darts, { name: dart.name, result }];
  const full = darts.length >= DARTS_PER_TURN;
  const next = {
    ...game,
    regions,
    players: withScores(game.players, regions),
    darts,
    phase: full ? 'takeout' : 'throwing',
    seq: game.seq + 1,
    last: { player: game.current, name: dart.name, number, result, from, shields: region?.shields ?? null },
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

export { BULL };
