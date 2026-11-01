import { art } from './art.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TILE = 100;
const STEP_MS = 170;
const SLIDE_MS = 600;
const LAND_MS = 200;
const SHORT_SNAKE = 240;
const SNAKE_WIDTH = 92;
const SNAKE_OVERHANG = 70;
const LADDER_WIDTH = 62;
const LADDER_OVERHANG = 56;
const TROPHY_SIZE = 74;

let boardEl = null;
let tokens = [];
let displayedPos = [];
let manualMiss = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Tile 1 is bottom left and rows alternate direction.
function tileCentre(tile) {
  const index = Math.max(tile, 1) - 1;
  const row = Math.floor(index / 10);
  const col = row % 2 === 0 ? index % 10 : 9 - (index % 10);
  return { x: col * TILE + TILE / 2, y: (9 - row) * TILE + TILE / 2 };
}

function svgEl(name, attrs = {}, parent) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  parent?.appendChild(el);
  return el;
}

// Stretches a vertical sprite between two tiles, turning it to run from the first to the second.
function drawBetween(svg, name, from, to, width, overhang) {
  const a = tileCentre(from);
  const b = tileCentre(to);
  const length = Math.hypot(b.x - a.x, b.y - a.y) + overhang;
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI) - 90;
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  svgEl('image', {
    href: art(name),
    x: cx - width / 2,
    y: cy - length / 2,
    width,
    height: length,
    preserveAspectRatio: 'none',
    transform: `rotate(${angle} ${cx} ${cy})`,
  }, svg);
}

// The snake's head is at the top of its sprite, so it runs from the head tile to the tail tile.
function drawSnake(svg, from, to) {
  const short = Math.hypot(tileCentre(to).x - tileCentre(from).x, tileCentre(to).y - tileCentre(from).y) < SHORT_SNAKE;
  drawBetween(svg, short ? 'snakes/snake-short' : 'snakes/snake-long', from, to, SNAKE_WIDTH, SNAKE_OVERHANG);
}

function drawLadder(svg, from, to) {
  drawBetween(svg, 'snakes/ladder', from, to, LADDER_WIDTH, LADDER_OVERHANG);
}

function placeToken(index, tile) {
  const token = tokens[index];
  token.classList.toggle('waiting', tile === 0);
  if (tile === 0) return;
  const { x, y } = tileCentre(tile);
  // Players sharing a tile sit side by side.
  const sharing = displayedPos.filter((pos) => pos === tile).length > 1;
  const offsetX = sharing ? (index % 2 === 0 ? -18 : 18) : 0;
  const offsetY = sharing ? (index < 2 ? -18 : 18) : 0;
  token.style.left = `${(x + offsetX) / 10}%`;
  token.style.top = `${(y + offsetY) / 10}%`;
}

function placeAllTokens() {
  tokens.forEach((_, i) => placeToken(i, displayedPos[i]));
}

export default {
  init(stage, rules) {
    const svg = svgEl('svg', { viewBox: '0 0 1000 1000', role: 'img', 'aria-label': 'Snakes and ladders board' });
    for (let tile = 1; tile <= rules.finish; tile++) {
      const { x, y } = tileCentre(tile);
      const left = x - TILE / 2;
      const top = y - TILE / 2;
      const fill = (x + y - TILE) % (TILE * 2) === 0 ? 'var(--tile-a)' : 'var(--tile-b)';
      svgEl('rect', { x: left, y: top, width: TILE, height: TILE, fill, class: tile === rules.finish ? 'tile-finish' : '' }, svg);
    }
    for (const [from, to] of Object.entries(rules.ladders)) drawLadder(svg, Number(from), to);
    for (const [from, to] of Object.entries(rules.snakes)) drawSnake(svg, Number(from), to);
    const finish = tileCentre(rules.finish);
    svgEl('image', {
      href: art('snakes/trophy'),
      x: finish.x - TROPHY_SIZE / 2,
      y: finish.y - TROPHY_SIZE / 2 + 8,
      width: TROPHY_SIZE,
      height: TROPHY_SIZE,
    }, svg);
    // Numbers go on top so the artwork never hides them.
    for (let tile = 1; tile <= rules.finish; tile++) {
      const { x, y } = tileCentre(tile);
      const finish = tile === rules.finish;
      const label = svgEl('text', { x: x - TILE / 2 + 8, y: y - TILE / 2 + 28, class: finish ? 'tile-finish-number' : 'tile-number' }, svg);
      label.textContent = tile;
    }
    boardEl = document.createElement('div');
    boardEl.className = 'board';
    boardEl.appendChild(svg);
    stage.replaceChildren(boardEl);
  },

  start(game) {
    tokens = game.players.map((player, i) => {
      const token = document.createElement('div');
      token.className = `token token-${i}`;
      token.textContent = i + 1;
      token.setAttribute('aria-label', player.name);
      boardEl.appendChild(token);
      return token;
    });
    this.sync(game);
  },

  sync(game) {
    displayedPos = game.players.map((player) => player.pos);
    placeAllTokens();
    tokens.forEach((token, i) => token.classList.toggle('active', i === game.current));
    manualMiss.textContent = game.players[game.current].beginner ? 1 : 0;
  },

  async animate(game, isCurrent) {
    const { last } = game;
    for (const tile of last.path) {
      if (!isCurrent()) return;
      displayedPos[last.player] = tile;
      placeAllTokens();
      await wait(STEP_MS);
    }
    if (last.path.length) {
      const landed = tokens[last.player];
      landed.classList.add('token-land');
      setTimeout(() => landed.classList.remove('token-land'), LAND_MS);
    }
    if (!isCurrent() || last.slide === null) return;
    await wait(220);
    if (!isCurrent()) return;
    const token = tokens[last.player];
    token.classList.add('sliding');
    displayedPos[last.player] = last.slide;
    placeAllTokens();
    await wait(SLIDE_MS);
    token.classList.remove('sliding');
  },

  describe(last) {
    if (last.spaces === 0) return 'Miss: no move.';
    const spaces = last.spaces === 1 ? '1 space' : `${last.spaces} spaces`;
    let text = `${last.label}: ${spaces}.`;
    if (last.bounced) text += ' Bounced off the finish!';
    if (last.kind === 'ladder') text += ` Up the ladder to ${last.slide}!`;
    if (last.kind === 'snake') text += ` Bitten! Down to ${last.slide}.`;
    return text;
  },

  pip: (dart) => `${dart.label}${dart.spaces ? ` +${dart.spaces}` : ''}`,
  score: (player) => (player.pos === 0 ? 'Start' : player.pos),
  swatch: (_player, index) => index,

  buildManual(container, rules, sendDart) {
    for (const bed of rules.beds) {
      const button = document.createElement('button');
      button.className = 'btn';
      button.type = 'button';
      const label = document.createElement('span');
      label.textContent = bed.label;
      const spaces = document.createElement('b');
      spaces.textContent = bed.spaces;
      if (bed.spaces === 0) manualMiss = spaces;
      button.append(label, spaces);
      button.addEventListener('click', () => sendDart({ bed: bed.id }));
      container.appendChild(button);
    }
  },
};
