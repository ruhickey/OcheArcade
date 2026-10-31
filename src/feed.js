// Turns successive `throws` arrays from the Board Manager into new darts and board clears.
export function createFeedTracker() {
  let seen = null;

  return function update(throws) {
    const previous = seen;
    seen = throws.length;
    // Darts already in the board when we start belong to nobody.
    if (previous === null) return { darts: [], cleared: false };
    if (throws.length === 0) return { darts: [], cleared: previous > 0 };
    return { darts: throws.slice(previous), cleared: false };
  };
}
