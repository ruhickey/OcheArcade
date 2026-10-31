import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { userInfo } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'deploy', 'install.sh');
const skip = process.platform === 'win32' ? 'needs bash' : false;

// SUDO_USER is cleared so results don't depend on how the tests were started.
function run(...args) {
  const { SUDO_USER, ...env } = process.env;
  return spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', env });
}

test('the Linux service uses this folder, user and Node, with nothing hardcoded', { skip }, () => {
  const { status, stdout } = run('--dry-run', '--platform', 'linux');
  assert.equal(status, 0);
  assert.match(stdout, new RegExp(`^User=${userInfo().username}$`, 'm'));
  assert.ok(stdout.includes(`WorkingDirectory=${ROOT}\n`));
  assert.match(stdout, /^ExecStart=".*node" server\.js$/m);
  assert.match(stdout, /^Environment=PORT=8090$/m);
  assert.match(stdout, /^Environment=BOARD_URL=http:\/\/localhost:3180$/m);
});

test('the macOS service uses this folder and Node', { skip }, () => {
  const { status, stdout } = run('--dry-run', '--platform', 'macos');
  assert.equal(status, 0);
  assert.ok(stdout.includes(`<string>${ROOT}</string>`));
  assert.match(stdout, /<string>.*node<\/string>/);
  assert.match(stdout, /<key>BOARD_URL<\/key>\s*<string>http:\/\/localhost:3180<\/string>/);
});

test('the port and board address can be chosen', { skip }, () => {
  const { stdout } = run('--dry-run', '--platform', 'linux', '--port', '9000', '--board-url', 'http://10.0.0.5:3180');
  assert.match(stdout, /^Environment=PORT=9000$/m);
  assert.match(stdout, /^Environment=BOARD_URL=http:\/\/10\.0\.0\.5:3180$/m);
});

test('the service runs as the person who used sudo', { skip }, () => {
  const { stdout } = spawnSync('bash', [SCRIPT, '--dry-run', '--platform', 'linux'], {
    encoding: 'utf8',
    env: { ...process.env, SUDO_USER: 'someone' },
  });
  assert.match(stdout, /^User=someone$/m);
});

test('bad options are refused', { skip }, () => {
  for (const args of [['--port', 'abc'], ['--port', '70000'], ['--board-url', 'not a url'], ['--nonsense'], ['--port']]) {
    const { status, stderr } = run('--dry-run', '--platform', 'linux', ...args);
    assert.equal(status, 1, args.join(' '));
    assert.match(stderr, /^Error:/);
  }
});

test('a dry run refuses to uninstall, in either order', { skip }, () => {
  for (const args of [['--uninstall', '--dry-run'], ['--dry-run', '--uninstall']]) {
    const { status, stderr } = run(...args, '--platform', 'linux');
    assert.equal(status, 1, args.join(' '));
    assert.match(stderr, /can't be used with --uninstall/);
  }
});

test('unsupported systems get a clear message', { skip }, () => {
  const { status, stderr } = run('--dry-run', '--platform', 'plan9');
  assert.equal(status, 1);
  assert.match(stderr, /npm start/);
});
