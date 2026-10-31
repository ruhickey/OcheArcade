import { art, reducedMotion } from './art.js';

const HOLES = 18;
const MOVE_MS = 300;
const MISS_STROKES = 7;
const BALL_START = '10%';
const BALL_HOLE = '44%';
const MANUAL_BEDS = [
  ['Triple', 'Treble', 1],
  ['Double', 'Double', 2],
  ['SingleInner', 'Inner Single', 3],
  ['SingleOuter', 'Outer Single', 4],
  ['Miss', 'Miss or wrong number', 7],
];

let els = null;
let currentHole = 1;

// Playoff results replace the card, which is finished with by then.
function playoffTable(game) {
  const { rounds } = game.playoff;
  const table = document.createElement('table');
  table.className = 'golf-table golf-playoff';

  const head = document.createElement('tr');
  head.append(cell('th', 'Playoff hole', 'golf-name'));
  rounds.forEach((round, i) => head.append(cell('th', round.target, i === rounds.length - 1 && game.phase !== 'over' ? 'golf-now' : '')));
  head.append(cell('th', 'Total', 'golf-sum'));
  table.tHead = document.createElement('thead');
  table.tHead.append(head);

  const body = table.createTBody();
  game.players.forEach((player, index) => {
    if (!(index in rounds[0].scores) && !game.playoff.queue.includes(index)) return;
    const row = body.insertRow();
    row.className = index === game.current && game.phase !== 'over' ? 'golf-current' : '';
    row.append(cell('th', player.name, 'golf-name'));
    rounds.forEach((round, i) => {
      const live = i === rounds.length - 1 && index === game.current && game.live !== null && game.phase !== 'over';
      const played = round.scores[index];
      const classes = [live ? 'golf-live' : '', played === undefined ? '' : scoreClass(played)];
      row.append(cell('td', played ?? (live ? game.live : ''), classes.filter(Boolean).join(' ')));
    });
    row.append(cell('td', player.total, 'golf-sum golf-total'));
  });
  return table;
}

function hintText(game) {
  if (game.phase === 'over') return game.playoff ? 'Playoff decided' : `All ${HOLES} holes played`;
  if (game.live !== null) return `Best so far: ${game.live}`;
  if (!game.playoff) return `Aim for ${game.hole}. Treble is a hole in 1.`;
  const names = game.playoff.queue.map((i) => game.players[i].name).join(' & ');
  const prefix = game.playoff.rounds.length > 1 ? 'Still level! ' : 'Playoff! ';
  return `${prefix}${names}: aim for ${game.hole}.`;
}

function cell(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

function scoreClass(score) {
  if (score <= 1) return 'golf-great';
  return score === 7 ? 'golf-bad' : '';
}

const sum = (scores) => scores.reduce((total, score) => total + score, 0);

// One half of the scorecard, as printed on a real card.
function nineTable(game, first, summaryLabel, withTotal) {
  const holes = Array.from({ length: 9 }, (_, i) => first + i);
  const table = document.createElement('table');
  table.className = 'golf-table';

  const head = document.createElement('tr');
  head.append(cell('th', 'Hole', 'golf-name'));
  for (const hole of holes) head.append(cell('th', hole, hole === game.hole && game.phase !== 'over' ? 'golf-now' : ''));
  head.append(cell('th', summaryLabel, 'golf-sum'));
  if (withTotal) head.append(cell('th', 'Total', 'golf-sum'));
  table.tHead = document.createElement('thead');
  table.tHead.append(head);

  const body = table.createTBody();
  game.players.forEach((player, index) => {
    const row = body.insertRow();
    const isCurrent = index === game.current && game.phase !== 'over';
    row.className = isCurrent ? 'golf-current' : '';
    row.append(cell('th', player.name, 'golf-name'));
    for (const hole of holes) {
      const played = player.holes[hole - 1];
      const live = isCurrent && hole === game.hole && game.live !== null;
      const text = played ?? (live ? game.live : '');
      const classes = [hole === game.hole && game.phase !== 'over' ? 'golf-now' : '', live ? 'golf-live' : '', played === undefined ? '' : scoreClass(played)];
      row.append(cell('td', text, classes.filter(Boolean).join(' ')));
    }
    row.append(cell('td', sum(player.holes.slice(first - 1, first + 8)), 'golf-sum'));
    if (withTotal) row.append(cell('td', player.total, 'golf-sum golf-total'));
  });
  return table;
}

export default {
  noEmptyTurn: true,

  init(stage) {
    stage.innerHTML = `
      <div class="golf">
        <div class="golf-hero">
          <div class="golf-target">
            <span class="eyebrow" data-label></span>
            <span class="golf-target-number" data-target></span>
          </div>
          <div class="golf-hint" data-hint></div>
          <div class="golf-green">
            <img class="golf-flag" src="${art('golf/flag')}" alt="" draggable="false">
            <img class="golf-ball" src="${art('golf/ball')}" alt="" draggable="false" data-ball>
          </div>
        </div>
        <div class="golf-card" data-card></div>
      </div>`;
    els = {
      label: stage.querySelector('[data-label]'),
      target: stage.querySelector('[data-target]'),
      hint: stage.querySelector('[data-hint]'),
      card: stage.querySelector('[data-card]'),
      ball: stage.querySelector('[data-ball]'),
    };
  },

  start(game) {
    this.sync(game);
  },

  sync(game) {
    currentHole = game.hole;
    els.target.textContent = game.hole;
    els.label.textContent = game.playoff ? 'Playoff' : 'Hole';
    els.hint.textContent = hintText(game);
    if (game.playoff) els.card.replaceChildren(playoffTable(game));
    else els.card.replaceChildren(nineTable(game, 1, 'Out', false), nineTable(game, 10, 'In', true));
  },

  async animate(game) {
    this.sync(game);
    // A dart on target rolls the ball into the hole.
    if (game.last.strokes !== MISS_STROKES && !reducedMotion()) {
      await els.ball.animate([
        { left: BALL_START, opacity: 1, transform: 'scale(1) rotate(0deg)' },
        { left: BALL_HOLE, opacity: 1, transform: 'scale(1) rotate(300deg)', offset: 0.8 },
        { left: BALL_HOLE, opacity: 0, transform: 'scale(0.3) rotate(320deg)' },
      ], { duration: MOVE_MS * 2, easing: 'ease-out' }).finished;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, MOVE_MS));
  },

  describe(last) {
    if (last.hatTrick) return `Hat trick! One off, so this hole scores ${last.best}.`;
    if (last.strokes === 7) return `${last.name}: no good, that’s a 7.`;
    if (last.strokes === 1) return `${last.name}: hole in 1!`;
    return `${last.name}: that’s a ${last.strokes}.`;
  },

  pip: (dart) => `${dart.name} = ${dart.strokes}`,
  score: (player) => player.total,
  swatch: (_player, index) => index,
  // A playoff winner goes above anyone they were level with.
  standings: (game) => game.players
    .map((p, i) => ({ ...p, won: i === game.winner }))
    .sort((a, b) => a.total - b.total || b.won - a.won)
    .map((p) => [p.name, p.total]),

  buildManual(container, _rules, sendDart) {
    for (const [bed, text, strokes] of MANUAL_BEDS) {
      const button = document.createElement('button');
      button.className = 'btn';
      button.type = 'button';
      const label = document.createElement('span');
      label.textContent = text;
      const value = document.createElement('b');
      value.textContent = strokes;
      button.append(label, value);
      button.addEventListener('click', () => sendDart({ bed, number: currentHole }));
      container.appendChild(button);
    }
  },
};
