import { buildDartboard, BOARD_RADIUS_SHARE } from './dartboard.js';
import { PREP_MS, TURN_MS, elapsedMs } from './turn-clock.js';
import { serverNow } from './server-time.js';
import { art, preload, sprite } from './art.js';
import { play } from './sound.js';

const POP_MS = 700;
const TURN_SECONDS = TURN_MS / 1000;
const LOW_TIME_SECONDS = 5;
const PERCENT_PER_UNIT = (BOARD_RADIUS_SHARE * 100) / 2;

let els = null;
let current = null;
let frame = null;
let sendDartAt = null;
let shownSeconds = null;

const toLeft = (x) => 50 + x * PERCENT_PER_UNIT;
const toTop = (y) => 50 - y * PERCENT_PER_UNIT;

function roundText(game) {
  if (game.phase === 'over') return 'Match over';
  if (game.playoff) return `Playoff ${game.playoff.round}`;
  return `Round ${game.round} of ${game.rounds}`;
}

function renderBubbles(game) {
  els.layer.querySelectorAll('.bubble').forEach((el) => el.remove());
  for (const bubble of game.bubbles) {
    if (bubble.popped) continue;
    const el = document.createElement('div');
    el.className = 'bubble';
    el.style.backgroundImage = `url(${art(`balloons/balloon-${bubble.value}`)})`;
    el.style.width = `${bubble.r * PERCENT_PER_UNIT * 2}%`;
    el.style.height = el.style.width;
    el.style.fontSize = `calc(var(--size) * ${bubble.r * 0.3})`;
    el.style.left = `${toLeft(bubble.x)}%`;
    el.style.top = `${toTop(bubble.y)}%`;
    const digits = document.createElement('span');
    digits.textContent = bubble.value;
    el.appendChild(digits);
    els.layer.appendChild(el);
  }
}

function placeDarts(game) {
  els.darts.replaceChildren(...game.darts.filter((dart) => dart.x !== null).map((dart) => {
    const pin = document.createElement('div');
    pin.className = dart.points ? 'bubble-pin bubble-pin-hit' : 'bubble-pin';
    pin.style.left = `${toLeft(dart.x)}%`;
    pin.style.top = `${toTop(dart.y)}%`;
    return pin;
  }));
}

function renderClock(game, now) {
  els.clockCorner.hidden = !game.timed;
  els.barTrack.hidden = !game.timed;
  if (!game.timed) return;

  const ms = elapsedMs(game.clock, now);
  const seconds = Math.max(0, Math.ceil((TURN_MS - ms) / 1000));
  els.timer.textContent = game.phase === 'over' ? '' : seconds;
  els.timer.classList.toggle('bubble-timer-low', game.phase === 'throwing' && seconds <= LOW_TIME_SECONDS);
  els.bar.style.width = `${(seconds / TURN_SECONDS) * 100}%`;

  // Only a countdown second passing makes a sound, so a new turn or an undo stays quiet.
  if (game.phase === 'throwing' && seconds === shownSeconds - 1) {
    if (seconds === 0) play('buzzer');
    else if (seconds <= LOW_TIME_SECONDS) play('tick');
  }
  shownSeconds = seconds;

  const waiting = game.phase === 'throwing' && now < game.clock.prepUntil;
  els.prep.hidden = !waiting;
  if (waiting) {
    const left = Math.min(Math.ceil((game.clock.prepUntil - now) / 1000), PREP_MS / 1000);
    els.prepCount.textContent = left;
  }
}

function runFrame() {
  frame = requestAnimationFrame(runFrame);
  if (!current) return;
  renderClock(current, serverNow());
}

function popAt(last) {
  const pop = document.createElement('div');
  pop.className = 'bubble-pop';
  const points = document.createElement('span');
  points.textContent = `+${last.points}`;
  pop.append(sprite('boxing/burst', 'bubble-pop-art'), points);
  pop.style.left = `${toLeft(last.popX)}%`;
  pop.style.top = `${toTop(last.popY)}%`;
  els.layer.appendChild(pop);
  return pop;
}

export default {
  noEmptyTurn: true,

  init(stage) {
    const wrap = document.createElement('div');
    wrap.className = 'bubble-board';
    preload('boxing/burst');
    const { svg } = buildDartboard('bb', 'Dartboard with bubbles', { medallions: true });
    wrap.innerHTML = `
      <div class="bubble-layer" data-layer></div>
      <div class="bubble-darts" data-darts></div>
      <div class="bubble-corner bubble-corner-left" data-round></div>
      <div class="bubble-corner bubble-corner-right" data-clock-corner><span class="bubble-timer" data-timer></span><span class="bubble-timer-unit">sec</span></div>
      <div class="bubble-bar" data-bar-track><div class="bubble-bar-fill" data-bar></div></div>
      <div class="bubble-prep" data-prep hidden><span class="eyebrow">Get ready</span><span class="bubble-prep-count" data-prep-count></span></div>`;
    wrap.prepend(svg);
    els = {
      wrap,
      layer: wrap.querySelector('[data-layer]'),
      darts: wrap.querySelector('[data-darts]'),
      round: wrap.querySelector('[data-round]'),
      clockCorner: wrap.querySelector('[data-clock-corner]'),
      timer: wrap.querySelector('[data-timer]'),
      barTrack: wrap.querySelector('[data-bar-track]'),
      bar: wrap.querySelector('[data-bar]'),
      prep: wrap.querySelector('[data-prep]'),
      prepCount: wrap.querySelector('[data-prep-count]'),
    };
    stage.replaceChildren(wrap);
    wrap.addEventListener('click', (event) => {
      if (!current || current.phase !== 'throwing' || !sendDartAt) return;
      const box = wrap.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width * 100 - 50) / PERCENT_PER_UNIT;
      const y = (50 - (event.clientY - box.top) / box.height * 100) / PERCENT_PER_UNIT;
      sendDartAt({ bed: 'Miss', x, y });
    });
    if (frame === null) frame = requestAnimationFrame(runFrame);
  },

  start(game) {
    this.sync(game);
  },

  sync(game) {
    current = game;
    els.round.textContent = roundText(game);
    renderBubbles(game);
    placeDarts(game);
    renderClock(game, serverNow());
  },

  async animate(game) {
    this.sync(game);
    if (!game.last.points) return;
    const pop = popAt(game.last);
    await new Promise((resolve) => setTimeout(resolve, POP_MS));
    pop.remove();
  },

  describe(last) {
    if (last.tooLate) return 'Too late: time was up.';
    if (!last.points) return 'Missed the bubbles.';
    return `Popped the ${last.value} for ${last.points} points!`;
  },

  dartSound: (last) => (last.points ? 'pop' : 'miss'),

  pip(dart) {
    if (dart.tooLate) return 'Too late';
    return dart.points ? `${dart.value}: +${dart.points}` : 'Miss';
  },

  score: (player) => player.points,
  swatch: (_player, index) => index,
  standings: (game) => game.players
    .map((p, i) => ({ ...p, won: i === game.winner }))
    .sort((a, b) => b.points - a.points || b.won - a.won)
    .map((p) => [p.name, p.points]),

  buildManual(container, _rules, sendDart) {
    sendDartAt = sendDart;
    const note = document.createElement('p');
    note.className = 'bubble-note';
    note.textContent = 'Tap the board where the dart landed, or:';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = 'Missed the board';
    button.addEventListener('click', () => sendDart({ bed: 'Miss' }));
    container.append(note, button);
  },
};
