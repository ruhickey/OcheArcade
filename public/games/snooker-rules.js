// The colours and nomination mode, shared by the server (scoring) and the iPad (showing them).

export const BLACK = 25;
// In playing order. The number is what you throw at, and 25 is either bull.
export const COLOURS = [
  { number: 16, name: 'Yellow', value: 2 },
  { number: 17, name: 'Green', value: 3 },
  { number: 18, name: 'Brown', value: 4 },
  { number: 19, name: 'Blue', value: 5 },
  { number: 20, name: 'Pink', value: 6 },
  { number: BLACK, name: 'Black', value: 7 },
];
export const NOMINATE_TAP = 'Tap on the iPad';

// Beginners never have to nominate.
export function anyColourCounts(game) {
  return game.nominateMode !== NOMINATE_TAP || game.players[game.current].beginner;
}
