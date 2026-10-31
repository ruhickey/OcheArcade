import { buildPad } from './pad.js';
import { BLACK, COLOURS, NOMINATE_TAP } from './snooker-rules.js';

const MOVE_MS = 350;
const RED_ROWS = [[1], [2, 3], [4, 5, 6], [7, 8, 9, 10], [11, 12, 13, 14, 15]];

let els = null;
let nominateColour = null;

const colourName = (number) => COLOURS.find((colour) => colour.number === number)?.name;
const throwLabel = (number) => (number === BLACK ? 'Bull' : number);

function sideNames(game, side) {
  return game.players.filter((p) => p.side === side).map((p) => p.name).join(' & ');
}

function prompt(game) {
  const { target } = game;
  if (game.phase === 'over') return 'Frame over';
  if (game.phase === 'takeout') return game.respottedBlack ? 'Scores level: black is re-spotted' : 'Turn over';
  if (game.respottedBlack) return 'Re-spotted black: next score wins, and a foul loses!';
  if (target.kind === 'red') return 'Hit a red: any number left from 1 to 15';
  if (target.kind === 'clearance') return `Hit ${colourName(target.colour)}: ${throwLabel(target.colour)}`;
  if (game.nominateMode !== NOMINATE_TAP) return 'Hit any colour: 16 to Bull';
  if (target.nominated === null) return 'Tap a colour to nominate it';
  return `Hit ${colourName(target.nominated)}: ${throwLabel(target.nominated)}`;
}

function highlighted(game, colour) {
  const { target } = game;
  if (game.phase !== 'throwing') return false;
  if (target.kind === 'clearance') return target.colour === colour.number;
  if (target.kind !== 'colour') return false;
  return game.nominateMode === NOMINATE_TAP ? target.nominated === colour.number : true;
}

function renderReds(game) {
  const on = game.target.kind === 'red' && game.phase === 'throwing';
  els.reds.replaceChildren(...RED_ROWS.map((numbers) => {
    const row = document.createElement('div');
    row.className = 'snk-row';
    for (const number of numbers) {
      const ball = document.createElement('div');
      const gone = game.reds.includes(number);
      ball.className = `snk-ball snk-red${gone ? ' snk-gone' : ''}${on && !gone ? ' snk-on' : ''}`;
      ball.textContent = number;
      row.appendChild(ball);
    }
    return row;
  }));
}

function renderColours(game) {
  const canTap = game.phase === 'throwing' && game.target.kind === 'colour' && game.nominateMode === NOMINATE_TAP;
  els.colours.replaceChildren(...COLOURS.map((colour) => {
    const ball = document.createElement('button');
    ball.type = 'button';
    const cleared = game.reds.length === 15 && game.target.kind !== 'colour' && colour.number < game.clearance;
    ball.className = `snk-colour snk-c-${colour.name.toLowerCase()}${highlighted(game, colour) ? ' snk-on' : ''}${cleared ? ' snk-gone' : ''}`;
    ball.disabled = !canTap;
    const name = document.createElement('span');
    name.className = 'snk-colour-name';
    name.textContent = `${colour.name} ${colour.value}`;
    const number = document.createElement('span');
    number.className = 'snk-colour-number';
    number.textContent = throwLabel(colour.number);
    ball.append(number, name);
    ball.addEventListener('click', () => nominateColour?.(colour.number));
    return ball;
  }));
}

export default {
  noEmptyTurn: true,

  init(stage) {
    stage.innerHTML = `
      <div class="snk">
        <div class="snk-scores">
          <div class="snk-score"><span class="snk-score-name" data-name="left"></span><span class="snk-score-value" data-value="left"></span></div>
          <div class="snk-break"><span class="eyebrow">Break</span><span data-break></span></div>
          <div class="snk-score snk-score-right"><span class="snk-score-name" data-name="right"></span><span class="snk-score-value" data-value="right"></span></div>
        </div>
        <div class="snk-table">
          <div class="snk-reds" data-reds></div>
          <div class="snk-colours" data-colours></div>
        </div>
        <p class="snk-prompt" data-prompt role="status"></p>
      </div>`;
    els = {
      reds: stage.querySelector('[data-reds]'),
      colours: stage.querySelector('[data-colours]'),
      prompt: stage.querySelector('[data-prompt]'),
      breakScore: stage.querySelector('[data-break]'),
      names: { left: stage.querySelector('[data-name="left"]'), right: stage.querySelector('[data-name="right"]') },
      values: { left: stage.querySelector('[data-value="left"]'), right: stage.querySelector('[data-value="right"]') },
    };
  },

  start(game) {
    this.sync(game);
  },

  sync(game) {
    for (const side of ['left', 'right']) {
      els.names[side].textContent = sideNames(game, side);
      els.values[side].textContent = game.scores[side];
    }
    els.breakScore.textContent = game.breakScore;
    els.prompt.textContent = prompt(game);
    renderReds(game);
    renderColours(game);
  },

  async animate(game) {
    this.sync(game);
    await new Promise((resolve) => setTimeout(resolve, MOVE_MS));
  },

  describe(last) {
    if (last.foul) {
      const hit = last.ball === null ? 'Missed the board' : `${last.name} was wrong`;
      return `Foul! ${hit}: ${last.penalty} to the other side.`;
    }
    return `${last.name}: ${last.value === 1 ? '1 point' : `${last.value} points`}.`;
  },

  pip: (dart) => (dart.potted ? `${dart.name} potted` : `${dart.name} foul`),
  score: () => '',
  swatch: (player) => (player.side === 'left' ? 0 : 1),
  standings: (game) => [
    [sideNames(game, game.winner), game.scores[game.winner]],
    [sideNames(game, game.winner === 'left' ? 'right' : 'left'), game.scores[game.winner === 'left' ? 'right' : 'left']],
  ],

  buildManual(container, _rules, sendDart) {
    nominateColour = (colour) => fetch('/api/nominate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ colour }),
    });
    buildPad(container, sendDart, [['SingleOuter', 'Single']], [['OuterBull', 'Bull'], ['Miss', 'Miss']]);
  },
};
