import test from 'node:test';
import assert from 'node:assert/strict';
import { DrawEngine, buildTicket } from '../src/domain/draw/DrawEngine.js';
import { RandomStrategy, WeightedScoreStrategy, resolveStrategy } from '../src/domain/draw/strategies.js';
import { MatchEvaluator } from '../src/domain/draw/MatchEvaluator.js';
import {
  PrizeCalculator,
  allocateTiers,
  splitEqually,
  calculatePoolFromSubscriptions,
  TIER_ALLOCATION,
} from '../src/domain/draw/PrizeCalculator.js';

const entry = (userId, numbers) => ({ userId, entryId: `e-${userId}`, numbers });

test('random draw returns five unique in-range numbers, sorted', () => {
  const { numbers } = new RandomStrategy().draw({ seed: 'seed-1' });
  assert.equal(numbers.length, 5);
  assert.equal(new Set(numbers).size, 5);
  assert.ok(numbers.every((n) => n >= 1 && n <= 40));
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
});

test('random draw is reproducible for a seed and differs across seeds', () => {
  const a = new RandomStrategy().draw({ seed: 'alpha' }).numbers;
  const b = new RandomStrategy().draw({ seed: 'alpha' }).numbers;
  const c = new RandomStrategy().draw({ seed: 'beta' }).numbers;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('random draw is roughly uniform across many seeds', () => {
  const counts = new Map();
  for (let i = 0; i < 4000; i += 1) {
    for (const n of new RandomStrategy().draw({ seed: `s${i}` }).numbers) {
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  }
  const expected = (4000 * 5) / 40;
  for (const [, count] of counts) {
    assert.ok(Math.abs(count - expected) < expected * 0.25, 'ball frequency should stay near the mean');
  }
});

test('weighted draw favours numbers that appear often in scores', () => {
  const participants = Array.from({ length: 60 }, (_, i) => ({
    userId: `u${i}`,
    scores: [7, 7, 7, 7, 7],
  }));
  const strategy = new WeightedScoreStrategy({ scoreInfluence: 4 });
  let hits = 0;
  for (let i = 0; i < 200; i += 1) {
    if (strategy.draw({ seed: `w${i}`, participants }).numbers.includes(7)) hits += 1;
  }
  assert.ok(hits > 150, `ball 7 should dominate a weighted draw, saw ${hits}/200`);
});

test('weighted draw never makes an unplayed number impossible', () => {
  const strategy = new WeightedScoreStrategy();
  const weights = strategy.buildWeights([{ userId: 'u1', scores: [12] }]);
  assert.ok(weights.every((w) => w > 0));
});

test('weighted draw still returns five unique numbers', () => {
  const { numbers } = new WeightedScoreStrategy().draw({
    seed: 'x',
    participants: [{ userId: 'a', scores: [1, 2, 3, 4, 5] }],
  });
  assert.equal(new Set(numbers).size, 5);
});

test('strategy registry resolves both strategies and rejects unknown keys', () => {
  assert.ok(resolveStrategy('random') instanceof RandomStrategy);
  assert.ok(resolveStrategy('weighted') instanceof WeightedScoreStrategy);
  assert.throws(() => resolveStrategy('psychic'), /Unknown draw strategy/);
});

test('match evaluator buckets 3, 4 and 5 matches and ignores the rest', () => {
  const drawn = [3, 9, 14, 22, 31];
  const result = new MatchEvaluator().evaluate(
    [
      entry('five', [3, 9, 14, 22, 31]),
      entry('four', [3, 9, 14, 22, 40]),
      entry('three', [3, 9, 14, 38, 40]),
      entry('two', [3, 9, 37, 38, 40]),
      entry('none', [1, 2, 4, 5, 6]),
    ],
    drawn
  );
  assert.equal(result.evaluated, 5);
  const byTier = Object.fromEntries(result.tiers.map((t) => [t.matchCount, t.winners.map((w) => w.userId)]));
  assert.deepEqual(byTier[5], ['five']);
  assert.deepEqual(byTier[4], ['four']);
  assert.deepEqual(byTier[3], ['three']);
});

test('tier allocation is exactly 40 / 35 / 25 and sums to the pool', () => {
  assert.equal(TIER_ALLOCATION[5], 0.4);
  assert.equal(TIER_ALLOCATION[4], 0.35);
  assert.equal(TIER_ALLOCATION[3], 0.25);
  const tiers = allocateTiers(100000);
  assert.deepEqual(tiers.map((t) => t.amountMinor), [40000, 35000, 25000]);
  assert.equal(tiers.reduce((sum, t) => sum + t.amountMinor, 0), 100000);
});

test('tier allocation loses no minor units on awkward pool sizes', () => {
  for (const pool of [1, 7, 99, 1234, 98765, 1000003]) {
    const total = allocateTiers(pool).reduce((sum, t) => sum + t.amountMinor, 0);
    assert.equal(total, pool, `allocation must sum exactly for a pool of ${pool}`);
  }
});

test('multiple winners in a tier split it equally', () => {
  const shares = splitEqually(30000, 3);
  assert.deepEqual(shares, [10000, 10000, 10000]);
});

test('an indivisible tier distributes the remainder rather than dropping it', () => {
  const shares = splitEqually(10000, 3);
  assert.equal(shares.reduce((a, b) => a + b, 0), 10000);
  assert.deepEqual(shares, [3334, 3333, 3333]);
});

test('unclaimed jackpot rolls over; lower tiers do not', () => {
  const evaluation = new MatchEvaluator().evaluate(
    [entry('four', [3, 9, 14, 22, 40]), entry('three', [3, 9, 14, 38, 40])],
    [3, 9, 14, 22, 31]
  );
  const result = new PrizeCalculator().calculate({ poolMinor: 100000, evaluation });
  assert.equal(result.jackpotClaimed, false);
  assert.equal(result.rolloverMinor, 40000);
  assert.equal(result.unclaimedMinor, 0);
  assert.equal(result.distributedMinor, 60000);
});

test('a claimed jackpot rolls nothing over', () => {
  const evaluation = new MatchEvaluator().evaluate([entry('five', [3, 9, 14, 22, 31])], [3, 9, 14, 22, 31]);
  const result = new PrizeCalculator().calculate({ poolMinor: 100000, evaluation });
  assert.equal(result.jackpotClaimed, true);
  assert.equal(result.rolloverMinor, 0);
  assert.equal(result.awards[0].amountMinor, 40000);
  assert.equal(result.unclaimedMinor, 60000, 'empty 4 and 3 tiers return to the float, they never roll over');
});

test('two jackpot winners split 40% of the pool equally', () => {
  const evaluation = new MatchEvaluator().evaluate(
    [entry('a', [3, 9, 14, 22, 31]), entry('b', [3, 9, 14, 22, 31])],
    [3, 9, 14, 22, 31]
  );
  const result = new PrizeCalculator().calculate({ poolMinor: 100000, evaluation });
  const jackpot = result.tiers.find((t) => t.matchCount === 5);
  assert.equal(jackpot.winnerCount, 2);
  assert.equal(jackpot.perWinnerMinor, 20000);
  assert.equal(result.awards.filter((a) => a.matchCount === 5).reduce((s, a) => s + a.amountMinor, 0), 40000);
});

test('distributed plus rolled over plus unclaimed always equals the pool', () => {
  const evaluation = new MatchEvaluator().evaluate(
    [entry('a', [3, 9, 14, 22, 31]), entry('b', [3, 9, 14, 22, 7]), entry('c', [3, 9, 14, 1, 2])],
    [3, 9, 14, 22, 31]
  );
  const result = new PrizeCalculator().calculate({ poolMinor: 777777, evaluation });
  assert.equal(result.distributedMinor + result.rolloverMinor + result.unclaimedMinor, 777777);
});

test('the engine carries a rolled-in jackpot into the next pool', () => {
  const engine = new DrawEngine();
  const result = engine.run({
    strategy: 'random',
    seed: 'carry',
    entries: [entry('a', [1, 2, 3, 4, 5])],
    poolMinor: 150000,
    carriedInMinor: 50000,
  });
  assert.equal(result.poolMinor, 150000);
  assert.equal(result.carriedInMinor, 50000);
});

test('the engine produces an identical result for the same seed (simulate then publish)', () => {
  const engine = new DrawEngine();
  const entries = Array.from({ length: 50 }, (_, i) =>
    entry(`u${i}`, buildTicket({ userId: `u${i}`, scores: [i % 40, (i * 3) % 40] }))
  );
  const config = { strategy: 'weighted', seed: 'draw-2026-05', entries, participants: [], poolMinor: 250000 };
  const simulated = engine.run(config);
  const published = engine.run(config);
  assert.deepEqual(simulated.numbers, published.numbers);
  assert.deepEqual(
    simulated.awards.map((a) => [a.userId, a.amountMinor]),
    published.awards.map((a) => [a.userId, a.amountMinor])
  );
});

test('ticket building is deterministic and tops up short score histories', () => {
  const first = buildTicket({ userId: 'user-42', scores: [12, 34] });
  const second = buildTicket({ userId: 'user-42', scores: [12, 34] });
  assert.deepEqual(first, second);
  assert.equal(first.length, 5);
  assert.equal(new Set(first).size, 5);
});

test('prize pool is calculated from live subscriptions, never hard-coded', () => {
  const pool = calculatePoolFromSubscriptions(
    [
      { monthlyValueMinor: 1200, charityPercent: 10 },
      { monthlyValueMinor: 1200, charityPercent: 50 },
      { monthlyValueMinor: 1000, charityPercent: 10 },
    ],
    { prizeShare: 0.5, carryOverMinor: 5000 }
  );
  assert.equal(pool.subscriberCount, 3);
  assert.equal(pool.contributionMinor, 540 + 300 + 450);
  assert.equal(pool.totalMinor, pool.contributionMinor + 5000);
});

test('an empty subscriber base still produces a valid (carry-over only) pool', () => {
  const pool = calculatePoolFromSubscriptions([], { prizeShare: 0.5, carryOverMinor: 12345 });
  assert.equal(pool.contributionMinor, 0);
  assert.equal(pool.totalMinor, 12345);
});

test('a draw with no entries rolls the jackpot and distributes nothing', () => {
  const result = new DrawEngine().run({ seed: 'empty', entries: [], poolMinor: 90000 });
  assert.equal(result.distributedMinor, 0);
  assert.equal(result.rolloverMinor, 36000);
  assert.equal(result.awards.length, 0);
});
