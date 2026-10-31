import * as snakes from './snakes.js';
import * as tug from './tug.js';
import * as golf from './golf.js';
import * as paintball from './paintball.js';
import * as balloons from './balloons.js';
import * as snooker from './snooker.js';
import * as boxing from './boxing.js';
import * as fourinarow from './fourinarow.js';
import * as heist from './heist.js';
import * as conquer from './conquer.js';
import * as circuit from './circuit.js';
import * as pool from './pool.js';
import { BEDS } from './segments.js';

export const GAMES = {
  snakes: {
    id: 'snakes',
    name: 'Snakes & Ladders',
    blurb: 'Race to exactly 100. Where the dart lands sets how far you move, not the number.',
    minPlayers: 1,
    newGame: snakes.newGame,
    throwDart: snakes.throwDart,
    options: [],
    rules: { beds: BEDS, ladders: snakes.LADDERS, snakes: snakes.SNAKES, finish: snakes.FINISH },
  },
  tug: {
    id: 'tug',
    name: 'Tug of War',
    blurb: 'Score points to drag the laser into your goal. Three or four players split into two teams.',
    minPlayers: 2,
    newGame: tug.newGame,
    throwDart: tug.throwDart,
    arrange: tug.arrange,
    options: [{ id: 'goal', label: 'Points to the goal', choices: tug.GOALS }],
  },
  golf: {
    id: 'golf',
    name: 'Golf',
    blurb: '18 holes, aiming for each number in turn. Your best dart scores, the lowest total wins, and a draw goes to a playoff hole.',
    minPlayers: 1,
    newGame: golf.newGame,
    throwDart: golf.throwDart,
    nextPlayer: golf.endTurn,
    options: [],
  },
  paintball: {
    id: 'paintball',
    name: 'Paintball',
    blurb: 'Hit a zone to claim it, or steal it from an opponent. Most painted zones at the end of the match wins.',
    minPlayers: 2,
    newGame: paintball.newGame,
    throwDart: paintball.throwDart,
    nextPlayer: paintball.endTurn,
    options: [{ id: 'rounds', label: 'Rounds', choices: paintball.ROUND_CHOICES, default: paintball.DEFAULT_ROUNDS }],
  },
  balloons: {
    id: 'balloons',
    name: 'Balloons',
    blurb: 'Bubbles appear around the board, and closer to the centre of a bubble scores more. Throw your 3 darts against the clock, or take your time.',
    minPlayers: 1,
    newGame: balloons.newGame,
    throwDart: balloons.throwDart,
    nextPlayer: balloons.endTurn,
    tick: balloons.tick,
    resume: balloons.resume,
    options: [
      { id: 'rounds', label: 'Rounds', choices: balloons.ROUND_CHOICES, default: balloons.DEFAULT_ROUNDS },
      { id: 'clock', label: 'Turn clock', choices: balloons.CLOCK_CHOICES },
    ],
  },
  snooker: {
    id: 'snooker',
    name: 'Snooker',
    blurb: 'Clear the 15 reds with a colour after each, then pot the colours in order. Fouls hand points to the other side.',
    minPlayers: 2,
    newGame: snooker.newGame,
    throwDart: snooker.throwDart,
    nextPlayer: snooker.endTurn,
    nominate: snooker.nominate,
    arrange: snooker.arrange,
    options: [{ id: 'nominate', label: 'Nominating a colour', choices: snooker.NOMINATE_CHOICES }],
  },
  boxing: {
    id: 'boxing',
    name: 'Boxing',
    blurb: 'Hit an opponent’s numbers to deal damage, and your own to heal. Last player standing wins.',
    minPlayers: 2,
    newGame: boxing.newGame,
    throwDart: boxing.throwDart,
    nextPlayer: boxing.endTurn,
    options: [
      { id: 'targets', label: 'Target numbers each', choices: boxing.TARGET_CHOICES, default: boxing.DEFAULT_TARGETS },
      {
        id: 'difficulty',
        label: 'Difficulty',
        choices: Object.keys(boxing.DIFFICULTY),
        default: boxing.DEFAULT_DIFFICULTY,
        notes: Object.fromEntries(Object.entries(boxing.DIFFICULTY).map(([name, { note }]) => [name, note])),
      },
    ],
  },
  fourinarow: {
    id: 'fourinarow',
    name: 'Four in a Row',
    blurb: 'The number you hit picks the column. First to line up 4 pieces wins, and a full column loses the dart.',
    minPlayers: 2,
    newGame: fourinarow.newGame,
    throwDart: fourinarow.throwDart,
    arrange: fourinarow.arrange,
    options: [],
  },
  heist: {
    id: 'heist',
    name: 'Heist',
    blurb: 'Take a new code from 10 to 50 down to exactly zero in 3 darts to loot its points. Go below zero or run out and you get nothing.',
    minPlayers: 1,
    newGame: heist.newGame,
    throwDart: heist.throwDart,
    nextPlayer: heist.endTurn,
    options: [{ id: 'rounds', label: 'Rounds', choices: heist.ROUND_CHOICES, default: heist.DEFAULT_ROUNDS }],
  },
  conquer: {
    id: 'conquer',
    name: 'Conquer',
    blurb: 'Spread out from your home base one number at a time. Hold the bull to strike anywhere, and finish with the most regions and shields.',
    minPlayers: 2,
    newGame: conquer.newGame,
    throwDart: conquer.throwDart,
    nextPlayer: conquer.endTurn,
    options: [{ id: 'rounds', label: 'Rounds', choices: conquer.ROUND_CHOICES, default: conquer.DEFAULT_ROUNDS }],
  },
  circuit: {
    id: 'circuit',
    name: 'Circuit Breaker',
    blurb: 'Work as a team to cut 3 wires on each bomb. A miss or running out of time costs a life, and losing them all sets it off.',
    minPlayers: 1,
    newGame: circuit.newGame,
    throwDart: circuit.throwDart,
    nextPlayer: circuit.endTurn,
    tick: circuit.tick,
    resume: circuit.resume,
    options: [
      {
        id: 'difficulty',
        label: 'Difficulty',
        choices: Object.keys(circuit.DIFFICULTY),
        default: circuit.DEFAULT_DIFFICULTY,
        notes: Object.fromEntries(Object.entries(circuit.DIFFICULTY).map(([name, { note }]) => [name, note])),
      },
      { id: 'bombs', label: 'Bombs to defuse', choices: circuit.BOMB_CHOICES, default: circuit.DEFAULT_BOMBS },
    ],
  },
  pool: {
    id: 'pool',
    name: '8 Ball Pool',
    blurb: 'Pot your 7 numbers in order, then the Bull for the 8-ball. Hits keep your turn going, a miss ends it, and the fewest darts wins.',
    minPlayers: 1,
    newGame: pool.newGame,
    throwDart: pool.throwDart,
    nextPlayer: pool.endTurn,
    arrange: pool.arrange,
    options: [{
      id: 'mode',
      label: 'Mode',
      choices: Object.keys(pool.MODES),
      default: pool.DEFAULT_MODE,
      notes: Object.fromEntries(Object.entries(pool.MODES).map(([name, { note }]) => [name, note])),
    }],
  },
};
