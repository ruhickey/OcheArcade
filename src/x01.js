import { DARTS_PER_TURN } from './turns.js';
import { toPlayer } from './players.js';

export const START_CHOICES = [301, 501];
export const DEFAULT_START = 501;
export const SET_CHOICES = [1, 2, 3, 4, 5];
export const DEFAULT_SETS = 1;
export const LEG_CHOICES = [1, 2, 3, 4, 5];
export const DEFAULT_LEGS = 3;
export const IN_CHOICES = ['Straight in', 'Double in'];
export const DEFAULT_IN = 'Straight in';

// Doubles and the bull open a score under double in, and are the only way to finish.
const isDouble = (dart) => dart.id === 'Double' || dart.id === 'InnerBull';

const average = (player) => (player.dartsThrown ? (player.pointsScored / player.dartsThrown) * DARTS_PER_TURN : 0);
export const threeDartAverage = (player) => Math.round(average(player) * 10) / 10;

// Every leg starts everyone from the full score, and nobody is in yet under double in.
function startLeg(game, starter) {
  return {
    ...game,
    players: game.players.map((p) => ({ ...p, remaining: game.start, opened: !game.doubleIn })),
    current: starter,
    legStarter: starter,
    turnStart: game.start,
    legWon: false,
    setWon: false,
    darts: [],
    phase: 'throwing',
    last: null,
  };
}

export function newGame(names, { start = DEFAULT_START, sets = DEFAULT_SETS, legs = DEFAULT_LEGS, in: entry = DEFAULT_IN } = {}) {
  return startLeg({
    type: 'x01',
    start,
    setsToWin: sets,
    legsToWin: legs,
    doubleIn: entry === 'Double in',
    set: 1,
    leg: 1,
    players: names.map(toPlayer).map((player) => ({ ...player, sets: 0, legs: 0, dartsThrown: 0, pointsScored: 0 })),
    winner: null,
    winnerText: null,
    seq: 0,
  }, 0);
}

function winnerText(winner, game) {
  if (game.players.length === 1) return `${winner.name} finishes with a ${threeDartAverage(winner)} average!`;
  return `${winner.name} wins the match!`;
}

// Takes the player's turn back to where it started, and the points they scored with it.
function bust(game, darts) {
  const player = game.players[game.current];
  const lost = game.turnStart - player.remaining;
  return {
    ...game,
    darts,
    players: game.players.map((p, i) => (i === game.current
      ? { ...p, remaining: game.turnStart, pointsScored: p.pointsScored - lost, dartsThrown: p.dartsThrown + 1 }
      : p)),
    phase: 'takeout',
  };
}

// The checkout wins a leg, enough legs win a set, and enough sets win the match.
function checkout(game, scored) {
  const winner = game.players[game.current];
  const legs = winner.legs + 1;
  const setWon = legs === game.legsToWin;
  const sets = winner.sets + (setWon ? 1 : 0);
  const matchWon = sets === game.setsToWin;
  const players = game.players.map((p, i) => {
    const mine = i === game.current;
    const updated = mine ? { ...p, remaining: 0, ...scored, legs, sets } : p;
    // A new set starts everyone's legs again, but the final score stays on the board.
    return setWon && !matchWon ? { ...updated, legs: 0 } : updated;
  });
  const result = matchWon ? 'match' : setWon ? 'set' : 'leg';
  const ended = { ...game, players, legWon: true, setWon };
  if (!matchWon) return { ended, result, phase: 'takeout' };
  return {
    ended: { ...ended, winner: game.current, winnerText: winnerText(players[game.current], game) },
    result,
    phase: 'over',
  };
}

export function throwDart(game, dart) {
  if (game.phase !== 'throwing') return game;

  const player = game.players[game.current];
  const darts = [...game.darts, { name: dart.name, points: dart.points }];
  const opened = player.opened || isDouble(dart);
  const points = opened ? dart.points : 0;
  const remaining = player.remaining - points;
  const scored = { opened, dartsThrown: player.dartsThrown + 1, pointsScored: player.pointsScored + points };
  const last = { player: game.current, name: dart.name, points, remaining, opening: opened && !player.opened };
  const seq = game.seq + 1;

  // Double out: a finish has to land on a double, so going below zero or leaving 1 is bust.
  if (remaining < 0 || remaining === 1 || (remaining === 0 && !isDouble(dart))) {
    const busted = bust(game, darts);
    const back = busted.players[game.current].remaining;
    return { ...busted, seq, last: { ...last, remaining: back, result: 'bust' } };
  }

  if (remaining === 0) {
    const { ended, result, phase } = checkout(game, scored);
    return { ...ended, darts, phase, seq, last: { ...last, result } };
  }

  return {
    ...game,
    darts,
    players: game.players.map((p, i) => (i === game.current ? { ...p, remaining, ...scored } : p)),
    phase: darts.length >= DARTS_PER_TURN ? 'takeout' : 'throwing',
    seq,
    last: { ...last, result: opened ? null : 'closed' },
  };
}

// After a checkout the next leg starts with the next player along.
export function endTurn(game) {
  if (game.phase === 'over') return game;
  const count = game.players.length;
  if (game.legWon) {
    const position = game.setWon ? { set: game.set + 1, leg: 1 } : { leg: game.leg + 1 };
    return startLeg({ ...game, ...position }, (game.legStarter + 1) % count);
  }
  const current = (game.current + 1) % count;
  return {
    ...game,
    current,
    turnStart: game.players[current].remaining,
    darts: [],
    phase: 'throwing',
    last: null,
  };
}
