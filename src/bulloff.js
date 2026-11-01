import { toPlayer } from './players.js';

// Throw for the bull: one dart each, closest goes first. Exact ties rethrow.
export function newBullOff(names) {
  return {
    entrants: names.map(toPlayer).map((player) => ({ ...player, throws: [] })),
    queue: names.map((_, i) => i),
    position: 0,
    round: 1,
    phase: 'throwing', // throwing | takeout | done
    ranking: null,
    last: null,
  };
}

// A dart with no known distance loses to any dart that has one.
const distanceKey = (distance) => distance ?? Infinity;

function compare(a, b) {
  const rounds = Math.max(a.throws.length, b.throws.length);
  for (let i = 0; i < rounds; i++) {
    const difference = distanceKey(a.throws[i]) - distanceKey(b.throws[i]);
    if (difference < 0 || difference > 0) return difference;
  }
  return 0;
}

export function throwDart(bullOff, dart) {
  if (bullOff.phase !== 'throwing') return bullOff;
  const index = bullOff.queue[bullOff.position];
  return {
    ...bullOff,
    entrants: bullOff.entrants.map((entrant, i) => (
      i === index ? { ...entrant, throws: [...entrant.throws, dart.distance] } : entrant
    )),
    phase: 'takeout',
    last: { entrant: index, distance: dart.distance },
  };
}

export function advance(bullOff) {
  if (bullOff.phase !== 'takeout') return bullOff;

  const position = bullOff.position + 1;
  if (position < bullOff.queue.length) return { ...bullOff, position, phase: 'throwing', last: null };

  const { entrants } = bullOff;
  const tied = entrants
    .map((_, i) => i)
    .filter((i) => entrants.some((other, j) => j !== i && compare(entrants[i], other) === 0));
  if (tied.length) {
    return { ...bullOff, queue: tied, position: 0, round: bullOff.round + 1, phase: 'throwing', last: null };
  }

  const ranking = entrants.map((_, i) => i).sort((a, b) => compare(entrants[a], entrants[b]));
  return { ...bullOff, phase: 'done', ranking, last: null };
}

export function rankedPlayers(bullOff) {
  return bullOff.ranking.map((i) => toPlayer(bullOff.entrants[i]));
}
