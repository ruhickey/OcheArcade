import { buildPad } from './pad.js';
import { buildDartboard, svgEl, zoneCentre } from './dartboard.js';
import { art } from './art.js';
import { BULL, canReach } from './conquer-rules.js';

const FLASH_MS = 550;
const MAX_SHIELDS = 3;
const SHIELD = [34, 40, 31];
const BULL_SHIELD = [20, 24, 19];
const CASTLE_SIZE = 70;
const FLAG_SIZE = 62;
const OWNER_CLASSES = ['cq-owner-0', 'cq-owner-1', 'cq-owner-2', 'cq-owner-3'];

let els = null;
let zonesByNumber = {};

const zoneNumber = (zone) => (zone === 'InnerBull' || zone === 'OuterBull' ? BULL : Number(zone.split('-')[1]));

function roundText(game) {
  if (game.phase === 'over') return 'Campaign over';
  if (game.playoff) return `Playoff ${game.playoff.round}`;
  return `Round ${game.round} of ${game.rounds}`;
}

function hintText(game) {
  if (game.phase !== 'throwing') return '';
  const player = game.players[game.current];
  if (game.regions[BULL]?.owner === game.current) return `${player.name} holds the bull: anywhere goes`;
  return `${player.name}: bright numbers are in reach`;
}

function placeImage(name, x, y, width, height, className) {
  const attrs = { href: art(name), x: x - width / 2, y: y - height / 2, width, height };
  if (className) attrs.class = className;
  return svgEl('image', attrs, els.markers);
}

function drawMarkers(game) {
  els.markers.replaceChildren();
  for (const [key, region] of Object.entries(game.regions)) {
    const number = Number(key);
    const isBull = number === BULL;
    const [x, y] = isBull ? [500, 500] : zoneCentre(`SingleOuter-${number}`);
    const [width, height, spacing] = isBull ? BULL_SHIELD : SHIELD;
    for (let i = 0; i < MAX_SHIELDS; i++) {
      placeImage('conquer/shield', x + (i - (MAX_SHIELDS - 1) / 2) * spacing, y, width, height, i < region.shields ? '' : 'cq-shield-lost');
    }
    if (isBull) continue;
    // A player's home stands out as a castle for as long as they hold it.
    const [cx, cy] = zoneCentre(`SingleInner-${number}`);
    if (game.players[region.owner].home === number) placeImage('conquer/castle', cx, cy, CASTLE_SIZE, CASTLE_SIZE);
    else placeImage(`conquer/flag-${region.owner}`, cx, cy, FLAG_SIZE, FLAG_SIZE);
  }
}

export default {
  noEmptyTurn: true,

  init(stage) {
    const wrap = document.createElement('div');
    wrap.className = 'cq-board';
    const { svg, zones } = buildDartboard('cq', 'Dartboard showing territory', { medallions: true });
    zonesByNumber = {};
    for (const [zone, el] of Object.entries(zones)) {
      const number = zoneNumber(zone);
      (zonesByNumber[number] ??= []).push(el);
    }
    const markers = svgEl('g', {}, svg);
    const round = document.createElement('div');
    round.className = 'cq-corner cq-corner-left';
    const hint = document.createElement('div');
    hint.className = 'cq-hint';
    hint.setAttribute('role', 'status');
    wrap.append(svg, round, hint);
    stage.replaceChildren(wrap);
    els = { markers, round, hint, flashes: [] };
  },

  start(game) {
    this.sync(game);
  },

  sync(game) {
    const throwing = game.phase === 'throwing';
    for (const [key, parts] of Object.entries(zonesByNumber)) {
      const number = Number(key);
      const owner = game.regions[number]?.owner;
      const dim = throwing && !canReach(game.regions, game.current, number);
      for (const el of parts) {
        el.classList.remove(...OWNER_CLASSES);
        if (owner !== undefined) el.classList.add(`cq-owner-${owner}`);
        el.classList.toggle('cq-dim', dim);
      }
    }
    drawMarkers(game);
    els.round.textContent = roundText(game);
    els.hint.textContent = hintText(game);
  },

  async animate(game, isCurrent) {
    this.sync(game);
    const { number, result } = game.last;
    if (number === null || result === 'blocked' || result === 'full') return;
    const parts = zonesByNumber[number];
    parts.forEach((el) => el.classList.add('cq-flash'));
    await new Promise((resolve) => setTimeout(resolve, FLASH_MS));
    parts.forEach((el) => el.classList.remove('cq-flash'));
    if (isCurrent()) this.sync(game);
  },

  describe(last) {
    const { name, result, shields } = last;
    if (result === 'miss') return 'Miss: dart lost.';
    if (result === 'blocked') return `${name}: out of reach, dart lost.`;
    if (result === 'claim') return `${name}: claimed!`;
    if (result === 'steal') return `${name}: stolen!`;
    if (result === 'broken') return `${name}: shields down! Hit it again to steal it.`;
    if (result === 'damage') return `${name}: shields down to ${shields}.`;
    if (result === 'reinforce') return `${name}: shields up to ${shields}.`;
    return `${name}: shields already at maximum.`;
  },

  pip(dart) {
    const words = { miss: 'Miss', blocked: 'blocked', claim: 'claimed', steal: 'stolen', broken: 'broken', damage: 'hit', reinforce: 'shield', full: 'full' };
    return dart.result === 'miss' ? words.miss : `${dart.name} ${words[dart.result]}`;
  },

  score: (player) => player.score,
  swatch: (_player, index) => index,
  standings: (game) => game.players
    .map((p, i) => ({ ...p, won: i === game.winner }))
    .sort((a, b) => b.score - a.score || b.won - a.won)
    .map((p) => [p.name, p.score]),

  buildManual(container, _rules, sendDart) {
    buildPad(
      container,
      sendDart,
      [['SingleOuter', 'Single'], ['Double', 'Double'], ['Triple', 'Triple']],
      [['OuterBull', 'Outer Bull'], ['InnerBull', 'Inner Bull'], ['Miss', 'Miss']],
    );
  },
};
