import { buildPad } from './pad.js';
import { buildDartboard } from './dartboard.js';
import { matches, targetText } from './circuit-rules.js';
import { PREP_MS, TURN_MS, elapsedMs } from './turn-clock.js';
import { serverNow } from './server-time.js';
import { art, preload, sprite } from './art.js';

const RESULT_MS = 600;
const LOW_TIME_SECONDS = 5;
const WIRE_COLOURS = ['red', 'blue', 'yellow'];

let els = null;
let zones = {};
let current = null;
let frame = null;

function zoneMatches(target, zone, anyBed) {
  if (zone === 'InnerBull' || zone === 'OuterBull') return false;
  const [bed, number] = zone.split('-');
  return matches(target, bed, Number(number), anyBed);
}

function renderClock(game, now) {
  const ms = elapsedMs(game.clock, now);
  const seconds = Math.max(0, Math.ceil((TURN_MS - ms) / 1000));
  // The get-ready countdown shares the timer's spot, so it can't cover a target on the board.
  const waiting = game.phase === 'throwing' && now < game.clock.prepUntil;
  const prepSeconds = Math.min(Math.ceil((game.clock.prepUntil - now) / 1000), PREP_MS / 1000);
  els.timer.textContent = game.phase === 'over' ? '' : waiting ? prepSeconds : seconds;
  els.timer.classList.toggle('cb-timer-prep', waiting);
  els.timer.classList.toggle('cb-timer-low', !waiting && game.phase === 'throwing' && seconds <= LOW_TIME_SECONDS);
  els.unit.textContent = waiting ? 'get ready' : 'sec';
}

function runFrame() {
  frame = requestAnimationFrame(runFrame);
  if (current) renderClock(current, serverNow());
}

function renderWires(game) {
  els.wires.replaceChildren(...WIRE_COLOURS.map((colour, index) => {
    const wire = document.createElement('div');
    const cut = index < game.wire;
    const live = index === game.wire && game.phase === 'throwing';
    wire.className = `cb-wire cb-wire-${colour}${cut ? ' cb-cut' : ''}${live ? ' cb-live' : ''}`;
    const line = document.createElement('div');
    line.className = 'cb-line';
    const label = document.createElement('div');
    label.className = 'cb-wire-label';
    label.textContent = cut ? 'Cut' : targetText(game.wires[index], game.players[game.current].beginner);
    wire.append(line, label);
    return wire;
  }));
}

function renderLives(game) {
  els.lives.replaceChildren(...Array.from({ length: game.maxLives }, (_, i) => {
    const pip = document.createElement('span');
    pip.className = i < game.lives ? 'cb-life' : 'cb-life cb-life-lost';
    return pip;
  }));
}

export default {
  noEmptyTurn: true,

  init(stage) {
    stage.innerHTML = `
      <div class="cb">
        <div class="cb-top">
          <div class="cb-meta">
            <span class="eyebrow" data-bomb></span>
            <div class="cb-lives" data-lives></div>
          </div>
          <div class="cb-target" data-target role="status"></div>
          <div class="cb-clock"><span class="cb-timer" data-timer></span><span class="cb-unit" data-unit></span></div>
        </div>
        <div class="cb-board" data-board>
          <img class="cb-bomb" src="${art('circuit/bomb')}" alt="" draggable="false" data-live-bomb>
        </div>
        <div class="cb-wires" data-wires></div>
      </div>`;
    const board = stage.querySelector('[data-board]');
    const built = buildDartboard('cb', 'Dartboard with the current target lit up');
    zones = built.zones;
    board.prepend(built.svg);
    preload('circuit/explosion', 'circuit/cutters');
    els = {
      board,
      liveBomb: stage.querySelector('[data-live-bomb]'),
      bomb: stage.querySelector('[data-bomb]'),
      lives: stage.querySelector('[data-lives]'),
      target: stage.querySelector('[data-target]'),
      timer: stage.querySelector('[data-timer]'),
      wires: stage.querySelector('[data-wires]'),
      unit: stage.querySelector('[data-unit]'),
    };
    if (frame === null) frame = requestAnimationFrame(runFrame);
  },

  start(game) {
    this.sync(game);
  },

  stop() {
    cancelAnimationFrame(frame);
    frame = null;
    current = null;
  },

  sync(game) {
    current = game;
    const target = game.wires[Math.min(game.wire, game.wires.length - 1)];
    const live = game.phase === 'throwing';
    const { beginner } = game.players[game.current];
    for (const [zone, el] of Object.entries(zones)) {
      const on = live && zoneMatches(target, zone, beginner);
      el.classList.toggle('cb-on', on);
      el.classList.toggle('cb-off', live && !on);
    }
    const bomb = Math.min(game.defused + 1, game.bombs);
    els.bomb.textContent = `Bomb ${bomb} of ${game.bombs}`;
    els.liveBomb.hidden = game.phase === 'over';
    if (game.phase === 'over') els.target.textContent = game.winner ? 'Defused!' : 'Boom!';
    else if (game.phase === 'takeout') els.target.textContent = 'Turn over';
    else els.target.textContent = targetText(target, beginner);
    renderLives(game);
    renderWires(game);
    renderClock(game, serverNow());
  },

  async animate(game) {
    this.sync(game);
    const { last } = game;
    if (last.spared) return;
    // A cut snips the wire just cut, and anything else blows up on the board.
    const effect = last.hit
      ? sprite('circuit/cutters', 'cb-snip')
      : sprite('circuit/explosion', 'cb-explosion');
    if (last.hit) {
      const cutIndex = last.defusedBomb ? WIRE_COLOURS.length - 1 : game.wire - 1;
      els.wires.children[cutIndex].appendChild(effect);
    } else {
      els.board.appendChild(effect);
    }
    await new Promise((resolve) => setTimeout(resolve, RESULT_MS));
    effect.remove();
  },

  describe(last) {
    if (last.timedOut) return 'Time’s up! That cost a life.';
    if (last.tooLate) return 'Too late! That cost a life.';
    if (last.defusedBomb) return `${last.name}: bomb defused!`;
    if (last.hit) return `${last.name}: wire cut!`;
    if (last.spared) return `${last.name}: wrong wire, but no harm done.`;
    return `${last.name}: wrong wire! That cost a life.`;
  },

  pip: (dart) => {
    if (dart.hit) return `${dart.name} cut`;
    return dart.spared ? `${dart.name} safe` : `${dart.name} boom`;
  },
  score: (player) => player.cuts,
  swatch: (_player, index) => index,

  buildManual(container, _rules, sendDart) {
    buildPad(
      container,
      sendDart,
      [['SingleOuter', 'Single'], ['Double', 'Double'], ['Triple', 'Triple']],
      [['OuterBull', 'Outer Bull'], ['InnerBull', 'Inner Bull'], ['Miss', 'Miss']],
    );
  },
};
