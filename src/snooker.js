import { DARTS_PER_TURN, nextPlayer } from './turns.js';
import { arrange, sideOf, sideWinsText, turnOrderFor } from './teams.js';
import { BLACK, COLOURS, NOMINATE_TAP, anyColourCounts } from '../public/games/snooker-rules.js';
import { toPlayer } from './players.js';

export { arrange, BLACK, COLOURS, NOMINATE_TAP };

export const RED_COUNT = 15;
export const RED_VALUE = 1;
export const MIN_FOUL = 4;
export const BEGINNER_FOUL = 1;
export const NOMINATE_ANY = 'Any colour counts';
export const NOMINATE_CHOICES = [NOMINATE_TAP, NOMINATE_ANY];

const colourOf = (number) => COLOURS.find((colour) => colour.number === number) ?? null;
const opposite = (side) => (side === 'left' ? 'right' : 'left');

// Which ball a dart hit, or null off the board. Beds don't matter: any part of the number counts.
function ballHit(dart) {
  if (dart.id === 'Miss' || !dart.number) return null;
  return dart.number;
}

// The first target of a turn: a red while any are left, otherwise the lowest colour left.
function openingTarget(game) {
  if (game.respottedBlack) return { kind: 'clearance', colour: BLACK };
  if (game.reds.length < RED_COUNT) return { kind: 'red' };
  return { kind: 'clearance', colour: game.clearance };
}

export function newGame(names, { nominate = NOMINATE_TAP } = {}) {
  const game = {
    type: 'snooker',
    players: names.map(toPlayer).map((player, i) => ({ ...player, side: sideOf(i, names.length) })),
    current: 0,
    turnOrder: turnOrderFor(names.length),
    turnStep: 0,
    scores: { left: 0, right: 0 },
    reds: [], // numbers already potted
    clearance: COLOURS[0].number,
    respottedBlack: false,
    nominateMode: nominate,
    breakScore: 0,
    darts: [],
    phase: 'throwing',
    winner: null,
    winnerText: null,
    seq: 0,
    last: null,
  };
  return { ...game, target: openingTarget(game) };
}

function isOnTarget(game, ball) {
  const { target } = game;
  if (ball === null) return false;
  if (target.kind === 'red') return ball >= 1 && ball <= RED_COUNT && !game.reds.includes(ball);
  if (target.kind === 'clearance') return ball === target.colour;
  if (anyColourCounts(game)) return colourOf(ball) !== null;
  return ball === target.nominated;
}

// A foul costs the value of the ball on or the ball hit, whichever is higher, and at least 4.
function foulValue(game, ball) {
  if (game.players[game.current].beginner) return BEGINNER_FOUL;
  const { target } = game;
  const onValue = colourOf(target.kind === 'clearance' ? target.colour : target.nominated)?.value ?? 0;
  return Math.max(MIN_FOUL, onValue, colourOf(ball)?.value ?? 0);
}

function finish(game, side) {
  return { ...game, darts: [], phase: 'over', winner: side, winnerText: sideWinsText(game.players, side) };
}

function afterPot(game, ball) {
  const { target } = game;
  if (target.kind === 'red') return { ...game, reds: [...game.reds, ball], target: { kind: 'colour', nominated: null } };
  if (target.kind === 'colour') {
    return { ...game, target: game.reds.length < RED_COUNT ? { kind: 'red' } : { kind: 'clearance', colour: game.clearance } };
  }

  // Clearing the black ends the frame, unless the scores are level.
  if (ball === BLACK) {
    const { left, right } = game.scores;
    if (left === right) return { ...game, respottedBlack: true, target: { kind: 'clearance', colour: BLACK }, phase: 'takeout' };
    return finish(game, left > right ? 'left' : 'right');
  }
  const index = COLOURS.findIndex((colour) => colour.number === ball);
  const clearance = COLOURS[index + 1].number;
  return { ...game, clearance, target: { kind: 'clearance', colour: clearance } };
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const ball = ballHit(dart);
  const player = game.players[game.current];
  const potted = isOnTarget(game, ball);
  const darts = [...game.darts, { name: dart.name, potted }];
  const moved = { ...game, darts, seq: game.seq + 1 };

  if (potted) {
    const value = game.target.kind === 'red' ? RED_VALUE : colourOf(ball).value;
    // The re-spotted black is sudden death: the next score wins outright.
    const scored = { ...moved, scores: { ...game.scores, [player.side]: game.scores[player.side] + value }, breakScore: game.breakScore + value };
    const wasRespot = game.respottedBlack;
    const last = { player: game.current, name: dart.name, ball, value, foul: false, kind: game.target.kind };
    if (wasRespot) return { ...finish(scored, player.side), last };
    const after = { ...afterPot(scored, ball), last };
    if (after.phase !== 'throwing') return after;
    return { ...after, phase: darts.length >= DARTS_PER_TURN ? 'takeout' : 'throwing' };
  }

  const penalty = foulValue(game, ball);
  const other = opposite(player.side);
  const fouled = {
    ...moved,
    scores: { ...game.scores, [other]: game.scores[other] + penalty },
    phase: 'takeout',
    last: { player: game.current, name: dart.name, ball, foul: true, penalty, to: other },
  };
  return game.respottedBlack ? finish(fouled, other) : fouled;
}

export function nominate(game, number) {
  if (game.phase !== 'throwing' || game.target.kind !== 'colour' || anyColourCounts(game)) return game;
  if (!colourOf(number)) return game;
  return { ...game, target: { kind: 'colour', nominated: number } };
}

// A pending colour doesn't carry over: the next player starts on a red, or on the colours if none are left.
export function endTurn(game) {
  if (game.phase === 'over' || game.darts.length === 0) return game;
  const moved = nextPlayer(game);
  return { ...moved, breakScore: 0, target: openingTarget(moved) };
}
