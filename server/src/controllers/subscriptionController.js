import subscriptionService from '../services/subscriptionService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';

export const subscriptionController = {
  plans: asyncHandler(async (_req, res) => ok(res, { plans: await subscriptionService.plans() })),

  mine: asyncHandler(async (req, res) => ok(res, await subscriptionService.forUser(req.user.id))),

  checkout: asyncHandler(async (req, res) =>
    ok(res, await subscriptionService.startCheckout(req.user.id, req.body.planCode))
  ),

  portal: asyncHandler(async (req, res) => ok(res, await subscriptionService.billingPortal(req.user.id))),

  cancel: asyncHandler(async (req, res) =>
    ok(res, { subscription: await subscriptionService.cancel(req.user.id) },
      'Your membership will end when the current period finishes.')
  ),
};

export default subscriptionController;
