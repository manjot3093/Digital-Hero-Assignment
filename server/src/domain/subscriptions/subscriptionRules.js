/**
 * Subscription lifecycle (PRD §04).
 *
 * Status is derived, never trusted from the client. The API recomputes access
 * on every authenticated request from the stored status plus the period end,
 * so a lapsed card silently stops granting subscriber features.
 */
export const SUBSCRIPTION_STATUS = Object.freeze({
  INCOMPLETE: 'incomplete',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
});

export const PLAN_INTERVALS = Object.freeze({ MONTHLY: 'monthly', YEARLY: 'yearly' });

/** Statuses that still unlock subscriber-only features. */
const ENTITLED = new Set([SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE]);

/**
 * A cancelled subscription keeps access until the paid period ends — people
 * who already paid for the month should still play out that month's draw.
 */
export function isEntitled(subscription, now = new Date()) {
  if (!subscription) return false;
  const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  if (periodEnd && periodEnd.getTime() < now.getTime()) return false;
  if (subscription.status === SUBSCRIPTION_STATUS.CANCELLED) return Boolean(periodEnd);
  return ENTITLED.has(subscription.status);
}

export function deriveStatus(subscription, now = new Date()) {
  if (!subscription) return null;
  const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  if (periodEnd && periodEnd.getTime() < now.getTime()) {
    return subscription.status === SUBSCRIPTION_STATUS.CANCELLED
      ? SUBSCRIPTION_STATUS.CANCELLED
      : SUBSCRIPTION_STATUS.EXPIRED;
  }
  return subscription.status;
}

/** Normalised monthly value, used by the prize-pool auto-calculation. */
export function monthlyValueMinor({ amountMinor, interval }) {
  if (interval === PLAN_INTERVALS.YEARLY) return Math.round(amountMinor / 12);
  return amountMinor;
}

export function nextRenewal(subscription) {
  return subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
}

/** Maps a Stripe subscription status onto our own vocabulary. */
export function fromProviderStatus(providerStatus) {
  switch (providerStatus) {
    case 'active':
    case 'trialing':
      return SUBSCRIPTION_STATUS.ACTIVE;
    case 'past_due':
    case 'unpaid':
      return SUBSCRIPTION_STATUS.PAST_DUE;
    case 'canceled':
      return SUBSCRIPTION_STATUS.CANCELLED;
    case 'incomplete':
    case 'incomplete_expired':
      return SUBSCRIPTION_STATUS.INCOMPLETE;
    default:
      return SUBSCRIPTION_STATUS.INCOMPLETE;
  }
}
