import { DARTS_PER_TURN } from './turns.js';
import { advance, isFinalTurn } from './rounds.js';

export const ROUND_CHOICES = [5, 10, 15, 20];
export const DEFAULT_ROUNDS = 10;

// Each bed of each number is its own zone, and each bull is one zone.
export function zoneOf(dart) {
  if (dart.id === 'InnerBull' || dart.id === 'OuterBull') return dart.id;
  if (dart.id === 'Miss' || !dart.number) return null;
  return `${dart.id}-${dart.number}`;
}

export function newGame(names, { rounds = DEFAULT_ROUNDS } = {}) {
  return {
    type: 'paintball',
    players: names.map((name) => ({ name, zones: 0 })),
    current: 0,
    round: 1,
    rounds,
    zoneOwners: {},
    playoff: null,
    darts: [],
    phase: 'throwing',
    winner: null,
    winnerText: null,
    seq: 0,
    last: null,
  };
}

function resultOf(game, zone) {
  if (zone === null) return 'miss';
  const owner = game.zoneOwners[zone];
  if (owner === undefined) return 'claim';
  return owner === game.current ? 'own' : 'steal';
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const zone = zoneOf(dart);
  const result = resultOf(game, zone);
  const from = result === 'steal' ? game.zoneOwners[zone] : null;
  const players = game.players.map((p, i) => {
    if (i === game.current && (result === 'claim' || result === 'steal')) return { ...p, zones: p.zones + 1 };
    if (i === from) return { ...p, zones: p.zones - 1 };
    return p;
  });
  const painted = result === 'claim' || result === 'steal';
  const darts = [...game.darts, { name: dart.name, result }];
  const full = darts.length >= DARTS_PER_TURN;
  const next = {
    ...game,
    players,
    zoneOwners: painted ? { ...game.zoneOwners, [zone]: game.current } : game.zoneOwners,
    darts,
    phase: full ? 'takeout' : 'throwing',
    seq: game.seq + 1,
    last: { player: game.current, name: dart.name, zone, result, from },
  };
  // A decided match ends on the final dart. If it goes to a playoff, the darts come out first.
  if (full && isFinalTurn(game)) {
    const ended = advance(next, rules);
    if (ended.phase === 'over') return ended;
  }
  return next;
}

function startTurn(game) {
  return { ...game, darts: [], phase: 'throwing', last: null };
}

function winnerText(winner) {
  const zones = winner.zones === 1 ? '1 zone' : `${winner.zones} zones`;
  return `${winner.name} wins with ${zones}!`;
}

const rules = { score: (player) => player.zones, winnerText, startTurn };

export function endTurn(game) {
  if (game.phase === 'over' || game.darts.length === 0) return game;
  return advance(game, rules);
}
