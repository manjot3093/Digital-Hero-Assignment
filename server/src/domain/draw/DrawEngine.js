import { resolveStrategy } from './strategies.js';
import { MatchEvaluator } from './MatchEvaluator.js';
import { PrizeCalculator } from './PrizeCalculator.js';
import { randomSeed } from './rng.js';

/**
 * Orchestrates a draw end to end without touching the database.
 *
 *   DrawEngine
 *     ├── RandomStrategy / WeightedScoreStrategy   → picks the numbers
 *     ├── MatchEvaluator                           → buckets entries by matches
 *     └── PrizeCalculator                          → allocates 40/35/25 + rollover
 *
 * The result of run() is a plain object. DrawService decides whether that
 * object is thrown away (simulation) or written to the database (publish).
 */
export class DrawEngine {
  constructor({ evaluator = new MatchEvaluator(), calculator = new PrizeCalculator() } = {}) {
    this.evaluator = evaluator;
    this.calculator = calculator;
  }

  run({
    strategy = 'random',
    strategyOptions = {},
    seed = randomSeed(),
    participants = [],
    entries = [],
    poolMinor = 0,
    carriedInMinor = 0,
  }) {
    const engineStrategy = resolveStrategy(strategy, strategyOptions);
    const { numbers, weights } = engineStrategy.draw({ seed, participants });
    const evaluation = this.evaluator.evaluate(entries, numbers);
    const prizes = this.calculator.calculate({ poolMinor, evaluation, carriedInMinor });

    return {
      strategy,
      seed,
      numbers,
      weights,
      entryCount: evaluation.evaluated,
      participantCount: participants.length,
      tiers: prizes.tiers,
      awards: prizes.awards,
      poolMinor: prizes.poolMinor,
      carriedInMinor: prizes.carriedInMinor,
      distributedMinor: prizes.distributedMinor,
      rolloverMinor: prizes.rolloverMinor,
      unclaimedMinor: prizes.unclaimedMinor,
      jackpotClaimed: prizes.jackpotClaimed,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Builds a deterministic ticket for a subscriber from their retained scores.
 * A participant with fewer than five scores has their ticket topped up from a
 * seeded generator keyed on their user id, so everyone holds a full ticket
 * while the numbers stay stable between the simulation and the publish.
 */
export function buildTicket({ userId, scores = [], poolSize = 40, picks = 5, seed = '' }) {
  const chosen = [];
  const seen = new Set();

  for (const score of scores) {
    const number = ((score - 1) % poolSize) + 1;
    if (!seen.has(number)) {
      seen.add(number);
      chosen.push(number);
    }
    if (chosen.length === picks) break;
  }

  if (chosen.length < picks) {
    // Top up deterministically from the user id so the ticket never changes.
    const next = createSeeded(`${userId}:${seed}`);
    let guard = 0;
    while (chosen.length < picks && guard < poolSize * 10) {
      const candidate = Math.floor(next() * poolSize) + 1;
      if (!seen.has(candidate)) {
        seen.add(candidate);
        chosen.push(candidate);
      }
      guard += 1;
    }
  }

  return chosen.sort((a, b) => a - b);
}

function createSeeded(key) {
  // Local import avoids a circular dependency at module init time.
  // eslint-disable-next-line global-require
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
