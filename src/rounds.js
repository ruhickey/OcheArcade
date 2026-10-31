// Turn order for games played over a set number of rounds, with the top score winning.

export function isFinalTurn(game) {
  if (game.playoff) return game.playoff.position === game.playoff.queue.length - 1;
  return game.round === game.rounds && game.current === game.players.length - 1;
}

function leaders(players, score) {
  const best = Math.max(...players.map(score));
  return players.map((_, i) => i).filter((i) => score(players[i]) === best);
}

// With the scores level, the leaders each throw another turn until one is ahead.
function finishOrPlayoff(game, { score, winnerText, startTurn }) {
  const top = leaders(game.players, score);
  if (top.length > 1) {
    return startTurn({
      ...game,
      current: top[0],
      playoff: { queue: top, position: 0, round: (game.playoff?.round ?? 0) + 1 },
    });
  }
  return { ...game, darts: [], phase: 'over', winner: top[0], winnerText: winnerText(game.players[top[0]], game) };
}

// Moves on from the current turn. startTurn resets whatever the game keeps per turn.
export function advance(game, rules) {
  if (game.playoff) {
    const position = game.playoff.position + 1;
    if (position === game.playoff.queue.length) return finishOrPlayoff(game, rules);
    return rules.startTurn({ ...game, current: game.playoff.queue[position], playoff: { ...game.playoff, position } });
  }

  const lastPlayer = game.current === game.players.length - 1;
  if (lastPlayer && game.round === game.rounds) return finishOrPlayoff(game, rules);
  return rules.startTurn({
    ...game,
    current: lastPlayer ? 0 : game.current + 1,
    round: lastPlayer ? game.round + 1 : game.round,
  });
}
