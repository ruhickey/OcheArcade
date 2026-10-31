// Each game's beer mat on the menu: its print colours, a one-line summary, and a mark drawn in the mat's ink.
const stroke = 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';

export const MATS = {
  snakes: {
    colour: '#1f7a4d', ink: '#f7f4e8', line: 'Race to exactly 100',
    mark: `<path ${stroke} d="M10 40c8 0 8-9 15-9s6 7 12 4 2-11-5-11-9-2-9-7 4-7 9-7"/><circle cx="33" cy="9" r="3.5" fill="currentColor"/>`,
  },
  tug: {
    colour: '#c8322b', ink: '#fff6e8', line: 'Drag the laser into your goal',
    mark: `<path ${stroke} d="M24 6v36M6 24h9m18 0h9M10 19l-5 5 5 5m28-10 5 5-5 5"/>`,
  },
  golf: {
    colour: '#ebc94f', ink: '#1a2421', line: '18 holes, lowest total wins',
    mark: `<path ${stroke} d="M18 40V8l16 7-16 7"/><ellipse ${stroke} cx="24" cy="40" rx="14" ry="3.5"/>`,
  },
  paintball: {
    colour: '#f2eedf', ink: '#1a2421', line: 'Claim zones and steal them',
    mark: '<path fill="#c8322b" d="M24 8c3 0 3 6 6 6s6-4 8-1-3 6-1 9 7 2 7 5-6 3-8 6 2 8-1 9-6-4-9-3-5 6-8 4 0-7-2-9-8-2-8-5 6-4 6-7-4-7-1-9 6 2 8 0 0-5 3-5Z"/>',
  },
  balloons: {
    colour: '#2a6fbb', ink: '#ffffff', line: 'Pop bubbles against the clock',
    mark: `<circle ${stroke} cx="17" cy="19" r="10"/><circle ${stroke} cx="34" cy="31" r="7"/><circle cx="36" cy="10" r="4" fill="currentColor"/>`,
  },
  snooker: {
    colour: '#0f5c3f', ink: '#f7f4e8', line: 'Clear the reds, then the colours',
    mark: '<circle cx="24" cy="12" r="6" fill="#d9362c"/><circle cx="17" cy="24" r="6" fill="#d9362c"/><circle cx="31" cy="24" r="6" fill="#d9362c"/><circle cx="10" cy="36" r="6" fill="#d9362c"/><circle cx="24" cy="36" r="6" fill="#d9362c"/><circle cx="38" cy="36" r="6" fill="#d9362c"/>',
  },
  boxing: {
    colour: '#7e1b2a', ink: '#fbefd9', line: 'Hit their numbers, heal on yours',
    mark: `<path ${stroke} d="M13 40V27c-4-3-5-8-4-12 2-7 9-9 16-8 9 1 14 7 13 15-1 5-4 7-8 8v10Z"/><path ${stroke} d="M13 40h17M21 19c4-3 9-2 10 1"/>`,
  },
  fourinarow: {
    colour: '#2b3e8c', ink: '#ffffff', line: 'Line up four pieces',
    mark: '<circle cx="9" cy="39" r="5" fill="currentColor"/><circle cx="19" cy="29" r="5" fill="currentColor"/><circle cx="29" cy="19" r="5" fill="currentColor"/><circle cx="39" cy="9" r="5" fill="currentColor"/>',
  },
  heist: {
    colour: '#3e4a47', ink: '#ebc94f', line: 'Crack the code to exactly zero',
    mark: `<circle ${stroke} cx="24" cy="24" r="18"/><circle ${stroke} cx="24" cy="24" r="7"/><path ${stroke} d="M24 6v6m0 24v6M6 24h6m24 0h6"/>`,
  },
  conquer: {
    colour: '#d2b07a', ink: '#1a2421', line: 'Spread out and hold the bull',
    mark: `<path ${stroke} d="M10 42V8"/><path fill="currentColor" d="M10 8h26l-7 8 7 8H10Z"/>`,
  },
  circuit: {
    colour: '#e8782a', ink: '#1a2421', line: 'Cut the wires before it blows',
    mark: `<circle ${stroke} cx="21" cy="29" r="13"/><path ${stroke} d="M29 19l5-6m0 0c1-4 5-5 8-3"/><path ${stroke} d="M15 25c1-2 3-3 5-3"/>`,
  },
  pool: {
    colour: '#4a1e6e', ink: '#ff9be3', line: 'Pot seven, then the 8-ball',
    mark: '<circle cx="24" cy="24" r="19" fill="#111"/><circle cx="24" cy="22" r="9.5" fill="#f7f4e8"/><text x="24" y="27.5" text-anchor="middle" font-family="var(--font-display)" font-size="14" fill="#111">8</text>',
  },
};

export function markSvg(game) {
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${MATS[game].mark}</svg>`;
}

export function applyMatColours(el, game) {
  el.style.setProperty('--mat', MATS[game].colour);
  el.style.setProperty('--mat-ink', MATS[game].ink);
}
