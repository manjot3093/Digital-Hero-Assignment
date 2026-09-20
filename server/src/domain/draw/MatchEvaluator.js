export const MATCH_TIERS = [5, 4, 3];

/**
 * Compares every entry's ticket against the drawn numbers and buckets the
 * entries by how many numbers they matched. Only 3, 4 and 5 matches win.
 */
export class MatchEvaluator {
  constructor(tiers = MATCH_TIERS) {
    this.tiers = tiers;
  }

  countMatches(ticket, drawnNumbers) {
    const drawn = new Set(drawnNumbers);
    return ticket.reduce((count, number) => (drawn.has(number) ? count + 1 : count), 0);
  }

  evaluate(entries, drawnNumbers) {
    const buckets = new Map(this.tiers.map((tier) => [tier, []]));
    let evaluated = 0;

    for (const entry of entries) {
      const matches = this.countMatches(entry.numbers, drawnNumbers);
      evaluated += 1;
      if (buckets.has(matches)) {
        buckets.get(matches).push({ ...entry, matches });
      }
    }

    return {
      evaluated,
      tiers: this.tiers.map((tier) => ({ matchCount: tier, winners: buckets.get(tier) })),
    };
  }
}
