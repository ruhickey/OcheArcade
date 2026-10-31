import { DARTS_PER_TURN } from './turns.js';
import { arrange, sideOf, sideWinsText, turnOrderFor } from './teams.js';

export { arrange };

// Points of lead needed to drag the laser from the centre into a goal.
// Three darts score at most 180, so 100 can be won from the centre in one turn, but 200 can't.
export const GOALS = [100, 200];

export function newGame(names, { goal = GOALS[0] } = {}) {
  return {
    type: 'tug',
    players: names.map((name, i) => ({ name, side: sideOf(i, names.length), points: 0 })),
    current: 0,
    turnOrder: turnOrderFor(names.length),
    turnStep: 0,
    winPull: goal,
    darts: [],
    phase: 'throwing',
    winner: null,
    winnerText: null,
    rope: 0, // negative is towards the left goal
    seq: 0,
    last: null,
  };
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const player = game.players[game.current];
  const pull = player.side === 'left' ? -dart.points : dart.points;
  const rope = Math.max(-game.winPull, Math.min(game.winPull, game.rope + pull));
  const won = Math.abs(rope) === game.winPull;
  const darts = [...game.darts, { name: dart.name, points: dart.points }];

  return {
    ...game,
    players: game.players.map((p, i) => (i === game.current ? { ...p, points: p.points + dart.points } : p)),
    darts,
    rope,
    phase: won ? 'over' : darts.length >= DARTS_PER_TURN ? 'takeout' : 'throwing',
    winner: won ? player.side : null,
    winnerText: won ? sideWinsText(game.players, player.side) : null,
    seq: game.seq + 1,
    last: { player: game.current, name: dart.name, points: dart.points, side: player.side },
  };
}
