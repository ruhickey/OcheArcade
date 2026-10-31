import { buildPad } from './pad.js';

const COLUMNS = 7;
const ROWS = 6;
const COLUMN_LABELS = ['1 8 15', '2 9 16', '3 10 17', '4 11 18', '5 12 19', '6 13 20', '7 14 Bull'];
const DROP_MS_PER_ROW = 70;
const SETTLE_MS = 180;

let els = null;

function sideNames(game, side) {
  return game.players.filter((p) => p.side === side).map((p) => p.name).join(' & ');
}

function statusText(game) {
  if (game.phase === 'over') return game.winnerText;
  if (game.phase === 'takeout') return 'Turn over';
  return `${game.players[game.current].name} to throw`;
}

function isWinning(game, column, row) {
  return game.winningCells?.some(([c, r]) => c === column && r === row) ?? false;
}

function renderBoard(game, dropping) {
  els.grid.replaceChildren();
  // Rows are drawn from the top down, so a column's newest piece sits above its older ones.
  for (let row = ROWS - 1; row >= 0; row--) {
    for (let column = 0; column < COLUMNS; column++) {
      const cell = document.createElement('div');
      cell.className = 'c4-cell';
      const side = game.columns[column][row];
      if (side) {
        const disc = document.createElement('div');
        disc.className = `c4-disc c4-${side}${isWinning(game, column, row) ? ' c4-winning' : ''}`;
        if (dropping && dropping.column === column && dropping.row === row) {
          disc.classList.add('c4-dropping');
          disc.style.setProperty('--fall', `${(ROWS - row) * -100}%`);
          disc.style.animationDuration = `${(ROWS - row) * DROP_MS_PER_ROW}ms`;
        }
        cell.appendChild(disc);
      }
      els.grid.appendChild(cell);
    }
  }
  els.labels.forEach((label, column) => {
    label.classList.toggle('c4-full', game.columns[column].length >= ROWS);
  });
}

export default {
  noEmptyTurn: true,

  init(stage) {
    stage.innerHTML = `
      <div class="c4">
        <div class="c4-sides">
          <span class="c4-side-name c4-side-left" data-left></span>
          <span class="c4-status" data-status role="status"></span>
          <span class="c4-side-name c4-side-right" data-right></span>
        </div>
        <div class="c4-frame">
          <div class="c4-labels" data-labels></div>
          <div class="c4-grid" data-grid></div>
        </div>
      </div>`;
    const labels = stage.querySelector('[data-labels]');
    els = {
      grid: stage.querySelector('[data-grid]'),
      status: stage.querySelector('[data-status]'),
      left: stage.querySelector('[data-left]'),
      right: stage.querySelector('[data-right]'),
      labels: COLUMN_LABELS.map((text) => {
        const label = document.createElement('div');
        label.className = 'c4-label';
        for (const number of text.split(' ')) {
          const line = document.createElement('span');
          line.textContent = number;
          label.appendChild(line);
        }
        labels.appendChild(label);
        return label;
      }),
    };
  },

  start(game) {
    this.sync(game);
  },

  sync(game, dropping = null) {
    els.left.textContent = sideNames(game, 'left');
    els.right.textContent = sideNames(game, 'right');
    els.status.textContent = statusText(game);
    renderBoard(game, dropping);
  },

  async animate(game, isCurrent) {
    const { last } = game;
    const placed = last.result === 'placed';
    this.sync(game, placed ? last : null);
    if (!placed) return;
    const ms = (ROWS - last.row) * DROP_MS_PER_ROW + SETTLE_MS;
    await new Promise((resolve) => setTimeout(resolve, ms));
    if (isCurrent()) this.sync(game);
  },

  describe(last) {
    if (last.result === 'miss') return 'Miss: dart lost.';
    if (last.result === 'bust') return `${last.name}: column ${last.column + 1} is full. Bust!`;
    return `${last.name}: column ${last.column + 1}.`;
  },

  pip(dart) {
    if (dart.result === 'miss') return 'Miss';
    if (dart.result === 'bust') return `${dart.name} bust`;
    return `${dart.name}: col ${dart.column + 1}`;
  },

  score: () => '',
  swatch: (player) => (player.side === 'left' ? 0 : 1),

  buildManual(container, _rules, sendDart) {
    buildPad(container, sendDart, [['SingleOuter', 'Single']], [['OuterBull', 'Bull'], ['Miss', 'Miss']]);
  },
};
