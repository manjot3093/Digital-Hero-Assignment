/**
 * Prize pool allocation (PRD §07).
 *
 * 5-match 40% · 4-match 35% · 3-match 25%. The 5-match tier is a jackpot: if
 * nobody matches five numbers the allocation rolls into the next draw. The 4
 * and 3 tiers do not roll over — anything unclaimed there returns to the pool
 * float so it can be re-allocated by the next auto-calculation.
 *
 * All money is handled in integer minor units (pence/cents) to avoid floating
 * point drift; only the presentation layer converts to decimals.
 */
export const TIER_ALLOCATION = Object.freeze({
  5: 0.4,
  4: 0.35,
  3: 0.25,
});

export const ROLLS_OVER = Object.freeze({ 5: true, 4: false, 3: false });

export function allocateTiers(poolMinor, allocation = TIER_ALLOCATION) {
  const tiers = Object.keys(allocation)
    .map(Number)
    .sort((a, b) => b - a);

  let assigned = 0;
  const result = tiers.map((tier, index) => {
    const isLast = index === tiers.length - 1;
    // Give the remainder to the final tier so the tiers always sum to the pool.
    const amount = isLast ? poolMinor - assigned : Math.floor(poolMinor * allocation[tier]);
    assigned += isLast ? 0 : amount;
    return { matchCount: tier, share: allocation[tier], amountMinor: amount };
  });

  return result;
}

/**
 * Splits a tier amount equally between winners. Any indivisible remainder
 * (a few pence) is distributed one unit at a time from the first winner so the
 * sum of the payouts always equals the tier amount exactly.
 */
export function splitEqually(amountMinor, winnerCount) {
  if (winnerCount <= 0) return [];
  const base = Math.floor(amountMinor / winnerCount);
  let remainder = amountMinor - base * winnerCount;
  return Array.from({ length: winnerCount }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return base + extra;
  });
}

export class PrizeCalculator {
  constructor({ allocation = TIER_ALLOCATION, rollsOver = ROLLS_OVER } = {}) {
    this.allocation = allocation;
    this.rollsOver = rollsOver;
  }

  /**
   * @param {number} poolMinor      total pool for this draw, including any
   *                                jackpot carried in from previous draws
   * @param {object} evaluation     output of MatchEvaluator.evaluate()
   * @param {number} carriedInMinor jackpot rolled in, for reporting only
   */
  calculate({ poolMinor, evaluation, carriedInMinor = 0 }) {
    const tierAmounts = allocateTiers(poolMinor, this.allocation);
    const byTier = new Map(tierAmounts.map((tier) => [tier.matchCount, tier]));

    let rolloverMinor = 0;
    let unclaimedMinor = 0;
    let distributedMinor = 0;
    const awards = [];

    const tiers = evaluation.tiers.map(({ matchCount, winners }) => {
      const tier = byTier.get(matchCount) ?? { amountMinor: 0, share: 0 };
      const shares = splitEqually(tier.amountMinor, winners.length);

      winners.forEach((winner, index) => {
        awards.push({
          ...winner,
          matchCount,
          amountMinor: shares[index],
        });
        distributedMinor += shares[index];
      });

      if (!winners.length) {
        if (this.rollsOver[matchCount]) rolloverMinor += tier.amountMinor;
        else unclaimedMinor += tier.amountMinor;
      }

      return {
        matchCount,
        share: tier.share,
        amountMinor: tier.amountMinor,
        winnerCount: winners.length,
        perWinnerMinor: winners.length ? shares[0] : 0,
        rolledOver: !winners.length && Boolean(this.rollsOver[matchCount]),
      };
    });

    return {
      poolMinor,
      carriedInMinor,
      tiers,
      awards,
      distributedMinor,
      rolloverMinor,
      unclaimedMinor,
      jackpotClaimed: tiers.find((t) => t.matchCount === 5)?.winnerCount > 0,
    };
  }
}

/**
 * Auto-calculates the prize pool from live subscription revenue rather than a
 * hard-coded figure (PRD §07): every active subscription contributes the
 * prize-fund slice of its fee, after the subscriber's chosen charity cut.
 */
export function calculatePoolFromSubscriptions(subscriptions, { prizeShare, carryOverMinor = 0 }) {
  const contributionMinor = subscriptions.reduce((total, sub) => {
    const monthlyMinor = sub.monthlyValueMinor ?? 0;
    const charityMinor = Math.round(monthlyMinor * (sub.charityPercent ?? 0) / 100);
    const remaining = monthlyMinor - charityMinor;
    return total + Math.floor(remaining * prizeShare);
  }, 0);

  return {
    subscriberCount: subscriptions.length,
    contributionMinor,
    carryOverMinor,
    totalMinor: contributionMinor + carryOverMinor,
  };
}
