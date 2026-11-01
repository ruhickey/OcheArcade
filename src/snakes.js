import { DARTS_PER_TURN } from './turns.js';
import { toPlayer } from './players.js';

export const FINISH = 100;
// A beginner's miss still moves them this far.
export const BEGINNER_MIN_SPACES = 1;

export const LADDERS = { 3: 22, 8: 30, 28: 55, 41: 63, 58: 77, 71: 92 };
export const SNAKES = { 17: 6, 36: 14, 49: 29, 65: 44, 68: 48, 88: 66, 95: 75, 99: 80 };

export function newGame(names) {
  return {
    type: 'snakes',
    players: names.map(toPlayer).map((player) => ({ ...player, pos: 0 })),
    current: 0,
    darts: [],
    phase: 'throwing', // throwing | takeout | over
    winner: null,
    winnerText: null,
    seq: 0,
    last: null,
  };
}

// Walks tile by tile, reversing off the finish line if the move overshoots.
export function walk(from, spaces) {
  const path = [];
  let pos = from;
  let direction = 1;
  for (let i = 0; i < spaces; i++) {
    if (pos === FINISH) direction = -1;
    pos += direction;
    path.push(pos);
  }
  return { path, bounced: direction === -1 };
}

export function throwDart(game, bed) {
  if (game.phase !== 'throwing') return game;

  const player = game.players[game.current];
  const spaces = player.beginner ? Math.max(bed.spaces, BEGINNER_MIN_SPACES) : bed.spaces;
  const { path, bounced } = walk(player.pos, spaces);
  const landed = path.at(-1) ?? player.pos;
  const moved = path.length > 0;
  const slide = moved ? (LADDERS[landed] ?? SNAKES[landed] ?? null) : null;
  const pos = slide ?? landed;
  const won = pos === FINISH;
  const darts = [...game.darts, { label: bed.label, spaces }];

  return {
    ...game,
    players: game.players.map((p, i) => (i === game.current ? { ...p, pos } : p)),
    darts,
    phase: won ? 'over' : darts.length >= DARTS_PER_TURN ? 'takeout' : 'throwing',
    winner: won ? game.current : null,
    winnerText: won ? `${player.name} wins!` : null,
    seq: game.seq + 1,
    last: {
      player: game.current,
      label: bed.label,
      spaces,
      from: player.pos,
      path,
      bounced,
      slide,
      kind: slide === null ? null : slide > landed ? 'ladder' : 'snake',
    },
  };
}
