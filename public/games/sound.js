// Every sound is synthesised, so there are no files to load. iPad speakers lose most below 200Hz.
const MUTED_KEY = 'oche-arcade-muted';
const ATTACK = 0.005;
const QUIET = 0.001;
const GAP = 0.04;

const note = (wave, freq, at, length, gain, to = freq) => ({ wave, freq, to, at, length, gain });
const noise = (at, length, gain) => ({ wave: 'noise', at, length, gain });

export const SOUNDS = {
  hit: [note('triangle', 660, 0, 0.1, 0.7), note('triangle', 990, 0.08, 0.2, 0.7)],
  pop: [noise(0, 0.05, 0.25), note('sine', 950, 0, 0.13, 0.65, 260)],
  near: [note('triangle', 494, 0, 0.12, 0.6), note('triangle', 440, 0.12, 0.18, 0.6)],
  miss: [note('sawtooth', 290, 0, 0.3, 0.4, 150)],
  tick: [note('square', 1000, 0, 0.06, 0.45)],
  buzzer: [note('sawtooth', 220, 0, 0.7, 0.4), note('square', 226, 0, 0.7, 0.2)],
  takeout: [note('triangle', 784, 0, 0.3, 0.7), note('triangle', 587, 0.24, 0.42, 0.7)],
  win: [
    note('triangle', 523, 0, 0.14, 0.6),
    note('triangle', 659, 0.13, 0.14, 0.6),
    note('triangle', 784, 0.26, 0.14, 0.6),
    note('triangle', 1047, 0.39, 0.6, 0.7),
  ],
};

function noiseSource(context, length) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  source.buffer = buffer;
  return source;
}

function oscillator(context, { wave, freq, to, at, length }, start) {
  const source = context.createOscillator();
  source.type = wave;
  source.frequency.setValueAtTime(freq, start + at);
  if (to !== freq) source.frequency.exponentialRampToValueAtTime(to, start + at + length);
  return source;
}

// Schedules a sound on any audio context and returns when it finishes.
export function scheduleSound(context, name, start) {
  let end = start;
  for (const part of SOUNDS[name]) {
    const begins = start + part.at;
    const ends = begins + part.length;
    const source = part.wave === 'noise' ? noiseSource(context, part.length) : oscillator(context, part, start);
    const level = context.createGain();
    level.gain.setValueAtTime(QUIET, begins);
    level.gain.exponentialRampToValueAtTime(part.gain, begins + ATTACK);
    level.gain.exponentialRampToValueAtTime(QUIET, ends);
    source.connect(level);
    level.connect(context.destination);
    source.start(begins);
    source.stop(ends);
    end = Math.max(end, ends);
  }
  return end;
}

let context = null;
let muted = false;
let busyUntil = 0;
let onChange = () => {};

const isSupported = () => Boolean(globalThis.AudioContext);

// Browsers only allow sound after a tap, and an iPad can suspend it again in the background.
function unlock() {
  if (!isSupported()) return;
  if (!context) {
    context = new AudioContext();
    context.onstatechange = () => onChange();
  }
  if (context.state !== 'running') context.resume().catch(() => {});
}

export function initSound(changed) {
  onChange = changed;
  try {
    muted = localStorage.getItem(MUTED_KEY) === 'true';
  } catch {}
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(type, unlock);
}

// One of 'off', 'on' or 'locked', which means it's waiting for a tap. Null when sound isn't available.
export function soundState() {
  if (!isSupported()) return null;
  if (muted) return 'off';
  return context?.state === 'running' ? 'on' : 'locked';
}

export function toggleMuted() {
  muted = !muted;
  try {
    localStorage.setItem(MUTED_KEY, String(muted));
  } catch {}
  onChange();
}

// Sounds that land together play one after the other. Before a tap they're dropped, not saved up.
export function play(name) {
  if (soundState() !== 'on') return;
  const start = Math.max(context.currentTime, busyUntil + GAP);
  busyUntil = scheduleSound(context, name, start);
}
