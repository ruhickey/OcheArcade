import { buildPad } from './pad.js';
import { art } from './art.js';

const BALLS = 7;
const RESULT_MS = 450;
const BALL_SPRITES = ['yellow', 'blue', 'red', 'purple', 'orange', 'green', 'brown'];
const SIDE_CLASS = { left: 'pool-side-left', right: 'pool-side-right' };

let els = null;

function sideNames(game, side) {
  return game.players.filter((p) => p.side === side).map((p) => p.name).join(' & ');
}

function targetText(game) {
  if (game.phase === 'over') return 'Game over';
  if (game.phase === 'takeout') return game.turnOver ? 'Turn over' : 'Darts out, streak still on';
  if (game.shootout) return 'Shootout: hit the Bull';
  const { side } = game.players[game.current];
  const { balls, potted } = game.sides[side];
  if (potted === BALLS) return '8-Ball: hit the Bull';
  const ball = balls[potted];
  return ball.tough ? `Double or Triple ${ball.number}` : `Hit ${ball.number}`;
}

function buildRack(game, side) {
  const state = game.sides[side];
  const live = game.phase === 'throwing' && !game.shootout && game.players[game.current].side === side;
  const box = document.createElement('div');
  box.className = `pool-side ${SIDE_CLASS[side]}${live ? ' pool-live' : ''}`;

  const head = document.createElement('div');
  head.className = 'pool-side-head';
  const name = document.createElement('span');
  name.className = 'pool-side-name';
  name.textContent = sideNames(game, side);
  const count = document.createElement('span');
  count.className = 'pool-count';
  count.textContent = `${state.thrown} darts`;
  head.append(name, count);

  const balls = document.createElement('div');
  balls.className = 'pool-balls';
  state.balls.forEach((ball, i) => {
    const el = document.createElement('div');
    const potted = i < state.potted;
    el.className = `pool-ball${potted ? ' pool-potted' : ''}${live && i === state.potted ? ' pool-now' : ''}${ball.tough ? ' pool-tough' : ''}`;
    el.style.setProperty('--ball', `url(${art(`balls/${BALL_SPRITES[i]}`)})`);
    const digits = document.createElement('span');
    digits.textContent = ball.number;
    el.appendChild(digits);
    balls.appendChild(el);
  });
  const eight = document.createElement('div');
  eight.className = `pool-ball pool-eight${state.finished ? ' pool-potted' : ''}${live && state.potted === BALLS ? ' pool-now' : ''}`;
  const label = document.createElement('span');
  // Labelled with what to throw at, because a rack can also hold the number 8.
  label.textContent = 'Bull';
  eight.appendChild(label);
  balls.appendChild(eight);

  box.append(head, balls);
  return box;
}

export default {
  noEmptyTurn: true,

  init(stage) {
    stage.innerHTML = `
      <div class="pool">
        <div class="pool-target" data-target role="status"></div>
        <div class="pool-table" data-table></div>
        <p class="pool-legend" data-legend>Glowing ring: double or triple only</p>
      </div>`;
    els = {
      target: stage.querySelector('[data-target]'),
      table: stage.querySelector('[data-table]'),
      legend: stage.querySelector('[data-legend]'),
    };
  },

  start(game) {
    this.sync(game);
  },

  sync(game) {
    els.target.textContent = targetText(game);
    els.legend.hidden = !game.sides.left.balls.some((ball) => ball.tough);
    const sides = game.players.length === 1 ? ['left'] : ['left', 'right'];
    els.table.replaceChildren(...sides.map((side) => buildRack(game, side)));
  },

  async animate(game) {
    this.sync(game);
    await new Promise((resolve) => setTimeout(resolve, RESULT_MS));
  },

  describe(last) {
    if (last.shootout) return last.hit ? `${last.name}: on the Bull!` : `${last.name}: missed the Bull.`;
    if (last.eightBall) return `${last.name}: 8-ball down!`;
    if (last.hit) return `${last.name}: potted! Keep going.`;
    if (last.near) return `${last.name}: right number, but it needs a double or triple.`;
    return `${last.name}: missed. Turn over.`;
  },

  dartSound(last) {
    if (last.hit) return 'hit';
    return last.near ? 'near' : 'miss';
  },

  pip: (dart) => (dart.hit ? `${dart.name} potted` : `${dart.name} miss`),
  score: (player) => player.thrown,
  swatch: (player) => (player.side === 'left' ? 0 : 1),
  standings: (game) => {
    if (game.players.length === 1) return [];
    const loser = game.winner === 'left' ? 'right' : 'left';
    return [game.winner, loser].map((side) => [sideNames(game, side), game.sides[side].thrown]);
  },

  buildManual(container, _rules, sendDart) {
    buildPad(
      container,
      sendDart,
      [['SingleOuter', 'Single'], ['Double', 'Double'], ['Triple', 'Triple']],
      [['OuterBull', 'Outer Bull'], ['InnerBull', 'Inner Bull'], ['Miss', 'Miss']],
    );
  },
};
