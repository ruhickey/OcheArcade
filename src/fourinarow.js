import { DARTS_PER_TURN } from './turns.js';
import { arrange, sideOf, sideWinsText, turnOrderFor } from './teams.js';
import { toPlayer } from './players.js';

export { arrange };

export const COLUMNS = 7;
export const ROWS = 6;
const CONNECT = 4;
const BULL = 25;
const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];

// The number hit picks the column, whichever bed it's in. Either bull is the last column.
export function columnFor(dart) {
  if (dart.id === 'Miss' || !dart.number) return null;
  return dart.number === BULL ? COLUMNS - 1 : (dart.number - 1) % COLUMNS;
}

export function newGame(names) {
  return {
    type: 'fourinarow',
    players: names.map(toPlayer).map((player, i) => ({ ...player, side: sideOf(i, names.length) })),
    current: 0,
    turnOrder: turnOrderFor(names.length),
    turnStep: 0,
    columns: Array.from({ length: COLUMNS }, () => []), // each holds its pieces from the bottom up
    darts: [],
    phase: 'throwing',
    winner: null,
    winnerText: null,
    winningCells: null,
    seq: 0,
    last: null,
  };
}

// The line of 4 or more running through a newly placed piece, if there is one.
export function findLine(columns, column, row) {
  const side = columns[column][row];
  for (const [stepColumn, stepRow] of DIRECTIONS) {
    const line = [[column, row]];
    for (const direction of [1, -1]) {
      let c = column + stepColumn * direction;
      let r = row + stepRow * direction;
      while (columns[c]?.[r] === side) {
        line.push([c, r]);
        c += stepColumn * direction;
        r += stepRow * direction;
      }
    }
    if (line.length >= CONNECT) return line;
  }
  return null;
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const player = game.players[game.current];
  const column = columnFor(dart);
  const full = column !== null && game.columns[column].length >= ROWS;
  const result = column === null ? 'miss' : full ? 'bust' : 'placed';
  const darts = [...game.darts, { name: dart.name, column, result }];
  const row = result === 'placed' ? game.columns[column].length : null;
  const columns = result === 'placed'
    ? game.columns.map((pieces, i) => (i === column ? [...pieces, player.side] : pieces))
    : game.columns;

  const next = {
    ...game,
    columns,
    darts,
    seq: game.seq + 1,
    last: { player: game.current, name: dart.name, column, row, result, side: player.side },
  };

  const line = result === 'placed' ? findLine(columns, column, row) : null;
  if (line) {
    return { ...next, darts: [], phase: 'over', winner: player.side, winnerText: sideWinsText(game.players, player.side), winningCells: line };
  }
  if (columns.every((pieces) => pieces.length >= ROWS)) {
    return { ...next, darts: [], phase: 'over', winnerText: 'It’s a draw!' };
  }
  return { ...next, phase: darts.length >= DARTS_PER_TURN ? 'takeout' : 'throwing' };
}
