// Two-sided games: larger groups split into two teams.

// Three players go one against two, otherwise players alternate sides.
export function sideOf(index, count) {
  if (count === 3) return index === 0 ? 'left' : 'right';
  return index % 2 === 0 ? 'left' : 'right';
}

// Sides take turns, so a lone player throws as often as the other team.
export function turnOrderFor(count) {
  return count === 3 ? [0, 1, 0, 2] : Array.from({ length: count }, (_, i) => i);
}

// Puts bull-off rankings into seats: 1st and 4th play 2nd and 3rd.
export function arrange(ranked) {
  return ranked.length === 4 ? [ranked[0], ranked[1], ranked[3], ranked[2]] : ranked;
}

export function sideNames(players, side) {
  return players.filter((p) => p.side === side).map((p) => p.name);
}

export function sideWinsText(players, side) {
  const names = sideNames(players, side);
  return names.length === 1 ? `${names[0]} wins!` : `${names.join(' & ')} win!`;
}
