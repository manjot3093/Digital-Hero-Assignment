import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planScoreInsert,
  planScoreUpdate,
  sortNewestFirst,
  selectEvictions,
  assertValidScoreValue,
  summarise,
  MAX_RETAINED,
} from '../src/domain/scores/scoreRules.js';

const makeScore = (id, playedOn, value) => ({ id, playedOn, value, createdAt: `${playedOn}T09:00:00Z` });
const TODAY = new Date('2026-05-20T12:00:00Z');

test('score range: accepts the boundaries 1 and 45', () => {
  assert.equal(assertValidScoreValue(1), 1);
  assert.equal(assertValidScoreValue(45), 45);
});

test('score range: rejects values outside 1-45 and non-integers', () => {
  assert.throws(() => assertValidScoreValue(0), { code: 'SCORE_OUT_OF_RANGE' });
  assert.throws(() => assertValidScoreValue(46), { code: 'SCORE_OUT_OF_RANGE' });
  assert.throws(() => assertValidScoreValue(31.5), { code: 'INVALID_SCORE_VALUE' });
  assert.throws(() => assertValidScoreValue('34'), { code: 'INVALID_SCORE_VALUE' });
});

test('duplicate date: a second score on the same day is rejected', () => {
  const existing = [makeScore('a', '2026-05-18', 34)];
  assert.throws(
    () => planScoreInsert({ existing, value: 30, playedOn: '2026-05-18', today: TODAY }),
    { code: 'DUPLICATE_SCORE_DATE' }
  );
});

test('future dates are rejected', () => {
  assert.throws(
    () => planScoreInsert({ existing: [], value: 30, playedOn: '2026-06-01', today: TODAY }),
    { code: 'FUTURE_SCORE_DATE' }
  );
});

test('retention: fewer than five stored scores evicts nothing', () => {
  const existing = [
    makeScore('a', '2026-05-01', 30),
    makeScore('b', '2026-05-05', 32),
    makeScore('c', '2026-05-09', 28),
    makeScore('d', '2026-05-12', 36),
  ];
  const plan = planScoreInsert({ existing, value: 41, playedOn: '2026-05-19', today: TODAY });
  assert.deepEqual(plan.evictIds, []);
});

test('retention: a sixth score evicts exactly the oldest entry', () => {
  const existing = [
    makeScore('oldest', '2026-04-02', 21),
    makeScore('b', '2026-04-11', 30),
    makeScore('c', '2026-04-20', 33),
    makeScore('d', '2026-05-02', 27),
    makeScore('e', '2026-05-11', 38),
  ];
  const plan = planScoreInsert({ existing, value: 40, playedOn: '2026-05-18', today: TODAY });
  assert.deepEqual(plan.evictIds, ['oldest']);
  assert.equal(existing.length - plan.evictIds.length + 1, MAX_RETAINED);
});

test('retention: an over-full table is trimmed back to five', () => {
  const existing = [
    makeScore('x1', '2026-01-02', 21),
    makeScore('x2', '2026-01-03', 22),
    makeScore('b', '2026-04-11', 30),
    makeScore('c', '2026-04-20', 33),
    makeScore('d', '2026-05-02', 27),
    makeScore('e', '2026-05-11', 38),
  ];
  const plan = planScoreInsert({ existing, value: 40, playedOn: '2026-05-18', today: TODAY });
  assert.deepEqual(plan.evictIds.sort(), ['x1', 'x2']);
});

test('ordering: scores are returned newest first', () => {
  const ordered = sortNewestFirst([
    makeScore('a', '2026-05-01', 30),
    makeScore('c', '2026-05-11', 28),
    makeScore('b', '2026-05-05', 32),
  ]);
  assert.deepEqual(ordered.map((s) => s.id), ['c', 'b', 'a']);
});

test('edit: a score may keep its own date without tripping the duplicate rule', () => {
  const existing = [makeScore('a', '2026-05-18', 34), makeScore('b', '2026-05-11', 22)];
  const plan = planScoreUpdate({ existing, id: 'a', value: 40, playedOn: '2026-05-18', today: TODAY });
  assert.equal(plan.value, 40);
  assert.equal(plan.playedOn, '2026-05-18');
});

test('edit: moving a score onto another score date is rejected', () => {
  const existing = [makeScore('a', '2026-05-18', 34), makeScore('b', '2026-05-11', 22)];
  assert.throws(
    () => planScoreUpdate({ existing, id: 'a', value: 34, playedOn: '2026-05-11', today: TODAY }),
    { code: 'DUPLICATE_SCORE_DATE' }
  );
});

test('edit: unknown score id is rejected', () => {
  assert.throws(
    () => planScoreUpdate({ existing: [], id: 'nope', value: 10, playedOn: '2026-05-01', today: TODAY }),
    { code: 'SCORE_NOT_FOUND' }
  );
});

test('delete leaves the remaining scores intact and evicts nothing on the next insert', () => {
  let existing = [
    makeScore('a', '2026-05-01', 30),
    makeScore('b', '2026-05-05', 32),
    makeScore('c', '2026-05-09', 28),
    makeScore('d', '2026-05-12', 36),
    makeScore('e', '2026-05-15', 26),
  ];
  existing = existing.filter((s) => s.id !== 'c'); // delete
  const plan = planScoreInsert({ existing, value: 31, playedOn: '2026-05-19', today: TODAY });
  assert.deepEqual(plan.evictIds, []);
});

test('summary reports count, average and best', () => {
  const summary = summarise([
    makeScore('a', '2026-05-01', 30),
    makeScore('b', '2026-05-05', 40),
  ]);
  assert.equal(summary.count, 2);
  assert.equal(summary.average, 35);
  assert.equal(summary.best, 40);
});

test('selectEvictions is stable when called on an empty set', () => {
  assert.deepEqual(selectEvictions([]), []);
});
