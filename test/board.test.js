import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_COMMANDS, boardFromState, sameBoard, sendBoardCommand, unreachableBoard } from '../src/board.js';

test('the board state is read from the feed', () => {
  const board = boardFromState({ connected: true, running: true, status: 'throw', event: 'started', throws: [{}, {}] });
  assert.deepEqual(board, { connected: true, running: true, status: 'throw', dartsOnBoard: 2, error: null });
});

test('a stopped board with no darts reads as such', () => {
  const board = boardFromState({ connected: true, event: 'stopped', running: false, status: 'stopped', throws: [] });
  assert.equal(board.running, false);
  assert.equal(board.status, 'stopped');
  assert.equal(board.dartsOnBoard, 0);
});

test('missing fields are handled', () => {
  assert.deepEqual(boardFromState({}), { connected: true, running: false, status: 'unknown', dartsOnBoard: 0, error: null });
});

test('an unreachable board carries the error', () => {
  const board = unreachableBoard('Cannot reach Board Manager');
  assert.equal(board.connected, false);
  assert.equal(board.error, 'Cannot reach Board Manager');
});

test('only real changes count', () => {
  const board = boardFromState({ status: 'throw', running: true, throws: [] });
  assert.equal(sameBoard(board, boardFromState({ status: 'throw', running: true, throws: [], event: 'other' })), true);
  assert.equal(sameBoard(board, boardFromState({ status: 'throw', running: true, throws: [{}] })), false);
});

test('commands use the verbs the Board Manager expects', async (t) => {
  assert.deepEqual(BOARD_COMMANDS.start, { method: 'PUT', path: '/api/start' });
  assert.deepEqual(BOARD_COMMANDS.stop, { method: 'PUT', path: '/api/stop' });
  assert.deepEqual(BOARD_COMMANDS.reset, { method: 'POST', path: '/api/reset' });

  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options.method]);
    return { ok: true };
  });
  await sendBoardCommand('http://board', 'reset');
  assert.deepEqual(calls, [['http://board/api/reset', 'POST']]);
});

test('a failed command reports the error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 500 }));
  await assert.rejects(sendBoardCommand('http://board', 'start'), /returned 500/);
});
