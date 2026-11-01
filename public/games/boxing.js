import { buildPad } from './pad.js';

const ART = '/art/boxing';
const FLY_MS = 170;
const RETREAT_MS = 150;
const HIT_MS = 520;
const HEAL_MS = 620;
const PLAYER_COUNT = 4;

let els = null;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sprite(name, className) {
  const img = document.createElement('img');
  img.src = `${ART}/${name}.webp`;
  img.className = className;
  img.alt = '';
  img.draggable = false;
  return img;
}

// Loaded up front so the first punch of a game doesn't arrive before its art.
function preloadArt() {
  for (let i = 0; i < PLAYER_COUNT; i++) new Image().src = `${ART}/glove-${i}.webp`;
  new Image().src = `${ART}/heart.webp`;
  new Image().src = `${ART}/burst.webp`;
}

function centreIn(element, container) {
  const box = element.getBoundingClientRect();
  const outer = container.getBoundingClientRect();
  return { x: box.left + box.width / 2 - outer.left, y: box.top + box.height / 2 - outer.top, size: box.width };
}

// Throws the attacker's glove at the target's card. It stops dead on contact, then pulls back.
async function throwPunch(attacker, target) {
  const { x, y, size } = centreIn(els.cards[attacker].glove, els.box);
  const end = centreIn(els.cards[target].card, els.box);
  // The sprite's fist points upwards, so a punch turns it to face its direction of travel.
  const angle = Math.atan2(end.y - y, end.x - x) * (180 / Math.PI) + 90;
  const glove = sprite(`glove-${attacker}`, 'box-flying');
  glove.style.width = `${size}px`;
  glove.style.left = `${x}px`;
  glove.style.top = `${y}px`;
  els.box.appendChild(glove);
  const dx = end.x - x;
  const dy = end.y - y;
  await glove.animate([
    { transform: `translate(-50%, -50%) rotate(${angle}deg) scale(1)` },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${angle}deg) scale(1.7)` },
  ], { duration: FLY_MS, easing: 'cubic-bezier(.55,0,.9,.5)', fill: 'forwards' }).finished;
  return glove;
}

function retreat(glove) {
  glove.animate([{ opacity: 1 }, { opacity: 0 }], { duration: RETREAT_MS, fill: 'forwards' })
    .finished.then(() => glove.remove());
}

function damageBurst(card, amount) {
  const pop = document.createElement('div');
  pop.className = 'box-burst';
  pop.appendChild(sprite('burst', 'box-burst-art'));
  const value = document.createElement('span');
  value.textContent = amount;
  pop.appendChild(value);
  card.appendChild(pop);
  return pop;
}

function healHeart(card, amount) {
  const pop = document.createElement('div');
  pop.className = 'box-heart';
  pop.appendChild(sprite('heart', 'box-heart-art'));
  const value = document.createElement('span');
  value.textContent = `+${amount}`;
  pop.appendChild(value);
  card.appendChild(pop);
  return pop;
}

function headline(game) {
  if (game.phase === 'over') return 'Knockout!';
  if (game.phase === 'takeout') return 'Back to your corners';
  const player = game.players[game.current];
  return `${player.name}: heal on ${player.targets.join(', ')}. Hit anyone else’s numbers.`;
}

function buildCard(player, index) {
  const card = document.createElement('div');
  card.className = `box-card box-card-${index}`;
  const glove = sprite(`glove-${index}`, 'box-glove');
  const name = document.createElement('div');
  name.className = 'box-name';
  name.textContent = player.name;
  const lives = document.createElement('div');
  lives.className = 'box-lives';
  const bar = document.createElement('div');
  bar.className = 'box-bar';
  const fill = document.createElement('div');
  fill.className = 'box-bar-fill';
  bar.appendChild(fill);
  const targets = document.createElement('div');
  targets.className = 'box-targets';
  for (const number of player.targets) {
    const chip = document.createElement('div');
    chip.className = 'box-target';
    const digits = document.createElement('span');
    digits.textContent = number;
    chip.appendChild(digits);
    targets.appendChild(chip);
  }
  const stamp = document.createElement('div');
  stamp.className = 'box-ko';
  stamp.appendChild(sprite('burst', 'box-ko-art'));
  const label = document.createElement('span');
  label.textContent = 'KO';
  stamp.appendChild(label);
  stamp.hidden = true;
  card.append(glove, name, lives, bar, targets, stamp);
  return { card, glove, lives, fill, stamp };
}

export default {
  noEmptyTurn: true,

  init(stage) {
    stage.innerHTML = `
      <div class="box">
        <div class="box-ring" data-ring></div>
        <p class="box-headline" data-headline role="status"></p>
      </div>`;
    els = { stage, box: stage.querySelector('.box'), ring: stage.querySelector('[data-ring]'), headline: stage.querySelector('[data-headline]'), cards: [] };
    preloadArt();
  },

  start(game) {
    els.cards = game.players.map(buildCard);
    els.ring.replaceChildren(...els.cards.map(({ card }) => card));
    this.sync(game);
  },

  sync(game) {
    game.players.forEach((player, i) => {
      const { card, lives, fill, stamp } = els.cards[i];
      lives.textContent = player.lives;
      fill.style.width = `${(player.lives / player.maxLives) * 100}%`;
      fill.classList.toggle('box-bar-low', player.lives / player.maxLives <= 0.25);
      card.classList.toggle('box-current', i === game.current && game.phase !== 'over');
      card.classList.toggle('box-out', player.lives === 0);
      stamp.hidden = player.lives !== 0;
    });
    els.headline.textContent = headline(game);
  },

  async animate(game, isCurrent) {
    const { last } = game;
    if (!last.change) {
      this.sync(game);
      return;
    }
    const { card } = els.cards[last.owner];

    if (last.change > 0) {
      this.sync(game);
      card.classList.add('box-healed');
      const heart = healHeart(card, last.change);
      await wait(HEAL_MS);
      heart.remove();
      card.classList.remove('box-healed');
      return;
    }

    // The scores only change when the glove lands.
    const glove = reducedMotion() ? null : await throwPunch(last.player, last.owner);
    if (!isCurrent()) {
      glove?.remove();
      return;
    }
    this.sync(game);
    card.classList.add('box-punched');
    const burst = damageBurst(card, last.change);
    if (glove) retreat(glove);
    await wait(HIT_MS);
    burst.remove();
    card.classList.remove('box-punched');
  },

  describe(last) {
    if (last.knockedOut) return `${last.name}: knockout!`;
    if (last.result === 'hit') return `${last.name}: hit for ${-last.change}!`;
    if (last.result === 'heal') return `${last.name}: healed ${last.change}.`;
    if (last.result === 'full') return `${last.name}: already at full lives.`;
    if (last.result === 'out') return `${last.name}: they’re already out.`;
    return `${last.name}: nobody’s number.`;
  },

  pip(dart) {
    if (!dart.change) return dart.name;
    return `${dart.name} ${dart.change > 0 ? '+' : ''}${dart.change}`;
  },

  score: (player) => player.lives,
  swatch: (_player, index) => index,
  standings: (game) => game.players
    .map((p, i) => ({ ...p, won: i === game.winner }))
    .sort((a, b) => b.won - a.won || b.lives - a.lives)
    .map((p) => [p.name, p.lives]),

  buildManual(container, _rules, sendDart) {
    buildPad(
      container,
      sendDart,
      [['SingleOuter', 'Single'], ['Double', 'Double'], ['Triple', 'Triple']],
      [['Miss', 'Miss']],
    );
  },
};
