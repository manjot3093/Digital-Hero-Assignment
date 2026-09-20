/**
 * Charity contribution rules (PRD §08).
 *
 * Every subscriber directs a minimum of 10% of their subscription fee to a
 * chosen cause and may voluntarily raise that up to 100%.
 */
export const MIN_CHARITY_PERCENT = 10;
export const MAX_CHARITY_PERCENT = 100;

export class CharityRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CharityRuleError';
    this.code = code;
  }
}

export function assertValidPercent(percent) {
  if (typeof percent !== 'number' || Number.isNaN(percent)) {
    throw new CharityRuleError('INVALID_CHARITY_PERCENT', 'Contribution percentage must be a number.');
  }
  if (!Number.isInteger(percent)) {
    throw new CharityRuleError('INVALID_CHARITY_PERCENT', 'Contribution percentage must be a whole number.');
  }
  if (percent < MIN_CHARITY_PERCENT) {
    throw new CharityRuleError(
      'CHARITY_PERCENT_TOO_LOW',
      `The minimum contribution is ${MIN_CHARITY_PERCENT}% of your subscription.`
    );
  }
  if (percent > MAX_CHARITY_PERCENT) {
    throw new CharityRuleError(
      'CHARITY_PERCENT_TOO_HIGH',
      `The maximum contribution is ${MAX_CHARITY_PERCENT}% of your subscription.`
    );
  }
  return percent;
}

/** Splits a subscription payment into charity / prize fund / platform slices. */
export function splitContribution({ amountMinor, charityPercent, prizeShare = 0.5 }) {
  assertValidPercent(charityPercent);
  const charityMinor = Math.round(amountMinor * (charityPercent / 100));
  const remainder = amountMinor - charityMinor;
  const prizeMinor = Math.floor(remainder * prizeShare);
  const platformMinor = remainder - prizeMinor;
  return { amountMinor, charityMinor, prizeMinor, platformMinor };
}

export function annualisedCharityImpact({ amountMinor, charityPercent, interval }) {
  const { charityMinor } = splitContribution({ amountMinor, charityPercent });
  return interval === 'yearly' ? charityMinor : charityMinor * 12;
}
