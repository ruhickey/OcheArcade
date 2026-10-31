// Turn handling shared by every game.
export const DARTS_PER_TURN = 3;

export function nextPlayer(game) {
  if (game.phase === 'over') return game;
  // Games can set turnOrder when turns shouldn't simply rotate through the players.
  const order = game.turnOrder ?? game.players.map((_, i) => i);
  const step = ((game.turnStep ?? 0) + 1) % order.length;
  return {
    ...game,
    current: order[step],
    turnStep: step,
    darts: [],
    phase: 'throwing',
    last: null,
  };
}

// Pulling the darts out ends the turn, unless the turn has already been moved on by hand.
export function boardCleared(game, next = nextPlayer) {
  if (game.phase === 'over' || game.darts.length === 0) return game;
  return next(game);
}
