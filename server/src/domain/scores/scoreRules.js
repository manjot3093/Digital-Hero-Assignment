/**
 * Stableford score business rules.
 *
 * These are pure functions with no database or HTTP dependencies so that the
 * rules can be unit tested in isolation and reused by any transport layer.
 *
 * Rules (PRD §05):
 *  - A score is an integer between MIN_SCORE and MAX_SCORE inclusive.
 *  - Every score carries a date; only one score may exist per user per date.
 *  - Only the most recent MAX_RETAINED scores are kept. Adding another one
 *    evicts the oldest stored score.
 *  - Scores are presented newest first.
 */

export const MIN_SCORE = 1;
export const MAX_SCORE = 45;
export const MAX_RETAINED = 5;

export class ScoreRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ScoreRuleError';
    this.code = code;
  }
}

/** Normalises a date-ish value to a YYYY-MM-DD calendar day string. */
export function toCalendarDay(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new ScoreRuleError('INVALID_SCORE_DATE', 'Score date is not a valid date.');
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!match) throw new ScoreRuleError('INVALID_SCORE_DATE', 'Score date must be in YYYY-MM-DD format.');
    const parsed = new Date(`${match[0]}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) throw new ScoreRuleError('INVALID_SCORE_DATE', 'Score date is not a valid date.');
    return match[0];
  }
  throw new ScoreRuleError('INVALID_SCORE_DATE', 'Score date is required.');
}

export function assertValidScoreValue(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ScoreRuleError('INVALID_SCORE_VALUE', 'Stableford points must be a whole number.');
  }
  if (value < MIN_SCORE || value > MAX_SCORE) {
    throw new ScoreRuleError(
      'SCORE_OUT_OF_RANGE',
      `Stableford points must be between ${MIN_SCORE} and ${MAX_SCORE}.`
    );
  }
  return value;
}

export function assertNotFutureDate(day, today = new Date()) {
  const normalisedToday = toCalendarDay(today);
  if (day > normalisedToday) {
    throw new ScoreRuleError('FUTURE_SCORE_DATE', 'A score cannot be dated in the future.');
  }
  return day;
}

/** Throws when another entry already occupies the same calendar day. */
export function assertNoDuplicateDate(existing, day, { ignoreId = null } = {}) {
  const clash = existing.find(
    (entry) => toCalendarDay(entry.playedOn) === day && entry.id !== ignoreId
  );
  if (clash) {
    throw new ScoreRuleError(
      'DUPLICATE_SCORE_DATE',
      'A score already exists for that date. Edit or delete it instead.'
    );
  }
  return true;
}

export function sortNewestFirst(scores) {
  return [...scores].sort((a, b) => {
    const dayDiff = toCalendarDay(b.playedOn).localeCompare(toCalendarDay(a.playedOn));
    if (dayDiff !== 0) return dayDiff;
    return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0);
  });
}

/**
 * Works out which stored scores must be evicted once `incoming` is added.
 * Returns the ids of the oldest entries beyond the retention window.
 */
export function selectEvictions(existing, retention = MAX_RETAINED) {
  const ordered = sortNewestFirst(existing);
  if (ordered.length < retention) return [];
  return ordered.slice(retention - 1).map((entry) => entry.id);
}

/**
 * Pure planner for "add a score". Returns the validated payload plus the ids
 * the persistence layer should delete inside the same transaction.
 */
export function planScoreInsert({ existing = [], value, playedOn, today = new Date() }) {
  const day = assertNotFutureDate(toCalendarDay(playedOn), today);
  assertValidScoreValue(value);
  assertNoDuplicateDate(existing, day);
  return { value, playedOn: day, evictIds: selectEvictions(existing) };
}

export function planScoreUpdate({ existing = [], id, value, playedOn, today = new Date() }) {
  const target = existing.find((entry) => entry.id === id);
  if (!target) throw new ScoreRuleError('SCORE_NOT_FOUND', 'That score no longer exists.');
  const day = assertNotFutureDate(toCalendarDay(playedOn ?? target.playedOn), today);
  const points = value ?? target.value;
  assertValidScoreValue(points);
  assertNoDuplicateDate(existing, day, { ignoreId: id });
  return { id, value: points, playedOn: day };
}

/** Simple analytics used by the dashboard and the weighted draw strategy. */
export function summarise(scores) {
  if (!scores.length) return { count: 0, average: null, best: null, latest: null, trend: null };
  const ordered = sortNewestFirst(scores);
  const values = ordered.map((s) => s.value);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const half = Math.floor(values.length / 2);
  const recent = values.slice(0, half || 1);
  const older = values.slice(half || 1);
  const trend = older.length
    ? recent.reduce((a, b) => a + b, 0) / recent.length - older.reduce((a, b) => a + b, 0) / older.length
    : null;
  return {
    count: values.length,
    average: Math.round(average * 10) / 10,
    best: Math.max(...values),
    latest: ordered[0].value,
    trend: trend === null ? null : Math.round(trend * 10) / 10,
  };
}
