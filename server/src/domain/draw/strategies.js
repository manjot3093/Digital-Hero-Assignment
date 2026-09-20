import { createRng } from './rng.js';

export const BALL_POOL_SIZE = 40;
export const NUMBERS_PER_TICKET = 5;

/**
 * A draw strategy turns (participants, seed) into the winning number set.
 * Every strategy exposes the same shape so new strategies can be registered
 * without touching the engine.
 */
class DrawStrategy {
  constructor({ poolSize = BALL_POOL_SIZE, picks = NUMBERS_PER_TICKET } = {}) {
    this.poolSize = poolSize;
    this.picks = picks;
  }

  // eslint-disable-next-line no-unused-vars
  draw(_context) {
    throw new Error('draw() must be implemented by a strategy');
  }
}

/** Standard lottery-style uniform selection without replacement. */
export class RandomStrategy extends DrawStrategy {
  static key = 'random';

  draw({ seed }) {
    const next = createRng(seed);
    const balls = Array.from({ length: this.poolSize }, (_, i) => i + 1);
    // Partial Fisher-Yates so the sample is uniform and reproducible.
    for (let i = 0; i < this.picks; i += 1) {
      const j = i + Math.floor(next() * (balls.length - i));
      [balls[i], balls[j]] = [balls[j], balls[i]];
    }
    return {
      numbers: balls.slice(0, this.picks).sort((a, b) => a - b),
      weights: null,
    };
  }
}

/**
 * Weighted by score frequency (PRD §06): numbers that appear often across the
 * participants' retained Stableford scores are more likely to be drawn, so the
 * draw reflects how actively the membership has been playing.
 *
 * Every ball keeps a baseline weight, which guarantees no number can ever
 * become impossible to draw.
 */
export class WeightedScoreStrategy extends DrawStrategy {
  static key = 'weighted';

  constructor(options = {}) {
    super(options);
    this.baseline = options.baseline ?? 1;
    this.scoreInfluence = options.scoreInfluence ?? 1;
  }

  buildWeights(participants) {
    const weights = new Array(this.poolSize).fill(this.baseline);
    for (const participant of participants) {
      for (const score of participant.scores ?? []) {
        const ball = ((score - 1) % this.poolSize + this.poolSize) % this.poolSize;
        weights[ball] += this.scoreInfluence;
      }
    }
    return weights;
  }

  draw({ seed, participants = [] }) {
    const next = createRng(seed);
    const weights = this.buildWeights(participants);
    const available = weights.map((weight, index) => ({ number: index + 1, weight }));
    const numbers = [];

    for (let pick = 0; pick < this.picks; pick += 1) {
      const total = available.reduce((sum, item) => sum + item.weight, 0);
      let target = next() * total;
      let chosenIndex = available.length - 1;
      for (let i = 0; i < available.length; i += 1) {
        target -= available[i].weight;
        if (target <= 0) {
          chosenIndex = i;
          break;
        }
      }
      numbers.push(available[chosenIndex].number);
      available.splice(chosenIndex, 1); // no replacement
    }

    return {
      numbers: numbers.sort((a, b) => a - b),
      weights: weights.map((weight, index) => ({ number: index + 1, weight })),
    };
  }
}

const registry = new Map([
  [RandomStrategy.key, RandomStrategy],
  [WeightedScoreStrategy.key, WeightedScoreStrategy],
]);

export function resolveStrategy(key, options = {}) {
  const Strategy = registry.get(key);
  if (!Strategy) throw new Error(`Unknown draw strategy: ${key}`);
  return new Strategy(options);
}

export function registerStrategy(key, Strategy) {
  registry.set(key, Strategy);
}

export function availableStrategies() {
  return [...registry.keys()];
}
