// The parts of the dartboard, with how far each moves a player in Snakes & Ladders.
export const BEDS = [
  { id: 'InnerBull', label: 'Inner Bull', spaces: 6 },
  { id: 'OuterBull', label: 'Outer Bull', spaces: 5 },
  { id: 'SingleOuter', label: 'Outer Single', spaces: 4 },
  { id: 'Triple', label: 'Triple', spaces: 3 },
  { id: 'SingleInner', label: 'Inner Single', spaces: 2 },
  { id: 'Double', label: 'Double', spaces: 1 },
  { id: 'Miss', label: 'Miss', spaces: 0 },
];

export function bedById(id) {
  return BEDS.find((bed) => bed.id === id) ?? null;
}

const MULTIPLIERS = { SingleOuter: 1, SingleInner: 1, Double: 2, Triple: 3 };
const PREFIXES = { SingleOuter: 'S', SingleInner: 'S', Double: 'D', Triple: 'T' };

// Mid-ring distances from the bull, used for darts entered by hand.
const HAND_DISTANCES = { InnerBull: 0.02, OuterBull: 0.065 };

// Everything the games need to know about one dart. Number only matters for scored beds.
export function makeDart(bedId, number = 0) {
  const bed = bedById(bedId);
  const distance = HAND_DISTANCES[bedId] ?? null;
  if (bedId === 'InnerBull') return { ...bed, number: 25, name: 'Bull', points: 50, distance };
  if (bedId === 'OuterBull') return { ...bed, number: 25, name: '25', points: 25, distance };
  if (bedId === 'Miss') return { ...bed, number: 0, name: 'Miss', points: 0, distance };
  return { ...bed, number, name: `${PREFIXES[bedId]}${number}`, points: number * MULTIPLIERS[bedId], distance };
}

// The feed's coordinates have the bull at 0,0 and the outer edge of the doubles at radius 1.
function measuredDistance(dart) {
  if (!dart || dart.bouncer || dart.failed) return null;
  if (!Number.isFinite(dart.coordsX) || !Number.isFinite(dart.coordsY)) return null;
  return Math.hypot(dart.coordsX, dart.coordsY);
}

export function dartFromThrow(dart) {
  const made = makeDart(bedForThrow(dart).id, dart?.segmentNumber);
  const distance = measuredDistance(dart);
  const position = distance === null ? {} : { x: dart.coordsX, y: dart.coordsY };
  return { ...made, ...position, distance: distance ?? made.distance };
}

// Converts one entry of the Board Manager's `throws` array into a bed.
export function bedForThrow(dart) {
  const miss = bedById('Miss');
  if (!dart || dart.bouncer || dart.failed || dart.multiplier === 0) return miss;
  if (dart.segmentNumber === 25 || dart.segmentName === 'Bull' || dart.segmentName === '25') {
    return bedById(dart.multiplier === 2 || dart.segmentName === 'Bull' ? 'InnerBull' : 'OuterBull');
  }
  return BEDS.find((bed) => bed.id === dart.bed && bed.id !== 'Miss') ?? miss;
}
