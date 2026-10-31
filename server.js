import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createFeedTracker } from './src/feed.js';
import { bedById, dartFromThrow, makeDart } from './src/segments.js';
import { GAMES } from './src/games.js';
import { BOARD_COMMANDS, boardFromState, sameBoard, sendBoardCommand, unreachableBoard } from './src/board.js';
import { advance, newBullOff, rankedNames, throwDart as throwBullDart } from './src/bulloff.js';
import { DARTS_PER_TURN, boardCleared, nextPlayer } from './src/turns.js';

const PORT = Number(process.env.PORT ?? 8090);
const BOARD_URL = (process.env.BOARD_URL ?? 'http://localhost:3180').replace(/\/$/, '');
const POLL_MS = 300;
// Roughly how long a dart takes to reach us through the cameras and the feed. Timed games allow for it.
const FEED_DELAY_MS = Number(process.env.FEED_DELAY_MS ?? 700);
const TICK_MS = 200;
const MAX_PLAYERS = 4;
const MAX_NAME_LENGTH = 16;

const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/mats.js': ['mats.js', 'text/javascript; charset=utf-8'],
  '/games/art.js': ['games/art.js', 'text/javascript; charset=utf-8'],
  '/games/sound.js': ['games/sound.js', 'text/javascript; charset=utf-8'],
  '/fonts/bowlby-one-400.woff2': ['fonts/bowlby-one-400.woff2', 'font/woff2'],
  '/fonts/barlow-semi-condensed-500.woff2': ['fonts/barlow-semi-condensed-500.woff2', 'font/woff2'],
  '/fonts/barlow-semi-condensed-600.woff2': ['fonts/barlow-semi-condensed-600.woff2', 'font/woff2'],
  '/fonts/barlow-semi-condensed-700.woff2': ['fonts/barlow-semi-condensed-700.woff2', 'font/woff2'],
  '/bulloff.js': ['bulloff.js', 'text/javascript; charset=utf-8'],
  '/games/snakes.js': ['games/snakes.js', 'text/javascript; charset=utf-8'],
  '/games/tug.js': ['games/tug.js', 'text/javascript; charset=utf-8'],
  '/games/golf.js': ['games/golf.js', 'text/javascript; charset=utf-8'],
  '/games/paintball.js': ['games/paintball.js', 'text/javascript; charset=utf-8'],
  '/games/pad.js': ['games/pad.js', 'text/javascript; charset=utf-8'],
  '/games/balloons.js': ['games/balloons.js', 'text/javascript; charset=utf-8'],
  '/games/turn-clock.js': ['games/turn-clock.js', 'text/javascript; charset=utf-8'],
  '/games/server-time.js': ['games/server-time.js', 'text/javascript; charset=utf-8'],
  '/games/circuit.js': ['games/circuit.js', 'text/javascript; charset=utf-8'],
  '/games/pool.js': ['games/pool.js', 'text/javascript; charset=utf-8'],
  '/games/circuit-rules.js': ['games/circuit-rules.js', 'text/javascript; charset=utf-8'],
  '/games/dartboard.js': ['games/dartboard.js', 'text/javascript; charset=utf-8'],
  '/games/snooker.js': ['games/snooker.js', 'text/javascript; charset=utf-8'],
  '/games/boxing.js': ['games/boxing.js', 'text/javascript; charset=utf-8'],
  '/games/fourinarow.js': ['games/fourinarow.js', 'text/javascript; charset=utf-8'],
  '/games/heist.js': ['games/heist.js', 'text/javascript; charset=utf-8'],
  '/games/conquer.js': ['games/conquer.js', 'text/javascript; charset=utf-8'],
  '/games/conquer-rules.js': ['games/conquer-rules.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/manifest.json': ['manifest.json', 'application/manifest+json'],
};

let game = null;
let setup = null; // a throw for the bull in progress: { type, options, bullOff }
let history = [];
let board = unreachableBoard('Waiting for Board Manager');
const clients = new Set();

// Seats the ranked players the way their game wants them.
function arrangedNames() {
  const definition = GAMES[setup.type];
  const ranked = rankedNames(setup.bullOff);
  return definition.arrange ? definition.arrange(ranked) : ranked;
}

function setupView() {
  if (!setup) return null;
  const done = setup.bullOff.phase === 'done';
  const preview = done ? GAMES[setup.type].newGame(arrangedNames(), setup.options).players : null;
  return { ...setup, preview };
}

function startGame(definition, names, options) {
  game = { ...definition.newGame(names, options), options };
  setup = null;
  history = [];
}

function snapshot() {
  return JSON.stringify({ game, setup: setupView(), board, canUndo: history.length > 0, games: GAMES, dartsPerTurn: DARTS_PER_TURN, serverNow: Date.now() });
}

function broadcast() {
  const message = `data: ${snapshot()}\n\n`;
  for (const client of clients) client.write(message);
}

function applyDart(dart) {
  if (setup) {
    if (setup.bullOff.phase !== 'throwing') return;
    history.push(setup.bullOff);
    setup = { ...setup, bullOff: throwBullDart(setup.bullOff, dart) };
    return;
  }
  if (!game || game.phase !== 'throwing') return;
  history.push(game);
  game = GAMES[game.type].throwDart(game, dart);
}

// Games can replace the normal move to the next player.
const nextFor = (current) => GAMES[current.type].nextPlayer ?? nextPlayer;

function applyClear() {
  if (setup) setup = { ...setup, bullOff: advance(setup.bullOff) };
  else game = boardCleared(game, nextFor(game));
}

const trackFeed = createFeedTracker();

async function pollBoard() {
  let changed = false;
  try {
    const response = await fetch(`${BOARD_URL}/api/state`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error(`Board Manager returned ${response.status}`);
    const state = await response.json();
    const { darts, cleared } = trackFeed(Array.isArray(state.throws) ? state.throws : []);

    const latest = boardFromState(state);
    if (!sameBoard(latest, board)) {
      board = latest;
      changed = true;
    }
    if (game || setup) {
      for (const dart of darts) {
        applyDart({ ...dartFromThrow(dart), at: Date.now() - FEED_DELAY_MS });
        changed = true;
      }
      if (cleared) {
        applyClear();
        changed = true;
      }
    }
  } catch (error) {
    if (!board.error) {
      console.error(`Board feed error: ${error.message}`);
      board = unreachableBoard('Cannot reach Board Manager');
      changed = true;
    }
  }
  if (changed) broadcast();
  setTimeout(pollBoard, POLL_MS);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function cleanOptions(definition, options) {
  const cleaned = {};
  for (const { id, choices, default: fallback = choices[0] } of definition.options) {
    cleaned[id] = choices.includes(options?.[id]) ? options[id] : fallback;
  }
  return cleaned;
}

// Returns the checked game definition and players, or an error message.
function checkNewGame(type, names) {
  const definition = Object.hasOwn(GAMES, type) ? GAMES[type] : null;
  if (!definition) return { error: 'Unknown game' };
  const cleaned = cleanNames(names);
  if (!cleaned || cleaned.length < definition.minPlayers) {
    return { error: `${definition.name} needs ${definition.minPlayers} to ${MAX_PLAYERS} players` };
  }
  return { definition, names: cleaned };
}

function cleanNames(names) {
  if (!Array.isArray(names) || names.length < 1 || names.length > MAX_PLAYERS) return null;
  return names.map((name, i) => String(name ?? '').trim().slice(0, MAX_NAME_LENGTH) || `Player ${i + 1}`);
}

const ACTIONS = {
  '/api/new': ({ type, names, options }) => {
    const { error, definition, names: cleaned } = checkNewGame(type, names);
    if (error) return error;
    startGame(definition, cleaned, cleanOptions(definition, options));
  },
  '/api/bull': ({ type, names, options }) => {
    const { error, definition, names: cleaned } = checkNewGame(type, names);
    if (error) return error;
    game = null;
    setup = { type, options: cleanOptions(definition, options), bullOff: newBullOff(cleaned) };
    history = [];
  },
  '/api/bull/start': () => {
    if (!setup || setup.bullOff.phase !== 'done') return 'Throw for the bull is not finished';
    startGame(GAMES[setup.type], arrangedNames(), setup.options);
  },
  '/api/dart': ({ bed, number = 0, x, y }) => {
    if (!bedById(bed)) return 'Unknown bed';
    if (!Number.isInteger(number) || number < 0 || number > 20) return 'Unknown number';
    const position = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : {};
    applyDart({ ...makeDart(bed, number), ...position, at: Date.now() });
  },
  '/api/nominate': ({ colour }) => {
    const nominate = game && GAMES[game.type].nominate;
    if (!nominate) return 'Nothing to nominate';
    const updated = nominate(game, colour);
    if (updated !== game) {
      history.push(game);
      game = updated;
    }
  },
  '/api/next': () => {
    if (setup) setup = { ...setup, bullOff: advance(setup.bullOff) };
    else if (game) game = nextFor(game)(game);
  },
  '/api/undo': () => {
    if (!history.length) return;
    if (setup) {
      setup = { ...setup, bullOff: history.pop() };
    } else {
      game = history.pop();
      game = GAMES[game.type].resume?.(game) ?? game;
    }
  },
  '/api/quit': () => {
    game = null;
    setup = null;
    history = [];
  },
};

function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  const boardCommand = pathname.match(/^\/api\/board\/(\w+)$/)?.[1];
  if (req.method === 'POST' && boardCommand && Object.hasOwn(BOARD_COMMANDS, boardCommand)) {
    try {
      await sendBoardCommand(BOARD_URL, boardCommand);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      console.error(`Board command ${boardCommand} failed: ${error.message}`);
      return sendJson(res, 502, { error: 'The Board Manager didn’t respond' });
    }
  }

  if (req.method === 'POST' && ACTIONS[pathname]) {
    try {
      const error = ACTIONS[pathname](await readJson(req));
      if (error) return sendJson(res, 400, { error });
      broadcast();
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === 'GET' && pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    res.write(`data: ${snapshot()}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'GET' && /^\/art\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/.test(pathname)) {
    try {
      const image = await readFile(join(PUBLIC_DIR, pathname));
      res.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'no-cache' });
      return res.end(image);
    } catch {
      return res.writeHead(404).end('Not found');
    }
  }

  if (req.method === 'GET' && STATIC_FILES[pathname]) {
    const [file, type] = STATIC_FILES[pathname];
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    return res.end(await readFile(join(PUBLIC_DIR, file)));
  }

  res.writeHead(404).end('Not found');
});

// Games with a clock end turns by themselves.
setInterval(() => {
  const tick = game && GAMES[game.type].tick;
  if (!tick) return;
  const updated = tick(game);
  if (updated !== game) {
    game = updated;
    broadcast();
  }
}, TICK_MS);

// Stops proxies and Safari dropping an idle event stream.
setInterval(() => {
  for (const client of clients) client.write(': keep-alive\n\n');
}, 20_000);

server.listen(PORT, () => {
  console.log(`Oche Arcade on port ${PORT}, reading board from ${BOARD_URL}`);
  pollBoard();
});
