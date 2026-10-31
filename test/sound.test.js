import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUNDS, initSound, play, soundState, toggleMuted } from '../public/games/sound.js';

const started = [];
const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => ({ connect() {}, start(at) { started.push(at); }, stop() {}, frequency: param(), gain: param() });

class FakeContext {
  state = 'suspended';
  currentTime = 10;
  sampleRate = 8000;
  destination = {};
  createOscillator = node;
  createGain = node;
  createBufferSource = node;
  createBuffer = (_channels, length) => ({ getChannelData: () => new Float32Array(length) });
  resume() {
    this.state = 'running';
    this.onstatechange?.();
    return Promise.resolve();
  }
}

test('sound is silent until a tap, then plays in turn, and muting silences and remembers it', () => {
  assert.equal(soundState(), null);

  const stored = new Map();
  const listeners = new Map();
  globalThis.AudioContext = FakeContext;
  globalThis.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  globalThis.addEventListener = (type, listener) => listeners.set(type, listener);
  let changes = 0;
  initSound(() => { changes += 1; });

  assert.equal(soundState(), 'locked');
  play('hit');
  assert.equal(started.length, 0);

  listeners.get('touchend')();
  assert.equal(soundState(), 'on');
  assert.ok(changes > 0);

  play('miss');
  assert.deepEqual(started, [10]);
  play('tick');
  assert.equal(started.length, 2);
  assert.ok(started[1] >= 10 + SOUNDS.miss[0].length, 'the second sound should wait for the first');

  toggleMuted();
  assert.equal(soundState(), 'off');
  assert.equal([...stored.values()][0], 'true');
  play('hit');
  assert.equal(started.length, 2);

  toggleMuted();
  assert.equal(soundState(), 'on');
});
