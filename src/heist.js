import { DARTS_PER_TURN } from './turns.js';
import { advance, isFinalTurn } from './rounds.js';
import { toPlayer } from './players.js';

export const ROUND_CHOICES = [3, 5, 10];
export const DEFAULT_ROUNDS = 5;
export const MIN_CODE = 10;
export const MAX_CODE = 50;
// A beginner cracks the code by finishing this close to zero, either side.
export const BEGINNER_TOLERANCE = 5;

function randomCode() {
  return MIN_CODE + Math.floor(Math.random() * (MAX_CODE - MIN_CODE + 1));
}

// Everyone cracks the same code in a round, and a new one comes with each round or playoff.
function startTurn(game) {
  const codeKey = game.playoff ? `playoff-${game.playoff.round}` : `round-${game.round}`;
  const fresh = codeKey !== game.codeKey;
  const code = fresh ? randomCode() : game.code;
  return {
    ...game,
    codeKey,
    code,
    remaining: code,
    roundResults: fresh ? {} : game.roundResults,
    darts: [],
    phase: 'throwing',
    last: null,
  };
}

function winnerText(winner, game) {
  const verb = game.players.length === 1 ? 'finishes' : 'wins';
  return `${winner.name} ${verb} with ${winner.points} points!`;
}

const rules = { score: (player) => player.points, winnerText, startTurn };

export function newGame(names, { rounds = DEFAULT_ROUNDS } = {}) {
  return startTurn({
    type: 'heist',
    players: names.map(toPlayer).map((player) => ({ ...player, points: 0 })),
    current: 0,
    round: 1,
    rounds,
    playoff: null,
    codeKey: null,
    code: null,
    remaining: null,
    roundResults: {},
    winner: null,
    winnerText: null,
    seq: 0,
  });
}

function outcome(remaining, dartCount, tolerance) {
  if (Math.abs(remaining) <= tolerance) return 'looted';
  if (remaining < 0) return 'bust';
  return dartCount >= DARTS_PER_TURN ? 'alarm' : null;
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const left = game.remaining - dart.points;
  const darts = [...game.darts, { name: dart.name, points: dart.points }];
  const tolerance = game.players[game.current].beginner ? BEGINNER_TOLERANCE : 0;
  const result = outcome(left, darts.length, tolerance);
  const looted = result === 'looted';
  const remaining = looted ? 0 : left;
  const next = {
    ...game,
    remaining,
    darts,
    players: game.players.map((p, i) => (looted && i === game.current ? { ...p, points: p.points + game.code } : p)),
    roundResults: result ? { ...game.roundResults, [game.current]: result } : game.roundResults,
    phase: result ? 'takeout' : 'throwing',
    seq: game.seq + 1,
    last: { player: game.current, name: dart.name, points: dart.points, remaining, result, code: game.code },
  };
  // A decided match ends on the final dart. If it goes to a playoff, the darts come out first.
  if (result && isFinalTurn(game)) {
    const ended = advance(next, rules);
    if (ended.phase === 'over') return ended;
  }
  return next;
}

// Pulling the darts out before the code is cracked counts as setting off the alarm.
export function endTurn(game) {
  if (game.phase === 'over' || game.darts.length === 0) return game;
  const settled = game.roundResults[game.current]
    ? game
    : { ...game, roundResults: { ...game.roundResults, [game.current]: 'alarm' } };
  return advance(settled, rules);
}
