import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidPercent,
  splitContribution,
  annualisedCharityImpact,
  MIN_CHARITY_PERCENT,
} from '../src/domain/charity/contribution.js';

test('minimum contribution is 10%', () => {
  assert.equal(MIN_CHARITY_PERCENT, 10);
  assert.equal(assertValidPercent(10), 10);
  assert.throws(() => assertValidPercent(9), { code: 'CHARITY_PERCENT_TOO_LOW' });
  assert.throws(() => assertValidPercent(0), { code: 'CHARITY_PERCENT_TOO_LOW' });
});

test('subscribers may raise their contribution up to 100%', () => {
  assert.equal(assertValidPercent(35), 35);
  assert.equal(assertValidPercent(100), 100);
  assert.throws(() => assertValidPercent(101), { code: 'CHARITY_PERCENT_TOO_HIGH' });
});

test('percentage must be a whole number', () => {
  assert.throws(() => assertValidPercent(12.5), { code: 'INVALID_CHARITY_PERCENT' });
  assert.throws(() => assertValidPercent('20'), { code: 'INVALID_CHARITY_PERCENT' });
  assert.throws(() => assertValidPercent(Number.NaN), { code: 'INVALID_CHARITY_PERCENT' });
});

test('a payment splits into charity, prize fund and platform without losing a penny', () => {
  const split = splitContribution({ amountMinor: 1200, charityPercent: 10, prizeShare: 0.5 });
  assert.equal(split.charityMinor, 120);
  assert.equal(split.prizeMinor + split.platformMinor, 1080);
  assert.equal(split.charityMinor + split.prizeMinor + split.platformMinor, 1200);
});

test('a 100% contribution leaves nothing for the prize fund', () => {
  const split = splitContribution({ amountMinor: 1200, charityPercent: 100 });
  assert.equal(split.charityMinor, 1200);
  assert.equal(split.prizeMinor, 0);
  assert.equal(split.platformMinor, 0);
});

test('annualised impact multiplies a monthly plan by twelve', () => {
  assert.equal(annualisedCharityImpact({ amountMinor: 1200, charityPercent: 25, interval: 'monthly' }), 3600);
  assert.equal(annualisedCharityImpact({ amountMinor: 12000, charityPercent: 25, interval: 'yearly' }), 3000);
});
