// Turns successive `throws` arrays from the Board Manager into new darts and board clears.
export function createFeedTracker() {
  let seen = null;

  return function update(throws) {
    const previous = seen;
    seen = throws.length;
    // Darts already in the board when we start belong to nobody.
    if (previous === null) return { darts: [], cleared: false };
    // Fewer darts than before means the board was cleared, even if we missed it being empty.
    if (throws.length < previous) return { darts: throws, cleared: true };
    return { darts: throws.slice(previous), cleared: false };
  };
}
