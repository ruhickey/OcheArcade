import { buildPad } from './pad.js';
import { buildDartboard, svgEl, zoneCentre } from './dartboard.js';
import { art, preload } from './art.js';

const SPLAT_MS = 550;
const SPLAT_SIZE = 200;
const PLAYER_COUNT = 4;

let els = null;
let zoneEls = {};

function roundText(game) {
  if (game.phase === 'over') return 'Match over';
  if (game.playoff) return `Playoff ${game.playoff.round}`;
  return `Round ${game.round} of ${game.rounds}`;
}

// Two splat shapes take turns, each turned differently so repeats don't look stamped.
function splat(zone, player, seq) {
  const [x, y] = zoneCentre(zone);
  const shape = seq % 2 === 0 ? 'a' : 'b';
  const group = svgEl('g', { class: 'paint-splat', style: `transform-origin: ${x}px ${y}px` }, els.svg);
  svgEl('image', {
    href: art(`paintball/splat-${shape}-${player}`),
    x: x - SPLAT_SIZE / 2,
    y: y - SPLAT_SIZE / 2,
    width: SPLAT_SIZE,
    height: SPLAT_SIZE,
    transform: `rotate(${(seq * 67) % 360} ${x} ${y})`,
  }, group);
  return group;
}

export default {
  noEmptyTurn: true,

  init(stage) {
    const wrap = document.createElement('div');
    wrap.className = 'paint-board';
    for (let i = 0; i < PLAYER_COUNT; i++) preload(`paintball/splat-a-${i}`, `paintball/splat-b-${i}`);
    const board = buildDartboard('paint', 'Dartboard showing painted zones');
    zoneEls = board.zones;
    els = {
      svg: board.svg,
      round: document.createElement('div'),
      left: document.createElement('div'),
    };
    els.round.className = 'paint-corner paint-corner-left';
    els.left.className = 'paint-corner paint-corner-right';
    wrap.append(els.svg, els.round, els.left);
    stage.replaceChildren(wrap);
  },

  start(game) {
    this.sync(game);
  },

  sync(game) {
    for (const [zone, el] of Object.entries(zoneEls)) {
      const owner = game.zoneOwners[zone];
      el.classList.remove('paint-owner-0', 'paint-owner-1', 'paint-owner-2', 'paint-owner-3');
      if (owner !== undefined) el.classList.add(`paint-owner-${owner}`);
    }
    els.round.textContent = roundText(game);
    const left = Object.keys(zoneEls).length - Object.keys(game.zoneOwners).length;
    els.left.textContent = `${left} unpainted`;
  },

  async animate(game) {
    const { last } = game;
    const painted = last.result === 'claim' || last.result === 'steal';
    const blot = painted ? splat(last.zone, last.player, game.seq) : null;
    this.sync(game);
    if (blot) {
      await new Promise((resolve) => setTimeout(resolve, SPLAT_MS));
      blot.remove();
    }
  },

  describe(last) {
    if (last.result === 'miss') return 'Miss: no paint.';
    if (last.result === 'own') return `${last.name}: already yours.`;
    if (last.result === 'claim') return `${last.name}: claimed!`;
    return `${last.name}: stolen!`;
  },

  pip(dart) {
    if (dart.result === 'miss') return 'Miss';
    const words = { claim: 'claimed', steal: 'stolen', own: 'yours' };
    return `${dart.name} ${words[dart.result]}`;
  },

  score: (player) => player.zones,
  swatch: (_player, index) => index,
  standings: (game) => game.players
    .map((p, i) => ({ ...p, won: i === game.winner }))
    .sort((a, b) => b.zones - a.zones || b.won - a.won)
    .map((p) => [p.name, p.zones]),

  buildManual(container, _rules, sendDart) {
    buildPad(
      container,
      sendDart,
      [['SingleOuter', 'Outer'], ['SingleInner', 'Inner'], ['Double', 'Double'], ['Triple', 'Triple']],
      [['OuterBull', 'Outer Bull'], ['InnerBull', 'Inner Bull'], ['Miss', 'Miss']],
    );
  },
};
