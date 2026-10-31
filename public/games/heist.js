import { buildPad } from './pad.js';
import { art } from './art.js';

const RESULT_MS = 700;
const WHEEL_DEGREES_PER_POINT = 14;
const RESULT_LABELS = { looted: 'Looted', bust: 'Bust', alarm: 'Alarm' };

let els = null;

function roundText(game) {
  if (game.phase === 'over') return 'Match over';
  if (game.playoff) return `Playoff ${game.playoff.round}`;
  return `Round ${game.round} of ${game.rounds}`;
}

function statusText(game, result) {
  if (result === 'looted') return `Vault open! +${game.last.code}`;
  if (result === 'bust') return 'Bust! Alarm!';
  if (result === 'alarm') return 'Alarm!';
  if (game.phase === 'over') return 'All vaults closed';
  return `Worth ${game.code} points`;
}

function renderRoster(game) {
  els.roster.replaceChildren(...game.players.map((player, index) => {
    const result = game.roundResults[index];
    const item = document.createElement('li');
    item.className = `heist-entry${result ? ` heist-${result}` : ''}${index === game.current && game.phase === 'throwing' ? ' heist-now' : ''}`;
    const name = document.createElement('span');
    name.textContent = player.name;
    const value = document.createElement('b');
    value.textContent = result ? RESULT_LABELS[result] : '–';
    item.append(name, value);
    return item;
  }));
}

export default {
  noEmptyTurn: true,

  init(stage) {
    stage.innerHTML = `
      <div class="heist">
        <div class="heist-round" data-round></div>
        <div class="heist-door" data-door>
          <div class="heist-dial">
            <span class="eyebrow">Code</span>
            <div class="heist-code"><span data-code></span></div>
          </div>
          <img class="heist-wheel" src="${art('heist/wheel')}" alt="" draggable="false" data-wheel>
          <img class="heist-siren" src="${art('heist/siren')}" alt="" draggable="false" data-siren hidden>
          <img class="heist-gold" src="${art('heist/gold')}" alt="" draggable="false" data-gold hidden>
        </div>
        <p class="heist-status" data-status role="status"></p>
        <ul class="heist-roster" data-roster></ul>
      </div>`;
    els = {
      door: stage.querySelector('[data-door]'),
      code: stage.querySelector('[data-code]'),
      wheel: stage.querySelector('[data-wheel]'),
      siren: stage.querySelector('[data-siren]'),
      gold: stage.querySelector('[data-gold]'),
      round: stage.querySelector('[data-round]'),
      status: stage.querySelector('[data-status]'),
      roster: stage.querySelector('[data-roster]'),
    };
  },

  start(game) {
    this.sync(game);
  },

  sync(game) {
    // This clears once the next player steps up.
    const result = game.last?.result ?? null;
    els.round.textContent = roundText(game);
    els.code.textContent = game.remaining;
    els.door.className = `heist-door${result ? ` heist-door-${result}` : ''}`;
    // The wheel turns as the code counts down.
    els.wheel.style.transform = `rotate(${(game.code - game.remaining) * WHEEL_DEGREES_PER_POINT}deg)`;
    els.siren.hidden = result !== 'bust' && result !== 'alarm';
    els.gold.hidden = result !== 'looted';
    els.status.textContent = statusText(game, result);
    renderRoster(game);
  },

  async animate(game) {
    this.sync(game);
    if (game.last.result) await new Promise((resolve) => setTimeout(resolve, RESULT_MS));
  },

  describe(last) {
    if (last.result === 'looted') return `${last.name}: exactly zero! Looted ${last.code} points!`;
    if (last.result === 'bust') return `${last.name}: below zero. Bust!`;
    if (last.result === 'alarm') return `${last.name}: ${last.remaining} left and no darts. Alarm!`;
    return `${last.name}: ${last.remaining} to go.`;
  },

  pip: (dart) => (dart.points ? `${dart.name} −${dart.points}` : 'Miss'),
  score: (player) => player.points,
  swatch: (_player, index) => index,
  standings: (game) => game.players
    .map((p, i) => ({ ...p, won: i === game.winner }))
    .sort((a, b) => b.points - a.points || b.won - a.won)
    .map((p) => [p.name, p.points]),

  buildManual(container, _rules, sendDart) {
    buildPad(
      container,
      sendDart,
      [['SingleOuter', 'Single'], ['Double', 'Double'], ['Triple', 'Triple']],
      [['OuterBull', 'Outer 25'], ['InnerBull', 'Bull 50'], ['Miss', 'Miss']],
    );
  },
};
