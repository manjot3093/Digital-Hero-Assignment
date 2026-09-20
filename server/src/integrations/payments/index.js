import env from '../../config/env.js';
import { StripeProvider } from './StripeProvider.js';

const providers = {
  stripe: () =>
    new StripeProvider({
      secretKey: env.payments.stripeSecretKey,
      webhookSecret: env.payments.stripeWebhookSecret,
      currency: env.payments.currency,
      clientUrl: env.clientUrl,
    }),
};

let instance = null;

/** Resolves the configured gateway once and reuses it. */
export function paymentProvider() {
  if (!instance) {
    const factory = providers[env.payments.provider];
    if (!factory) throw new Error(`Unsupported payment provider: ${env.payments.provider}`);
    instance = factory();
  }
  return instance;
}

export function registerPaymentProvider(name, factory) {
  providers[name] = factory;
}

export { PAYMENT_EVENTS } from './PaymentProvider.js';
