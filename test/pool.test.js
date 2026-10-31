import test from 'node:test';
import assert from 'node:assert/strict';
import { dartFromThrow, makeDart } from '../src/segments.js';
import { BALLS, endTurn, newGame, throwDart } from '../src/pool.js';
import { boardCleared } from '../src/turns.js';

const miss = makeDart('Miss');
const single = (n) => makeDart('SingleOuter', n);
const bull = makeDart('OuterBull');
const LEFT = [1, 2, 3, 4, 5, 6, 7];
const RIGHT = [8, 9, 10, 11, 12, 13, 14];

function rack(numbers, potted = 0, thrown = 0, tough = []) {
  return { balls: numbers.map((number) => ({ number, tough: tough.includes(number) })), potted, thrown, finished: false };
}

function table(left = rack(LEFT), right = rack(RIGHT), names = ['A', 'B']) {
  return { ...newGame(names), sides: { left, right } };
}

const atEight = (thrown = 7) => rack(LEFT, BALLS, thrown);

test('each side gets 7 unique numbers, with none shared', () => {
  for (let run = 0; run < 200; run++) {
    const { sides } = newGame(['A', 'B']);
    const all = [...sides.left.balls, ...sides.right.balls].map((b) => b.number);
    assert.equal(sides.left.balls.length, 7);
    assert.equal(sides.right.balls.length, 7);
    assert.equal(new Set(all).size, 14);
    for (const n of all) assert.ok(n >= 1 && n <= 20);
  }
});

test('hard mode makes exactly 4 balls need a double or triple', () => {
  for (let run = 0; run < 100; run++) {
    const { sides } = newGame(['A', 'B'], { mode: 'Hard' });
    assert.equal(sides.left.balls.filter((b) => b.tough).length, 4);
    assert.equal(sides.right.balls.filter((b) => b.tough).length, 4);
  }
  assert.equal(newGame(['A', 'B']).sides.left.balls.filter((b) => b.tough).length, 0);
});

test('hard balls need a double or triple, and others take any segment', () => {
  const left = rack(LEFT, 0, 0, [1]);
  assert.equal(throwDart(table(left), single(1)).last.hit, false);
  assert.equal(throwDart(table(left), makeDart('SingleInner', 1)).last.hit, false);
  assert.equal(throwDart(table(left), makeDart('Double', 1)).last.hit, true);
  assert.equal(throwDart(table(left), makeDart('Triple', 1)).last.hit, true);
  for (const bed of ['SingleInner', 'SingleOuter', 'Double', 'Triple']) {
    assert.equal(throwDart(table(), makeDart(bed, 1)).last.hit, true);
  }
});

test('a single on a hard ball pots nothing but keeps the turn going', () => {
  const left = rack(LEFT, 0, 0, [1]);
  let game = throwDart(table(left), single(1));
  assert.equal(game.last.near, true);
  assert.equal(game.phase, 'throwing');
  assert.equal(game.sides.left.potted, 0);
  assert.equal(game.sides.left.thrown, 1);
  game = throwDart(game, makeDart('Double', 1));
  assert.equal(game.sides.left.potted, 1);
  assert.equal(game.last.near, false);
});

test('a wrong number on a hard ball still ends the turn early', () => {
  const left = rack(LEFT, 0, 0, [1]);
  for (const dart of [single(20), makeDart('Double', 20), miss]) {
    const game = throwDart(table(left), dart);
    assert.equal(game.last.near, false);
    assert.equal(game.phase, 'takeout');
    assert.equal(game.turnOver, true);
  }
});

test('a single with the third dart hands over, but a pot with the third dart carries on', () => {
  const left = rack(LEFT, 0, 0, [1]);
  const twoSingles = throwDart(throwDart(table(left), single(1)), single(1));
  const handedOver = throwDart(twoSingles, single(1));
  assert.equal(handedOver.phase, 'takeout');
  assert.equal(handedOver.sides.left.thrown, 3);
  assert.equal(boardCleared(handedOver, endTurn).current, 1);

  const carriedOn = throwDart(twoSingles, makeDart('Triple', 1));
  assert.equal(carriedOn.phase, 'takeout');
  assert.equal(boardCleared(carriedOn, endTurn).current, 0);
});

test('a single on a hard ball keeps a last chance alive only while it can still be won', () => {
  const hard = rack(RIGHT, 0, 5, [8]);
  let game = endTurn(throwDart(table(atEight(13), hard), bull));
  game = throwDart(game, single(8));
  assert.equal(game.phase, 'throwing');
  game = throwDart(throwDart(game, single(8)), single(8));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 'left');

  let spent = endTurn(throwDart(table(atEight(5), rack(RIGHT, 0, 5, [8])), bull));
  spent = throwDart(spent, single(8));
  assert.equal(spent.phase, 'over');
  assert.equal(spent.winner, 'left');
});

test('balls go in order: only the current one counts', () => {
  const game = throwDart(table(), single(2));
  assert.equal(game.last.hit, false);
  assert.equal(game.sides.left.potted, 0);
});

test('a miss ends the turn immediately, whatever darts are left', () => {
  const game = throwDart(table(), single(20));
  assert.equal(game.phase, 'takeout');
  assert.equal(game.darts.length, 1);
  assert.equal(throwDart(game, single(1)), game);
  const next = boardCleared(game, endTurn);
  assert.equal(next.current, 1);
  assert.equal(next.phase, 'throwing');
});

test('off-board darts and bouncers are misses, and real throws count', () => {
  assert.equal(throwDart(table(), miss).phase, 'takeout');
  const bouncer = dartFromThrow({ bed: 'Triple', multiplier: 3, segmentName: 'T1', segmentNumber: 1, bouncer: true });
  assert.equal(throwDart(table(), bouncer).last.hit, false);
  const real = dartFromThrow({ bed: 'SingleInner', multiplier: 1, segmentName: 'S1', segmentNumber: 1 });
  assert.equal(throwDart(table(), real).sides.left.potted, 1);
});

test('a streak keeps going: three hits, darts out, same player carries on', () => {
  let game = table();
  game = [1, 2, 3].map(single).reduce(throwDart, game);
  assert.equal(game.sides.left.potted, 3);
  assert.equal(game.phase, 'takeout');
  game = boardCleared(game, endTurn);
  assert.equal(game.current, 0);
  assert.equal(game.phase, 'throwing');
  assert.deepEqual(game.darts, []);
  game = throwDart(game, single(4));
  assert.equal(game.sides.left.potted, 4);
  assert.equal(game.sides.left.thrown, 4);
});

test('pulling darts out mid-streak keeps the turn', () => {
  const game = boardCleared(throwDart(table(), single(1)), endTurn);
  assert.equal(game.current, 0);
  assert.equal(game.phase, 'throwing');
});

test('ending a turn with no darts does nothing', () => {
  const game = table();
  assert.equal(endTurn(game), game);
});

test('every dart counts toward the score, including misses', () => {
  let game = throwDart(table(), single(1));
  game = throwDart(game, single(20));
  assert.equal(game.sides.left.thrown, 2);
  assert.equal(game.players[0].thrown, 2);
});

test('the 8-ball is only on after all 7, and either bull counts', () => {
  const early = throwDart(table(rack(LEFT, 6)), bull);
  assert.equal(early.last.hit, false);
  for (const dart of [makeDart('OuterBull'), makeDart('InnerBull')]) {
    const hit = throwDart(table(atEight()), dart);
    assert.equal(hit.last.eightBall, true);
    assert.equal(hit.sides.left.finished, true);
  }
  assert.equal(throwDart(table(atEight()), single(20)).last.hit, false);
});

test('when the first side finishes, the other gets a last chance', () => {
  const game = throwDart(table(atEight()), bull);
  assert.equal(game.phase, 'takeout');
  assert.equal(game.lastChance, true);
  const next = endTurn(game);
  assert.equal(next.current, 1);
  assert.equal(next.phase, 'throwing');
});

test('a miss on the last chance loses, naming the dart count', () => {
  let game = endTurn(throwDart(table(atEight(13)), bull));
  game = throwDart(game, single(20));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 'left');
  assert.equal(game.winnerText, 'A wins in 14 darts!');
});

test('finishing in fewer darts on the last chance wins', () => {
  let game = table(atEight(13), rack(RIGHT, BALLS, 8));
  game = endTurn(throwDart(game, bull));
  game = throwDart(game, bull);
  assert.equal(game.winner, 'right');
  assert.equal(game.winnerText, 'B wins in 9 darts!');
});

test('finishing in more darts on the last chance still loses', () => {
  let game = table(atEight(7), rack(RIGHT, BALLS, 14));
  game = endTurn(throwDart(game, bull));
  game = throwDart(game, bull);
  assert.equal(game.winner, 'left');
});

test('the last chance ends once the fewest darts is out of reach', () => {
  let game = table(atEight(7), rack(RIGHT, 0, 7));
  game = endTurn(throwDart(game, bull));
  game = throwDart(game, single(8));
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 'left');
});

test('the second side finishing first wins outright', () => {
  let game = table(rack(LEFT, 3, 9), rack(RIGHT, BALLS, 20));
  game = endTurn(throwDart(game, miss));
  game = throwDart(game, bull);
  assert.equal(game.winner, 'right');
});

test('level dart counts go to a shootout at the bull', () => {
  let game = table(atEight(9), rack(RIGHT, BALLS, 9));
  game = endTurn(throwDart(game, bull));
  game = throwDart(game, bull);
  assert.equal(game.phase, 'takeout');
  assert.ok(game.shootout);
  game = endTurn(game);
  assert.equal(game.current, 0);

  game = endTurn(throwDart(game, bull));
  assert.equal(game.current, 1);
  game = throwDart(game, miss);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 'left');
  assert.equal(game.winnerText, 'A wins the shootout!');
  assert.equal(game.sides.left.thrown, 10);
});

test('a level shootout round repeats', () => {
  let game = { ...table(), shootout: { left: null, right: null, round: 1 } };
  game = endTurn(throwDart(game, miss));
  game = throwDart(game, miss);
  assert.equal(game.phase, 'takeout');
  assert.equal(game.shootout.round, 2);
  game = endTurn(game);
  game = endTurn(throwDart(game, miss));
  game = throwDart(game, bull);
  assert.equal(game.winner, 'right');
});

test('a shootout dart ends the turn even when it hits', () => {
  const game = throwDart({ ...table(), shootout: { left: null, right: null, round: 1 } }, bull);
  assert.equal(game.phase, 'takeout');
  assert.equal(endTurn(game).current, 1);
});

test('one player just clears the table', () => {
  const solo = { ...newGame(['Solo']), sides: { left: atEight(11), right: rack(RIGHT) } };
  const game = throwDart(solo, bull);
  assert.equal(game.phase, 'over');
  assert.equal(game.winnerText, 'Solo clears the table in 12 darts!');
});

test('one player keeps going after a miss', () => {
  const game = endTurn(throwDart(newGame(['Solo']), miss));
  assert.equal(game.current, 0);
  assert.equal(game.phase, 'throwing');
});

test('larger groups split into two teams sharing a rack', () => {
  const game = newGame(['A', 'B', 'C', 'D']);
  assert.deepEqual(game.players.map((p) => p.side), ['left', 'right', 'left', 'right']);
  assert.equal(game.sides.left.balls.length, 7);
  assert.equal(game.sides.right.balls.length, 7);
});

test('teammates carry on from the same ball, and team wins name both', () => {
  let game = table(rack(LEFT, 1, 1), rack(RIGHT), ['A', 'B', 'C', 'D']);
  game = endTurn(throwDart(game, miss));
  game = endTurn(throwDart(game, miss));
  assert.equal(game.current, 2);
  game = throwDart(game, single(2));
  assert.equal(game.sides.left.potted, 2);

  let finish = table(atEight(9), rack(RIGHT), ['A', 'B', 'C', 'D']);
  finish = endTurn(throwDart(finish, bull));
  finish = throwDart(finish, miss);
  assert.equal(finish.winnerText, 'A & C win in 10 darts!');
});
