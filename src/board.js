// Talking to the Autodarts Board Manager.

export const BOARD_COMMANDS = {
  start: { method: 'PUT', path: '/api/start' },
  stop: { method: 'PUT', path: '/api/stop' },
  reset: { method: 'POST', path: '/api/reset' },
};

// The parts of the Board Manager's state that the app shows.
export function boardFromState(state) {
  return {
    connected: state.connected !== false,
    running: Boolean(state.running),
    status: typeof state.status === 'string' ? state.status : 'unknown',
    dartsOnBoard: Array.isArray(state.throws) ? state.throws.length : 0,
    error: null,
  };
}

export function unreachableBoard(error) {
  return { connected: false, running: false, status: 'unknown', dartsOnBoard: 0, error };
}

export function sameBoard(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function sendBoardCommand(boardUrl, name) {
  const command = BOARD_COMMANDS[name];
  const response = await fetch(`${boardUrl}${command.path}`, { method: command.method, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Board Manager returned ${response.status}`);
}
