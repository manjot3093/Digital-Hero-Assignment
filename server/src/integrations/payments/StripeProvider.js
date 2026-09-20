import Stripe from 'stripe';
import { PaymentProvider, PAYMENT_EVENTS } from './PaymentProvider.js';
import AppError from '../../utils/AppError.js';
import logger from '../../utils/logger.js';

/**
 * Stripe implementation, used in test mode for this build.
 *
 * Nothing outside this file knows what a Stripe object looks like: every
 * method translates to and from the platform's own vocabulary.
 */
export class StripeProvider extends PaymentProvider {
  constructor({ secretKey, webhookSecret, currency = 'GBP', clientUrl }) {
    super();
    this.webhookSecret = webhookSecret;
    this.currency = currency.toLowerCase();
    this.clientUrl = clientUrl;
    this.enabled = Boolean(secretKey);
    this.stripe = this.enabled ? new Stripe(secretKey, { apiVersion: '2024-06-20' }) : null;
    if (!this.enabled) {
      logger.warn('STRIPE_SECRET_KEY is not set — checkout calls will be rejected.');
    }
  }

  get name() {
    return 'stripe';
  }

  #assertEnabled() {
    if (!this.enabled) {
      throw new AppError('Payments are not configured on this environment.', {
        status: 503,
        code: 'PAYMENTS_UNAVAILABLE',
      });
    }
  }

  async createCheckoutSession({ user, plan, successUrl, cancelUrl, metadata = {} }) {
    this.#assertEnabled();
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [
        plan.provider_price_id
          ? { price: plan.provider_price_id, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: this.currency,
                unit_amount: plan.amount_minor,
                recurring: { interval: plan.interval === 'yearly' ? 'year' : 'month' },
                product_data: { name: `Digital Heroes — ${plan.name}` },
              },
            },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: { metadata: { userId: user.id, planCode: plan.code, ...metadata } },
      metadata: { userId: user.id, planCode: plan.code, ...metadata },
    });
    return { url: session.url, sessionId: session.id };
  }

  async createBillingPortalSession({ customerId, returnUrl }) {
    this.#assertEnabled();
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  async createDonationSession({ charity, amountMinor, successUrl, cancelUrl, metadata = {} }) {
    this.#assertEnabled();
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: this.currency,
            unit_amount: amountMinor,
            product_data: { name: `Donation — ${charity.name}` },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { kind: 'donation', charityId: charity.id, ...metadata },
    });
    return { url: session.url, paymentId: session.id };
  }

  async getSubscription(providerSubscriptionId) {
    this.#assertEnabled();
    const subscription = await this.stripe.subscriptions.retrieve(providerSubscriptionId);
    return this.#normaliseSubscription(subscription);
  }

  async cancelSubscription(providerSubscriptionId, { immediately = false } = {}) {
    this.#assertEnabled();
    const subscription = immediately
      ? await this.stripe.subscriptions.cancel(providerSubscriptionId)
      : await this.stripe.subscriptions.update(providerSubscriptionId, { cancel_at_period_end: true });
    return this.#normaliseSubscription(subscription);
  }

  verifyWebhook(rawBody, signature) {
    this.#assertEnabled();
    if (!this.webhookSecret) {
      throw new AppError('Webhook secret is not configured.', { status: 500, code: 'WEBHOOK_MISCONFIGURED' });
    }
    let event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (error) {
      throw new AppError('Webhook signature verification failed.', {
        status: 400,
        code: 'INVALID_WEBHOOK_SIGNATURE',
        cause: error,
      });
    }
    return this.#normaliseEvent(event);
  }

  #normaliseSubscription(subscription) {
    return {
      providerSubscriptionId: subscription.id,
      providerCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
      providerStatus: subscription.status,
      currentPeriodStart: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000)
        : null,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      planCode: subscription.metadata?.planCode ?? null,
      userId: subscription.metadata?.userId ?? null,
    };
  }

  #normaliseEvent(event) {
    const object = event.data?.object ?? {};
    const base = { id: event.id, providerType: event.type, raw: event };

    switch (event.type) {
      case 'checkout.session.completed':
        if (object.metadata?.kind === 'donation') {
          return {
            ...base,
            type: PAYMENT_EVENTS.DONATION_SUCCEEDED,
            data: {
              paymentId: object.id,
              charityId: object.metadata?.charityId,
              amountMinor: object.amount_total,
            },
          };
        }
        return {
          ...base,
          type: PAYMENT_EVENTS.CHECKOUT_COMPLETED,
          data: {
            userId: object.client_reference_id ?? object.metadata?.userId,
            planCode: object.metadata?.planCode,
            providerCustomerId: object.customer,
            providerSubscriptionId: object.subscription,
            amountMinor: object.amount_total,
            currency: (object.currency ?? this.currency).toUpperCase(),
          },
        };

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return { ...base, type: PAYMENT_EVENTS.SUBSCRIPTION_UPDATED, data: this.#normaliseSubscription(object) };

      case 'customer.subscription.deleted':
        return { ...base, type: PAYMENT_EVENTS.SUBSCRIPTION_CANCELLED, data: this.#normaliseSubscription(object) };

      case 'invoice.payment_succeeded':
        return {
          ...base,
          type: PAYMENT_EVENTS.PAYMENT_SUCCEEDED,
          data: {
            providerPaymentId: object.id,
            providerSubscriptionId: object.subscription,
            providerCustomerId: object.customer,
            amountMinor: object.amount_paid,
            currency: (object.currency ?? this.currency).toUpperCase(),
            paidAt: object.status_transitions?.paid_at ? new Date(object.status_transitions.paid_at * 1000) : new Date(),
          },
        };

      case 'invoice.payment_failed':
        return {
          ...base,
          type: PAYMENT_EVENTS.PAYMENT_FAILED,
          data: {
            providerPaymentId: object.id,
            providerSubscriptionId: object.subscription,
            amountMinor: object.amount_due,
            currency: (object.currency ?? this.currency).toUpperCase(),
            reason: object.last_finalization_error?.message ?? 'Card payment failed.',
          },
        };

      default:
        return { ...base, type: PAYMENT_EVENTS.UNKNOWN, data: object };
    }
  }
}

export default StripeProvider;
