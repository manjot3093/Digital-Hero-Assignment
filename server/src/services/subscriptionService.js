import subscriptionRepository from '../repositories/subscriptionRepository.js';
import userRepository from '../repositories/userRepository.js';
import charityRepository from '../repositories/charityRepository.js';
import { paymentProvider, PAYMENT_EVENTS } from '../integrations/payments/index.js';
import { splitContribution } from '../domain/charity/contribution.js';
import {
  deriveStatus,
  isEntitled,
  fromProviderStatus,
  SUBSCRIPTION_STATUS,
} from '../domain/subscriptions/subscriptionRules.js';
import { withTransaction } from '../db/pool.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

export const subscriptionService = {
  async plans() {
    const plans = await subscriptionRepository.plans();
    return plans.map((plan) => ({
      ...plan,
      // Shows the subscriber exactly where their money goes.
      allocation: splitContribution({
        amountMinor: plan.amount_minor,
        charityPercent: 10,
        prizeShare: Number(plan.prize_share),
      }),
    }));
  },

  async forUser(userId) {
    const subscription = await subscriptionRepository.findByUser(userId);
    if (!subscription) {
      return { subscription: null, status: null, entitled: false, payments: [] };
    }
    const payments = await subscriptionRepository.paymentsByUser(userId);
    return {
      subscription: { ...subscription, status: deriveStatus(camel(subscription)) },
      status: deriveStatus(camel(subscription)),
      entitled: isEntitled(camel(subscription)),
      payments,
    };
  },

  /**
   * Starts a hosted checkout. The API never marks anything paid here: the
   * subscription only becomes active when the signed webhook arrives.
   */
  async startCheckout(userId, planCode) {
    const [user, plan] = await Promise.all([
      userRepository.findById(userId),
      subscriptionRepository.planByCode(planCode),
    ]);
    if (!user) throw AppError.notFound('Account not found.', 'USER_NOT_FOUND');
    if (!plan) throw AppError.badRequest('That plan is not available.', 'PLAN_NOT_FOUND');

    const existing = await subscriptionRepository.findByUser(userId);
    if (existing && isEntitled(camel(existing))) {
      throw AppError.conflict('You already have an active membership.', 'SUBSCRIPTION_ACTIVE');
    }

    const session = await paymentProvider().createCheckoutSession({
      user,
      plan,
      successUrl: `${env.clientUrl}/dashboard?checkout=success`,
      cancelUrl: `${env.clientUrl}/pricing?checkout=cancelled`,
    });

    return { checkoutUrl: session.url, sessionId: session.sessionId };
  },

  async billingPortal(userId) {
    const subscription = await subscriptionRepository.findByUser(userId);
    if (!subscription?.provider_customer_id) {
      throw AppError.badRequest('There is no billing account to manage yet.', 'NO_BILLING_ACCOUNT');
    }
    const session = await paymentProvider().createBillingPortalSession({
      customerId: subscription.provider_customer_id,
      returnUrl: `${env.clientUrl}/dashboard/subscription`,
    });
    return { portalUrl: session.url };
  },

  async cancel(userId, { immediately = false } = {}) {
    const subscription = await subscriptionRepository.findByUser(userId);
    if (!subscription) throw AppError.notFound('No membership to cancel.', 'SUBSCRIPTION_NOT_FOUND');
    if (subscription.status === SUBSCRIPTION_STATUS.CANCELLED) {
      throw AppError.conflict('That membership is already cancelled.', 'ALREADY_CANCELLED');
    }

    if (subscription.provider_subscription_id) {
      await paymentProvider().cancelSubscription(subscription.provider_subscription_id, { immediately });
    }

    return subscriptionRepository.updateStatus(subscription.id, {
      status: immediately ? SUBSCRIPTION_STATUS.CANCELLED : subscription.status,
      cancelAtPeriodEnd: !immediately,
      cancelledAt: new Date(),
    });
  },

  /**
   * Single entry point for gateway webhooks. Idempotent: a replayed event id is
   * acknowledged and ignored, so Stripe's at-least-once delivery is safe.
   */
  async handleWebhookEvent(event) {
    const provider = paymentProvider().name;

    if (await subscriptionRepository.wasWebhookProcessed(provider, event.id)) {
      logger.info('Duplicate webhook ignored', { eventId: event.id, type: event.type });
      return { duplicate: true };
    }

    try {
      switch (event.type) {
        case PAYMENT_EVENTS.CHECKOUT_COMPLETED:
          await onCheckoutCompleted(event.data);
          break;
        case PAYMENT_EVENTS.SUBSCRIPTION_UPDATED:
          await onSubscriptionUpdated(event.data);
          break;
        case PAYMENT_EVENTS.SUBSCRIPTION_CANCELLED:
          await onSubscriptionCancelled(event.data);
          break;
        case PAYMENT_EVENTS.PAYMENT_SUCCEEDED:
          await onPaymentSucceeded(event.data);
          break;
        case PAYMENT_EVENTS.PAYMENT_FAILED:
          await onPaymentFailed(event.data);
          break;
        case PAYMENT_EVENTS.DONATION_SUCCEEDED:
          await onDonationSucceeded(event.data);
          break;
        default:
          logger.debug('Unhandled webhook type', { type: event.providerType });
      }
    } finally {
      await subscriptionRepository.markWebhookProcessed({
        provider,
        eventId: event.id,
        eventType: event.providerType ?? event.type,
        payload: null,
      });
    }

    return { handled: true };
  },

  /** Nightly sweep so lapsed memberships lose access even without a webhook. */
  async expireLapsed() {
    const count = await subscriptionRepository.expireLapsed();
    if (count) logger.info('Expired lapsed subscriptions', { count });
    return count;
  },
};


/* ------------------------------------------------------------------------ *
 * Webhook handlers.
 *
 * Module-private on purpose: they are implementation details of
 * handleWebhookEvent and must never be called from a controller.
 * ------------------------------------------------------------------------ */

async function onCheckoutCompleted(data) {
  if (!data.userId || !data.providerSubscriptionId) return;
  const plan = await subscriptionRepository.planByCode(data.planCode ?? 'monthly');
  const remote = await paymentProvider().getSubscription(data.providerSubscriptionId);

  await subscriptionRepository.upsertForUser({
    userId: data.userId,
    planId: plan.id,
    status: fromProviderStatus(remote.providerStatus),
    providerCustomerId: data.providerCustomerId ?? remote.providerCustomerId,
    providerSubscriptionId: data.providerSubscriptionId,
    currentPeriodStart: remote.currentPeriodStart,
    currentPeriodEnd: remote.currentPeriodEnd,
    cancelAtPeriodEnd: remote.cancelAtPeriodEnd,
  });
  logger.info('Subscription activated from checkout', { userId: data.userId });
}

async function onSubscriptionUpdated(data) {
  const existing = await subscriptionRepository.findByProviderId(data.providerSubscriptionId);
  if (!existing) {
    if (!data.userId) return;
    const plan = await subscriptionRepository.planByCode(data.planCode ?? 'monthly');
    await subscriptionRepository.upsertForUser({
      userId: data.userId,
      planId: plan.id,
      status: fromProviderStatus(data.providerStatus),
      providerCustomerId: data.providerCustomerId,
      providerSubscriptionId: data.providerSubscriptionId,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    });
    return;
  }
  await subscriptionRepository.updateStatus(existing.id, {
    status: fromProviderStatus(data.providerStatus),
    currentPeriodStart: data.currentPeriodStart,
    currentPeriodEnd: data.currentPeriodEnd,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
  });
}

async function onSubscriptionCancelled(data) {
  const existing = await subscriptionRepository.findByProviderId(data.providerSubscriptionId);
  if (!existing) return;
  await subscriptionRepository.updateStatus(existing.id, {
    status: SUBSCRIPTION_STATUS.CANCELLED,
    cancelledAt: new Date(),
  });
}

/**
 * A successful invoice is the moment the charity split is actually banked.
 * Payment + contribution are written in one transaction so the charity ledger
 * can never disagree with the payment ledger.
 */
async function onPaymentSucceeded(data) {
  const subscription = await subscriptionRepository.findByProviderId(data.providerSubscriptionId);
  if (!subscription) return;
  const user = await userRepository.findById(subscription.user_id);

  const split = splitContribution({
    amountMinor: data.amountMinor,
    charityPercent: user.charity_percent,
    prizeShare: Number(subscription.prize_share ?? env.draw.prizeShare),
  });

  await withTransaction(async (tx) => {
    const payment = await subscriptionRepository.recordPayment({
      userId: user.id,
      subscriptionId: subscription.id,
      providerPaymentId: data.providerPaymentId,
      amountMinor: data.amountMinor,
      currency: data.currency,
      status: 'succeeded',
      charityMinor: split.charityMinor,
      prizeMinor: split.prizeMinor,
      platformMinor: split.platformMinor,
      paidAt: data.paidAt ?? new Date(),
    }, tx);

    // recordPayment returns null when the payment id was already recorded.
    if (payment && user.charity_id) {
      await charityRepository.recordContribution({
        charityId: user.charity_id,
        userId: user.id,
        paymentId: payment.id,
        amountMinor: split.charityMinor,
        percent: user.charity_percent,
        source: 'subscription',
      }, tx);
    }

    await subscriptionRepository.updateStatus(subscription.id, { status: SUBSCRIPTION_STATUS.ACTIVE }, tx);
  });
}

async function onPaymentFailed(data) {
  const subscription = await subscriptionRepository.findByProviderId(data.providerSubscriptionId);
  if (!subscription) return;
  await subscriptionRepository.recordPayment({
    userId: subscription.user_id,
    subscriptionId: subscription.id,
    providerPaymentId: data.providerPaymentId,
    amountMinor: data.amountMinor,
    currency: data.currency,
    status: 'failed',
    failureReason: data.reason,
  });
  await subscriptionRepository.updateStatus(subscription.id, { status: SUBSCRIPTION_STATUS.PAST_DUE });
  logger.warn('Subscription payment failed', { subscriptionId: subscription.id });
}

async function onDonationSucceeded(data) {
  const { donationRepository } = await import('../repositories/donationRepository.js');
  await donationRepository.markSucceeded(data.paymentId);
}


/** Maps a snake_case subscription row onto the domain's camelCase shape. */
function camel(row) {
  return {
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  };
}

export default subscriptionService;
