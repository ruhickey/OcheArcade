// Who can hit what, shared by the server (scoring) and the iPad (highlighting) so they always agree.

export const BULL = 25;
export const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export function neighbours(number) {
  const index = BOARD_ORDER.indexOf(number);
  const count = BOARD_ORDER.length;
  return [BOARD_ORDER[(index + count - 1) % count], BOARD_ORDER[(index + 1) % count]];
}

const ownedBy = (regions, player) => Object.keys(regions).map(Number).filter((n) => regions[n].owner === player);

// The bull is always in play. Holding it lifts the adjacency rule, and so does having nothing left.
// `free` lifts it too, for a beginner.
export function canReach(regions, player, number, free = false) {
  if (free || number === BULL) return true;
  const owned = ownedBy(regions, player);
  if (owned.length === 0 || owned.includes(BULL) || owned.includes(number)) return true;
  return neighbours(number).some((neighbour) => owned.includes(neighbour));
}
