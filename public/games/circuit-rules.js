// What each wire's target accepts, shared by the server (scoring) and the iPad (lighting up the board).

export const RIGHT_HALF = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17];
export const LEFT_HALF = [3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const REGIONS = {
  odd: (number) => number % 2 === 1,
  even: (number) => number % 2 === 0,
  left: (number) => LEFT_HALF.includes(number),
  right: (number) => RIGHT_HALF.includes(number),
};
const BEDS = {
  single: ['SingleInner', 'SingleOuter'],
  double: ['Double'],
  triple: ['Triple'],
};

// `bed` is a board bed's id and `number` its 1 to 20 number. Bulls and misses never match.
// With `anyBed`, for a beginner, any part of a target's number will do.
export function matches(target, bed, number, anyBed = false) {
  if (!(number >= 1 && number <= 20) || !Object.values(BEDS).flat().includes(bed)) return false;
  if (REGIONS[target.kind]) return REGIONS[target.kind](number);
  return number === target.number && (anyBed || BEDS[target.kind].includes(bed));
}

export function targetText(target, anyBed = false) {
  const names = { odd: 'Odd', even: 'Even', left: 'Left half', right: 'Right half', single: 'Single', double: 'Double', triple: 'Triple' };
  if (!target.number) return names[target.kind];
  return anyBed ? `Any ${target.number}` : `${names[target.kind]} ${target.number}`;
}
