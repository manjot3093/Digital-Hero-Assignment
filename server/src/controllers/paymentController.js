import subscriptionService from '../services/subscriptionService.js';
import { paymentProvider } from '../integrations/payments/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

export const paymentController = {
  /**
   * Gateway webhook. The raw body is required for signature verification, so
   * this route is mounted before the JSON body parser.
   */
  webhook: asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) throw AppError.badRequest('Missing webhook signature.', 'MISSING_SIGNATURE');

    const event = paymentProvider().verifyWebhook(req.body, signature);
    const result = await subscriptionService.handleWebhookEvent(event);

    logger.info('Webhook processed', { type: event.type, duplicate: Boolean(result.duplicate) });
    // Always 200 once verified, so the gateway stops retrying.
    return res.status(200).json({ received: true, duplicate: Boolean(result.duplicate) });
  }),
};

export default paymentController;
