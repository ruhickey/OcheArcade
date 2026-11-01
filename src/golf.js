import { DARTS_PER_TURN } from './turns.js';
import { toPlayer } from './players.js';

export const HOLES = 18;
export const MISS_SCORE = 7;
export const BEGINNER_MISS_SCORE = 5;

// Strokes for hitting each bed of the hole's number. Anything else is a miss.
const BED_SCORES = { Triple: 1, Double: 2, SingleInner: 3, SingleOuter: 4 };
const WORST_ON_TARGET = 4;

export function newGame(names) {
  return {
    type: 'golf',
    players: names.map(toPlayer).map((player) => ({ ...player, holes: [], total: 0 })),
    current: 0,
    hole: 1,
    darts: [],
    live: null,
    playoff: null,
    phase: 'throwing',
    winner: null,
    winnerText: null,
    seq: 0,
    last: null,
  };
}

function strokesFor(dart, hole, beginner) {
  const onTarget = dart.number === hole && Object.hasOwn(BED_SCORES, dart.id);
  if (onTarget) return BED_SCORES[dart.id];
  return beginner ? BEGINNER_MISS_SCORE : MISS_SCORE;
}

// Three darts in the same bed of the target take one off the hole.
function isHatTrick(darts) {
  return darts.length === DARTS_PER_TURN
    && darts.every((dart) => dart.strokes <= WORST_ON_TARGET && dart.id === darts[0].id);
}

export function holeScore(darts) {
  if (darts.length === 0) return MISS_SCORE;
  const best = Math.min(...darts.map((dart) => dart.strokes));
  return isHatTrick(darts) ? best - 1 : best;
}

// Picks the playoff hole at random, never the one just played.
function randomHole(previous) {
  const hole = 1 + Math.floor(Math.random() * (previous ? HOLES - 1 : HOLES));
  return previous && hole >= previous ? hole + 1 : hole;
}

function lowestIndexes(entries) {
  const lowest = Math.min(...entries.map(([, score]) => score));
  return entries.filter(([, score]) => score === lowest).map(([index]) => index);
}

function finish(game, players, winner, text) {
  return { ...game, players, darts: [], live: null, phase: 'over', winner, winnerText: text };
}

function startPlayoffRound(game, players, queue) {
  const previous = game.playoff?.rounds.at(-1)?.target;
  const target = randomHole(previous);
  return {
    ...game,
    players,
    current: queue[0],
    hole: target,
    darts: [],
    live: null,
    phase: 'throwing',
    last: null,
    playoff: {
      queue,
      position: 0,
      rounds: [...(game.playoff?.rounds ?? []), { target, scores: {} }],
    },
  };
}

function endPlayoffTurn(game, score) {
  const { playoff } = game;
  const round = playoff.rounds.at(-1);
  const scores = { ...round.scores, [game.current]: score };
  const updated = { ...game, playoff: { ...playoff, rounds: [...playoff.rounds.slice(0, -1), { ...round, scores }] } };

  const position = playoff.position + 1;
  if (position < playoff.queue.length) {
    return {
      ...updated,
      playoff: { ...updated.playoff, position },
      current: playoff.queue[position],
      darts: [],
      live: null,
      phase: 'throwing',
      last: null,
    };
  }

  const leaders = lowestIndexes(Object.entries(scores).map(([index, value]) => [Number(index), value]));
  if (leaders.length > 1) return startPlayoffRound(updated, game.players, leaders);
  return finish(updated, game.players, leaders[0], `${game.players[leaders[0]].name} wins the playoff!`);
}

// Records the hole and moves on. Pulling out early scores the darts thrown so far.
export function endTurn(game) {
  if (game.phase === 'over' || game.darts.length === 0) return game;

  const score = holeScore(game.darts);
  if (game.playoff) return endPlayoffTurn(game, score);

  const players = game.players.map((p, i) => (
    i === game.current ? { ...p, holes: [...p.holes, score], total: p.total + score } : p
  ));
  const lastPlayer = game.current === players.length - 1;
  if (lastPlayer && game.hole === HOLES) {
    const leaders = lowestIndexes(players.map((p, i) => [i, p.total]));
    if (leaders.length > 1) return startPlayoffRound(game, players, leaders);
    const verb = players.length === 1 ? 'finishes' : 'wins';
    return finish(game, players, leaders[0], `${players[leaders[0]].name} ${verb} on ${players[leaders[0]].total}!`);
  }
  return {
    ...game,
    players,
    current: lastPlayer ? 0 : game.current + 1,
    hole: lastPlayer ? game.hole + 1 : game.hole,
    darts: [],
    live: null,
    phase: 'throwing',
    last: null,
  };
}

function isFinalTurn(game) {
  if (game.playoff) return game.playoff.position === game.playoff.queue.length - 1;
  return game.hole === HOLES && game.current === game.players.length - 1;
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const strokes = strokesFor(dart, game.hole, game.players[game.current].beginner);
  const darts = [...game.darts, { id: dart.id, name: dart.name, strokes }];
  const full = darts.length >= DARTS_PER_TURN;
  const next = {
    ...game,
    darts,
    live: holeScore(darts),
    phase: full ? 'takeout' : 'throwing',
    seq: game.seq + 1,
    last: { player: game.current, name: dart.name, strokes, best: holeScore(darts), hatTrick: isHatTrick(darts) },
  };
  // A decided game ends on the final dart. If it goes to a playoff, the darts come out first.
  if (full && isFinalTurn(game)) {
    const ended = endTurn(next);
    if (ended.phase === 'over') return ended;
  }
  return next;
}
