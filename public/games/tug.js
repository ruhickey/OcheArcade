import { buildPad } from './pad.js';
import { art } from './art.js';

const POP_MS = 700;
// Each goal strip covers 7% of the track, so the laser scores as it touches one.
const TRACK_SPAN = 43;
const SIDE_LABEL = { left: 'Left', right: 'Right' };

let winPull = 0;
let els = null;

// Converts rope position to a percentage across the track.
const percent = (rope) => 50 + (rope / winPull) * TRACK_SPAN;

function sideNames(game, side) {
  return game.players.filter((p) => p.side === side).map((p) => p.name).join(' & ');
}

function sidePoints(game, side) {
  return game.players.filter((p) => p.side === side).reduce((total, p) => total + p.points, 0);
}

function statusText(game) {
  if (game.rope === 0) return 'Dead centre';
  const side = game.rope < 0 ? 'left' : 'right';
  const toGo = winPull - Math.abs(game.rope);
  const isTeam = game.players.filter((p) => p.side === side).length > 1;
  if (toGo === 0) return `${sideNames(game, side)} pulled it home`;
  return `${sideNames(game, side)} ${isTeam ? 'need' : 'needs'} ${toGo} more`;
}

export default {
  init(stage) {
    stage.innerHTML = `
      <div class="tug">
        <div class="tug-sides">
          <div class="tug-side tug-side-left"><span class="tug-side-name" data-name="left"></span><span class="tug-side-points" data-points="left"></span></div>
          <div class="tug-side tug-side-right"><span class="tug-side-name" data-name="right"></span><span class="tug-side-points" data-points="right"></span></div>
        </div>
        <div class="tug-track">
          <div class="tug-fill" data-fill></div>
          <div class="tug-goal tug-goal-left"><img src="${art('tug/pylon-left')}" alt="Left goal" draggable="false"></div>
          <div class="tug-goal tug-goal-right"><img src="${art('tug/pylon-right')}" alt="Right goal" draggable="false"></div>
          <div class="tug-laser" data-laser></div>
          <img class="tug-emitter tug-emitter-top" src="${art('tug/emitter')}" alt="" draggable="false" data-emitter>
          <img class="tug-emitter tug-emitter-bottom" src="${art('tug/emitter')}" alt="" draggable="false" data-emitter>
        </div>
        <p class="tug-status" data-status></p>
      </div>`;
    els = {
      track: stage.querySelector('.tug-track'),
      laser: stage.querySelector('[data-laser]'),
      emitters: stage.querySelectorAll('[data-emitter]'),
      fill: stage.querySelector('[data-fill]'),
      status: stage.querySelector('[data-status]'),
      names: { left: stage.querySelector('[data-name="left"]'), right: stage.querySelector('[data-name="right"]') },
      points: { left: stage.querySelector('[data-points="left"]'), right: stage.querySelector('[data-points="right"]') },
    };
  },

  start(game) {
    winPull = game.winPull;
    // Ticks show the points still needed from that spot.
    for (let mark = -75; mark <= 75; mark += 25) {
      const tick = document.createElement('div');
      tick.className = mark === 0 ? 'tug-tick centre' : 'tug-tick';
      tick.style.left = `${50 + (mark / 100) * TRACK_SPAN}%`;
      const label = document.createElement('span');
      label.textContent = Math.round(((100 - Math.abs(mark)) / 100) * winPull);
      tick.appendChild(label);
      els.track.insertBefore(tick, els.laser);
    }
    this.sync(game);
  },

  sync(game) {
    for (const side of ['left', 'right']) {
      els.names[side].textContent = sideNames(game, side);
      els.points[side].textContent = `${sidePoints(game, side)} points`;
    }
    const at = percent(game.rope);
    els.laser.style.left = `${at}%`;
    els.emitters.forEach((emitter) => { emitter.style.left = `${at}%`; });
    els.fill.style.left = `${Math.min(at, 50)}%`;
    els.fill.style.width = `${Math.abs(at - 50)}%`;
    els.fill.className = `tug-fill ${game.rope < 0 ? 'left' : 'right'}`;
    els.status.textContent = statusText(game);
  },

  async animate(game) {
    this.sync(game);
    const pop = document.createElement('div');
    pop.className = 'tug-pop';
    pop.textContent = game.last.points ? `${game.last.name} +${game.last.points}` : 'Miss';
    // Keeps the label on screen when the laser is close to a goal.
    pop.style.left = `${Math.max(14, Math.min(86, percent(game.rope)))}%`;
    els.track.appendChild(pop);
    await new Promise((resolve) => setTimeout(resolve, POP_MS));
    pop.remove();
  },

  describe(last) {
    if (last.points === 0) return 'Miss: no pull.';
    return `${last.name}: pulls ${last.points} ${SIDE_LABEL[last.side].toLowerCase()}.`;
  },

  pip: (dart) => (dart.points ? `${dart.name} +${dart.points}` : 'Miss'),
  score: (player) => player.points,
  swatch: (player) => (player.side === 'left' ? 0 : 1),

  buildManual(container, _rules, sendDart) {
    buildPad(
      container,
      sendDart,
      [['SingleOuter', 'Single'], ['Double', 'Double'], ['Triple', 'Triple']],
      [['OuterBull', 'Outer 25'], ['InnerBull', 'Bull 50'], ['Miss', 'Miss']],
    );
  },
};
