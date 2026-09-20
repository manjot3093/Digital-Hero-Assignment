/**
 * Payment provider contract.
 *
 *   PaymentProvider
 *     ├── StripeProvider   (live implementation, test mode)
 *     └── <FutureProvider> (any other PCI-compliant gateway)
 *
 * Services only ever talk to this interface, so swapping gateway means writing
 * one new subclass and changing PAYMENT_PROVIDER in the environment.
 */
export class PaymentProvider {
  get name() {
    throw new Error('name must be implemented');
  }

  /** @returns {Promise<{url: string, sessionId: string}>} */
  // eslint-disable-next-line no-unused-vars
  async createCheckoutSession(_params) {
    throw new Error('createCheckoutSession must be implemented');
  }

  /** @returns {Promise<{url: string}>} customer self-service portal */
  // eslint-disable-next-line no-unused-vars
  async createBillingPortalSession(_params) {
    throw new Error('createBillingPortalSession must be implemented');
  }

  /** @returns {Promise<object>} normalised subscription */
  // eslint-disable-next-line no-unused-vars
  async getSubscription(_providerSubscriptionId) {
    throw new Error('getSubscription must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async cancelSubscription(_providerSubscriptionId, _options) {
    throw new Error('cancelSubscription must be implemented');
  }

  /** @returns {Promise<{url: string, paymentId: string}>} one-off donation */
  // eslint-disable-next-line no-unused-vars
  async createDonationSession(_params) {
    throw new Error('createDonationSession must be implemented');
  }

  /**
   * Verifies the signature and returns a provider-neutral event:
   * { id, type, data }. Throws when the signature does not verify.
   */
  // eslint-disable-next-line no-unused-vars
  verifyWebhook(_rawBody, _signature) {
    throw new Error('verifyWebhook must be implemented');
  }
}

/** Provider-neutral event names the SubscriptionService understands. */
export const PAYMENT_EVENTS = Object.freeze({
  CHECKOUT_COMPLETED: 'checkout.completed',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  DONATION_SUCCEEDED: 'donation.succeeded',
  UNKNOWN: 'unknown',
});

export default PaymentProvider;
