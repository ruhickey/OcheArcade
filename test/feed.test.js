import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedTracker } from '../src/feed.js';

const darts = (...names) => names.map((name) => ({ name }));

function tracker(...throws) {
  const update = createFeedTracker();
  update(darts());
  for (const list of throws) update(list);
  return update;
}

test('darts already in the board when we start belong to nobody', () => {
  const update = createFeedTracker();
  assert.deepEqual(update(darts('a', 'b')), { darts: [], cleared: false });
  assert.deepEqual(update(darts('a', 'b', 'c')), { darts: darts('c'), cleared: false });
});

test('new darts are reported once each', () => {
  const update = tracker(darts('a'));
  assert.deepEqual(update(darts('a', 'b')), { darts: darts('b'), cleared: false });
  assert.deepEqual(update(darts('a', 'b')), { darts: [], cleared: false });
});

test('an empty board after darts is a clear, but only the first time', () => {
  const update = tracker(darts('a', 'b', 'c'));
  assert.deepEqual(update([]), { darts: [], cleared: true });
  assert.deepEqual(update([]), { darts: [], cleared: false });
});

test('fewer darts than before is a clear we missed, and those darts are new', () => {
  const update = tracker(darts('a', 'b', 'c'));
  assert.deepEqual(update(darts('x')), { darts: darts('x'), cleared: true });
  assert.deepEqual(update(darts('x', 'y')), { darts: darts('y'), cleared: false });
});
