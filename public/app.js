import snakes from './games/snakes.js';
import tug from './games/tug.js';
import golf from './games/golf.js';
import paintball from './games/paintball.js';
import balloons from './games/balloons.js';
import snooker from './games/snooker.js';
import boxing from './games/boxing.js';
import fourinarow from './games/fourinarow.js';
import heist from './games/heist.js';
import conquer from './games/conquer.js';
import circuit from './games/circuit.js';
import pool from './games/pool.js';
import { setServerTime } from './games/server-time.js';
import { initSound, play, soundState, toggleMuted } from './games/sound.js';
import { MATS, applyMatColours, markSvg } from './mats.js';
import { renderBullOff } from './bulloff.js';

const $ = (id) => document.getElementById(id);
const MODULES = { snakes, tug, golf, paintball, balloons, snooker, boxing, fourinarow, heist, conquer, circuit, pool };
const MAX_PLAYERS = 4;
const NAMES_KEY = 'oche-arcade-names';
// Keeps players saved before the app was renamed.
const OLD_NAMES_KEY = 'pub-arcade-names';
const SOUND_TEXT = { on: 'Sound on', off: 'Sound off', locked: 'Tap for sound' };
const PHASE_SOUND = { takeout: 'takeout', over: 'win' };

let state = null;
let soundPhase = null;
let lockedAtPress = false;
let activeModule = null;
let roster = loadNames();
let view = roster ? 'menu' : 'players'; // players | menu | setup
let chosenGame = null;
let chosenOptions = {};
let renderedSeq = null;
let renderedKey = '';
let animating = Promise.resolve();
let generation = 0;
let boardBusy = false;
let boardError = '';

function post(path, body = {}) {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const sendDart = (dart) => post('/api/dart', dart);

// Abandons any moves still queued from the previous game.
function resetAnimations() {
  generation += 1;
  animating = Promise.resolve();
}

/* Rendering */

// Lets a game with its own clock stop drawing, and sounding, once it's off the screen.
function leaveGame() {
  activeModule?.stop?.();
  activeModule = null;
}

// Only games that have had their sounds chosen show the button.
function renderSound() {
  const button = $('sound');
  const sound = soundState();
  button.hidden = !sound || !MODULES[state?.game?.type]?.dartSound;
  button.textContent = SOUND_TEXT[sound] ?? '';
  button.setAttribute('aria-pressed', sound === 'on');
}

function moveMessage(game, module) {
  const { last, phase, players, current } = game;
  const summary = last ? module.describe(last) : '';
  if (phase === 'takeout') return `${summary} Take your darts out, ${players[current].name}.`.trim();
  return summary || 'Throw when you’re ready.';
}

function renderPanel(game, canUndo) {
  const module = MODULES[game.type];
  $('turn-name').textContent = game.players[game.current].name;
  $('message').textContent = moveMessage(game, module);

  $('dart-pips').replaceChildren(...Array.from({ length: state.dartsPerTurn }, (_, i) => {
    const pip = document.createElement('div');
    const dart = game.darts[i];
    pip.className = dart ? 'pip done' : 'pip';
    pip.textContent = dart ? module.pip(dart) : `Dart ${i + 1}`;
    return pip;
  }));

  $('scores').replaceChildren(...game.players.map((p, i) => {
    const row = document.createElement('li');
    row.className = i === game.current ? 'score current' : 'score';
    const swatch = document.createElement('span');
    swatch.className = `swatch swatch-${module.swatch(p, i)}`;
    const name = document.createElement('span');
    name.className = 'score-name';
    name.textContent = p.name;
    const score = document.createElement('span');
    score.className = 'score-pos';
    score.textContent = module.score(p);
    row.append(swatch, name, score);
    return row;
  }));

  $('bed-buttons').querySelectorAll('button').forEach((button) => {
    button.disabled = game.phase !== 'throwing';
  });
  $('undo').disabled = !canUndo;
  const canPassEmpty = game.players.length > 1 && !module.noEmptyTurn;
  $('next').disabled = game.phase === 'over' || (game.darts.length === 0 && !canPassEmpty);

  $('winner').hidden = game.phase !== 'over';
  if (game.phase === 'over') $('winner-name').textContent = game.winnerText;
  $('winner-undo').hidden = !canUndo;
  // Games that end on scores list them, because the banner covers the screen.
  const standings = game.phase === 'over' && module.standings ? module.standings(game) : [];
  $('winner-standings').hidden = standings.length === 0;
  $('winner-standings').replaceChildren(...standings.map(([name, score]) => {
    const item = document.createElement('li');
    const value = document.createElement('b');
    value.textContent = score;
    item.append(name, value);
    return item;
  }));
}

const STATUS_TEXT = {
  throw: 'Ready to throw',
  stopped: 'Stopped: darts won’t register',
  starting: 'Starting…',
  stopping: 'Stopping…',
  takeout: 'Pull your darts out',
  takeoutInProgress: 'Takeout in progress',
  calibrating: 'Calibrating…',
};

function boardText(board) {
  if (board.error) return board.error;
  if (!board.connected) return 'Board Manager not connected to cameras';
  const text = STATUS_TEXT[board.status] ?? `Board: ${board.status}`;
  if (!board.running || board.dartsOnBoard === 0) return text;
  return `${text} (${board.dartsOnBoard} on the board)`;
}

// Every screen shows the board's status and can control it, using this same line.
function renderFeed(board) {
  const usable = !board.error && board.connected;
  const ready = usable && board.running && board.status === 'throw';
  for (const line of document.querySelectorAll('.feed-line')) {
    line.classList.toggle('on', ready);
    line.classList.toggle('busy', usable && board.running && !ready);
    line.querySelector('.feed-text').textContent = boardError || boardText(board);
    const toggle = line.querySelector('[data-board-toggle]');
    toggle.textContent = board.running ? 'Stop' : 'Start';
    toggle.dataset.boardCommand = board.running ? 'stop' : 'start';
    toggle.classList.toggle('btn-primary', usable && !board.running);
    toggle.disabled = !usable || boardBusy;
    line.querySelector('[data-board-reset]').disabled = !usable || boardBusy;
  }
}

function addBoardControls() {
  for (const line of document.querySelectorAll('.feed-line')) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn board-btn';
    toggle.dataset.boardToggle = '';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn board-btn';
    reset.textContent = 'Reset';
    reset.dataset.boardReset = '';
    reset.dataset.boardCommand = 'reset';
    line.append(toggle, reset);
  }
}

document.addEventListener('click', async (event) => {
  const command = event.target.closest?.('[data-board-command]')?.dataset.boardCommand;
  if (!command) return;
  boardBusy = true;
  boardError = '';
  if (state) renderFeed(state.board);
  try {
    const response = await post(`/api/board/${command}`);
    if (!response.ok) boardError = (await response.json()).error;
  } catch {
    boardError = 'Lost connection to the game server';
  }
  boardBusy = false;
  if (state) renderFeed(state.board);
});

function renderMenu() {
  const names = roster ?? [];
  $('roster').replaceChildren(...names.map((name, i) => {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = `swatch swatch-${i}`;
    item.append(swatch, name);
    return item;
  }));

  $('game-list').replaceChildren(...Object.values(state.games).map((definition) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'game-card';
    card.disabled = names.length < definition.minPlayers;
    applyMatColours(card, definition.id);
    const mark = document.createElement('span');
    mark.className = 'game-card-mark';
    mark.innerHTML = markSvg(definition.id);
    const text = document.createElement('span');
    text.className = 'game-card-text';
    const title = document.createElement('span');
    title.className = 'game-card-name';
    title.textContent = definition.name;
    const blurb = document.createElement('span');
    blurb.className = 'game-card-blurb';
    blurb.textContent = card.disabled ? `Needs at least ${definition.minPlayers} players` : MATS[definition.id].line;
    text.append(title, blurb);
    card.append(mark, text);
    card.addEventListener('click', () => {
      chosenGame = definition.id;
      chosenOptions = Object.fromEntries(definition.options.map(({ id, choices, default: fallback = choices[0] }) => [id, fallback]));
      view = 'setup';
      render();
    });
    return card;
  }));
}

function renderSetup() {
  const definition = state.games[chosenGame];
  $('setup-name').textContent = definition.name;
  applyMatColours($('setup-mat'), definition.id);
  $('setup-mat').innerHTML = markSvg(definition.id);
  $('setup-blurb').textContent = definition.blurb;

  $('setup-options').replaceChildren(...definition.options.map(({ id, label, choices, notes }) => {
    const group = document.createElement('div');
    group.className = 'setup-options';
    const heading = document.createElement('p');
    heading.className = 'eyebrow';
    heading.textContent = label;
    const row = document.createElement('div');
    row.className = 'choice-row';
    for (const choice of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      const on = chosenOptions[id] === choice;
      button.className = on ? 'btn on' : 'btn';
      button.setAttribute('aria-pressed', on);
      button.textContent = choice;
      button.addEventListener('click', () => {
        chosenOptions[id] = choice;
        renderSetup();
      });
      row.appendChild(button);
    }
    group.append(heading, row);
    if (notes) {
      const note = document.createElement('p');
      note.className = 'choice-note';
      note.textContent = notes[chosenOptions[id]];
      group.appendChild(note);
    }
    return group;
  }));

  $('setup-roster').replaceChildren(...roster.map((name, i) => {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = `swatch swatch-${i}`;
    item.append(swatch, name);
    return item;
  }));

  // There is nothing to decide with one player.
  const solo = roster.length === 1;
  $('start-bull').hidden = solo;
  $('start-order').textContent = solo ? 'Start game' : 'Use player order';
  $('start-order').classList.toggle('btn-primary', solo);
}

function render() {
  const { game, setup, games, board, canUndo } = state;
  renderFeed(board);
  renderSound();
  // The game can end while the question is up, from a dart or from another screen.
  if (!game || game.phase === 'over') $('quit-dialog').close();

  $('players').hidden = Boolean(game || setup) || view !== 'players';
  $('menu').hidden = Boolean(game || setup) || view !== 'menu';
  $('setup').hidden = Boolean(game || setup) || view !== 'setup';
  $('bull').hidden = !setup;
  $('game').hidden = !game;
  if (setup) renderBullOff(setup, canUndo, sendDart);
  if (!game) {
    $('winner').hidden = true;
    resetAnimations();
    leaveGame();
    renderedSeq = null;
    renderedKey = '';
    if (view === 'menu') renderMenu();
    if (view === 'setup' && roster && chosenGame) renderSetup();
    return;
  }

  const module = MODULES[game.type];
  const key = JSON.stringify([game.type, game.players.map((p) => p.name)]);
  const isNewGame = key !== renderedKey || game.seq < (renderedSeq ?? 0) && game.seq === 0;

  if (isNewGame || renderedSeq === null) {
    resetAnimations();
    leaveGame();
    activeModule = module;
    const { rules } = games[game.type];
    $('game').dataset.type = game.type;
    const manual = $('bed-buttons');
    manual.className = 'bed-buttons';
    $('manual').hidden = true;
    manual.replaceChildren();
    module.init($('stage'), rules);
    module.buildManual(manual, rules, sendDart);
    module.start(game);
    renderedKey = key;
    renderedSeq = game.seq;
    soundPhase = game.phase;
    renderPanel(game, canUndo);
    return;
  }

  const moved = game.seq === renderedSeq + 1 && game.last;
  // An undo goes back a step, and shouldn't announce the phase it lands on.
  const phaseSound = module.dartSound && game.seq >= renderedSeq && game.phase !== soundPhase ? PHASE_SOUND[game.phase] : null;
  renderedSeq = game.seq;
  soundPhase = game.phase;

  // Queued updates draw the state they arrived with, so the panel never gets ahead of the tokens.
  const gen = generation;
  const isCurrent = () => gen === generation;
  animating = animating
    .then(() => {
      if (!moved || !isCurrent()) return undefined;
      if (module.dartSound) play(module.dartSound(game.last));
      return module.animate(game, isCurrent);
    })
    .then(() => {
      if (!isCurrent()) return;
      if (phaseSound) play(phaseSound);
      module.sync(game);
      renderPanel(game, canUndo);
    });
}

/* Players */

function resolveNames(names) {
  return names.map((name, i) => name || `Player ${i + 1}`);
}

function loadNames() {
  try {
    const names = JSON.parse(localStorage.getItem(NAMES_KEY) ?? localStorage.getItem(OLD_NAMES_KEY));
    if (Array.isArray(names) && names.length) return resolveNames(names.slice(0, MAX_PLAYERS));
  } catch {}
  return null;
}

function saveNames(names) {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(names));
  } catch {}
}

function addNameField(value = '') {
  const fields = $('name-fields');
  const index = fields.childElementCount;
  const row = document.createElement('div');
  row.className = 'name-field';
  const swatch = document.createElement('span');
  swatch.className = `swatch swatch-${index}`;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.placeholder = `Player ${index + 1}`;
  input.maxLength = 16;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', `Player ${index + 1} name`);
  row.append(swatch, input);
  fields.appendChild(row);
  updateFieldButtons();
}

function updateFieldButtons() {
  const count = $('name-fields').childElementCount;
  $('add-player').disabled = count >= MAX_PLAYERS;
  $('remove-player').disabled = count <= 1;
}

(roster ?? ['', '']).forEach(addNameField);
$('add-player').addEventListener('click', () => addNameField());
$('remove-player').addEventListener('click', () => {
  $('name-fields').lastElementChild.remove();
  updateFieldButtons();
});
$('players-form').addEventListener('submit', (event) => {
  event.preventDefault();
  roster = resolveNames([...$('name-fields').querySelectorAll('input')].map((input) => input.value.trim()));
  saveNames(roster);
  chosenGame = null;
  view = 'menu';
  render();
});
$('change-players').addEventListener('click', () => {
  view = 'players';
  render();
});

/* Controls */

$('hand-open').addEventListener('click', () => { $('manual').hidden = false; });
$('hand-close').addEventListener('click', () => { $('manual').hidden = true; });
$('next').addEventListener('click', () => post('/api/next'));
$('undo').addEventListener('click', () => post('/api/undo'));
// The press that unlocks sound shouldn't also mute it.
for (const type of ['pointerdown', 'keydown']) {
  $('sound').addEventListener(type, () => { lockedAtPress = soundState() === 'locked'; });
}
$('sound').addEventListener('click', () => {
  if (!lockedAtPress) toggleMuted();
});
$('quit').addEventListener('click', () => $('quit-dialog').showModal());
$('quit-cancel').addEventListener('click', () => $('quit-dialog').close());
$('quit-confirm').addEventListener('click', () => {
  $('quit-dialog').close();
  view = 'menu';
  post('/api/quit');
});
// The card fills the dialog, so a click that lands on the dialog itself is on its backdrop.
$('quit-dialog').addEventListener('click', (event) => {
  if (event.target === $('quit-dialog')) $('quit-dialog').close();
});
$('rematch').addEventListener('click', () => {
  post('/api/new', { type: state.game.type, names: state.game.players.map((p) => p.name), options: state.game.options });
});
$('winner-undo').addEventListener('click', () => post('/api/undo'));
$('winner-quit').addEventListener('click', () => {
  view = 'menu';
  post('/api/quit');
});

$('setup-back').addEventListener('click', () => {
  view = 'menu';
  render();
});
$('start-bull').addEventListener('click', () => {
  post('/api/bull', { type: chosenGame, names: roster, options: chosenOptions });
});
$('start-order').addEventListener('click', () => {
  post('/api/new', { type: chosenGame, names: roster, options: chosenOptions });
});

$('bull-start').addEventListener('click', () => post('/api/bull/start'));
$('bull-next').addEventListener('click', () => post('/api/next'));
$('bull-undo').addEventListener('click', () => post('/api/undo'));
$('bull-cancel').addEventListener('click', () => post('/api/quit'));

addBoardControls();
initSound(renderSound);

const events = new EventSource('/events');
events.onmessage = (event) => {
  state = JSON.parse(event.data);
  setServerTime(state.serverNow);
  render();
};
events.onerror = () => {
  renderFeed({ connected: false, running: false, error: 'Lost connection to the game server' });
};
