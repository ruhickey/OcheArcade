import { buildPad } from './pad.js';

const RESULT_MS = 900;
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

let els = null;

const average = (player) => (player.dartsThrown ? (player.pointsScored / player.dartsThrown) * 3 : 0);
const turnTotal = (game) => game.darts.reduce((total, dart) => total + dart.points, 0);

function formatText(game) {
  const entry = game.doubleIn ? 'double in, double out' : 'double out';
  const target = game.setsToWin > 1
    ? `first to ${plural(game.setsToWin, 'set')} of ${plural(game.legsToWin, 'leg')}`
    : `first to ${plural(game.legsToWin, 'leg')}`;
  return `${game.start} · ${entry} · ${target}`;
}

function progressText(game) {
  if (game.phase === 'over') return 'Match over';
  return game.setsToWin > 1 ? `Set ${game.set} · Leg ${game.leg}` : `Leg ${game.leg}`;
}

function statusText(game) {
  const { last } = game;
  const player = game.players[game.current];
  if (last?.result === 'match') return 'Game shot, and the match!';
  if (last?.result === 'set') return `Game shot, and the set to ${player.name}!`;
  if (last?.result === 'leg') return `Game shot! Leg to ${player.name}`;
  if (last?.result === 'bust') return 'Bust!';
  if (!player.opened) return 'Hit a double to start scoring';
  if (game.darts.length) return `${turnTotal(game)} this turn`;
  return `${player.name} to throw`;
}

function card(game, player, index) {
  const item = document.createElement('li');
  const now = index === game.current && game.phase !== 'over';
  item.style.setProperty('--who', `var(--p${index})`);
  item.className = `x01-player${now ? ' x01-now' : ''}${game.winner === index ? ' x01-winner' : ''}`;

  const name = document.createElement('span');
  name.className = 'x01-name';
  name.textContent = player.name;

  const remaining = document.createElement('span');
  remaining.className = `x01-remaining${now && game.last?.result === 'bust' ? ' x01-bust' : ''}`;
  remaining.textContent = player.remaining;

  const tally = document.createElement('span');
  tally.className = 'x01-tally';
  const parts = [];
  if (game.setsToWin > 1) parts.push(`Sets ${player.sets}`);
  parts.push(`Legs ${player.legs}`);
  parts.push(`Avg ${average(player).toFixed(1)}`);
  tally.textContent = parts.join(' · ');

  item.append(name, remaining, tally);
  if (game.doubleIn && !player.opened) {
    const tag = document.createElement('span');
    tag.className = 'x01-closed';
    tag.textContent = 'Not in yet';
    item.append(tag);
  }
  return item;
}

export default {
  init(stage) {
    stage.innerHTML = `
      <div class="x01">
        <div class="x01-head">
          <span class="x01-progress" data-progress></span>
          <span class="x01-format" data-format></span>
        </div>
        <p class="x01-status" data-status role="status"></p>
        <ol class="x01-players" data-players></ol>
      </div>`;
    els = {
      progress: stage.querySelector('[data-progress]'),
      format: stage.querySelector('[data-format]'),
      status: stage.querySelector('[data-status]'),
      players: stage.querySelector('[data-players]'),
    };
  },

  start(game) {
    this.sync(game);
  },

  sync(game) {
    els.progress.textContent = progressText(game);
    els.format.textContent = formatText(game);
    els.status.textContent = statusText(game);
    els.status.className = `x01-status${game.legWon ? ' x01-status-won' : ''}${game.last?.result === 'bust' ? ' x01-status-bust' : ''}`;
    els.players.dataset.count = game.players.length;
    els.players.replaceChildren(...game.players.map((player, index) => card(game, player, index)));
  },

  async animate(game) {
    this.sync(game);
    if (game.last.result && game.last.result !== 'closed') await new Promise((resolve) => setTimeout(resolve, RESULT_MS));
  },

  describe(last) {
    if (last.result === 'match' || last.result === 'set' || last.result === 'leg') return `${last.name}: game shot!`;
    if (last.result === 'bust') return `${last.name}: bust! Back to ${last.remaining}.`;
    if (last.result === 'closed') return `${last.name}: you need a double to start.`;
    if (last.opening) return `${last.name}: you’re in! ${last.remaining} left.`;
    return `${last.name}: ${last.remaining} left.`;
  },

  dartSound: (last) => {
    if (last.result === 'bust') return 'buzzer';
    return last.points ? 'hit' : 'miss';
  },

  pip: (dart) => (dart.points ? `${dart.name} ${dart.points}` : dart.name),
  score: (player) => player.remaining,
  swatch: (_player, index) => index,
  standings: (game) => game.players
    .map((p, i) => ({ ...p, won: i === game.winner }))
    .sort((a, b) => b.won - a.won || b.sets - a.sets || b.legs - a.legs || a.remaining - b.remaining)
    .map((p) => {
      const tally = game.setsToWin > 1 ? plural(p.sets, 'set') : plural(p.legs, 'leg');
      return [p.name, `${tally} · ${average(p).toFixed(1)} avg`];
    }),

  buildManual(container, _rules, sendDart) {
    buildPad(
      container,
      sendDart,
      [['SingleOuter', 'Single'], ['Double', 'Double'], ['Triple', 'Triple']],
      [['OuterBull', 'Outer 25'], ['InnerBull', 'Bull 50'], ['Miss', 'Miss']],
    );
  },
};
