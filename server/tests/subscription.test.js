import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUBSCRIPTION_STATUS,
  isEntitled,
  deriveStatus,
  monthlyValueMinor,
  fromProviderStatus,
} from '../src/domain/subscriptions/subscriptionRules.js';

const NOW = new Date('2026-05-20T12:00:00Z');
const future = '2026-06-20T12:00:00Z';
const past = '2026-04-20T12:00:00Z';

test('an active subscription inside its period is entitled', () => {
  assert.equal(isEntitled({ status: SUBSCRIPTION_STATUS.ACTIVE, currentPeriodEnd: future }, NOW), true);
});

test('an active subscription past its period end is not entitled', () => {
  assert.equal(isEntitled({ status: SUBSCRIPTION_STATUS.ACTIVE, currentPeriodEnd: past }, NOW), false);
  assert.equal(
    deriveStatus({ status: SUBSCRIPTION_STATUS.ACTIVE, currentPeriodEnd: past }, NOW),
    SUBSCRIPTION_STATUS.EXPIRED
  );
});

test('a cancelled subscription keeps access until the paid period ends', () => {
  assert.equal(isEntitled({ status: SUBSCRIPTION_STATUS.CANCELLED, currentPeriodEnd: future }, NOW), true);
  assert.equal(isEntitled({ status: SUBSCRIPTION_STATUS.CANCELLED, currentPeriodEnd: past }, NOW), false);
});

test('past_due keeps access during the retry window but incomplete does not', () => {
  assert.equal(isEntitled({ status: SUBSCRIPTION_STATUS.PAST_DUE, currentPeriodEnd: future }, NOW), true);
  assert.equal(isEntitled({ status: SUBSCRIPTION_STATUS.INCOMPLETE, currentPeriodEnd: future }, NOW), false);
});

test('no subscription means no entitlement', () => {
  assert.equal(isEntitled(null, NOW), false);
  assert.equal(isEntitled(undefined, NOW), false);
});

test('a yearly plan is normalised to a monthly value for pool maths', () => {
  assert.equal(monthlyValueMinor({ amountMinor: 12000, interval: 'yearly' }), 1000);
  assert.equal(monthlyValueMinor({ amountMinor: 1200, interval: 'monthly' }), 1200);
});

test('provider statuses map onto the platform vocabulary', () => {
  assert.equal(fromProviderStatus('active'), SUBSCRIPTION_STATUS.ACTIVE);
  assert.equal(fromProviderStatus('trialing'), SUBSCRIPTION_STATUS.ACTIVE);
  assert.equal(fromProviderStatus('past_due'), SUBSCRIPTION_STATUS.PAST_DUE);
  assert.equal(fromProviderStatus('canceled'), SUBSCRIPTION_STATUS.CANCELLED);
  assert.equal(fromProviderStatus('incomplete'), SUBSCRIPTION_STATUS.INCOMPLETE);
  assert.equal(fromProviderStatus('something_new'), SUBSCRIPTION_STATUS.INCOMPLETE);
});
