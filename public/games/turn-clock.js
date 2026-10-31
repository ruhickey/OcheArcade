// The turn clock, shared by the server (enforcing it) and the iPad (showing it) so they always agree.

export const PREP_MS = 5000;
export const TURN_MS = 20000;
// A dart detected just after the buzzer may have been thrown before it.
export const LATE_GRACE_MS = 1000;

// How far through the turn the clock is. It holds still during the get-ready countdown and takeout.
export function elapsedMs(clock, at) {
  if (clock.frozen) return clock.heldMs;
  if (at < clock.prepUntil) return clock.heldMs;
  return Math.max(at - clock.startsAt, clock.heldMs);
}

export function freshClock(now, heldMs = 0) {
  const prepUntil = now + PREP_MS;
  return { startsAt: prepUntil - heldMs, prepUntil, heldMs, frozen: false };
}

// Throwing during the countdown starts the clock straight away.
export function startedClock(clock, now) {
  return now < clock.prepUntil ? { ...clock, startsAt: now - clock.heldMs, prepUntil: now } : clock;
}

export function isExpired(clock, now) {
  return elapsedMs(clock, now) >= TURN_MS + LATE_GRACE_MS;
}
