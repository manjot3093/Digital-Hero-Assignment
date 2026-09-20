import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

const handler = (_req, res) =>
  res.status(429).json({
    success: false,
    message: 'Too many requests. Wait a moment and try again.',
    code: 'RATE_LIMITED',
    errors: [],
  });

const base = { standardHeaders: true, legacyHeaders: false, handler };

/** Broad limit on the whole API. */
export const apiLimiter = rateLimit({ ...base, windowMs: env.rateLimit.windowMs, max: env.rateLimit.max });

/** Tight limit on credential endpoints to blunt password spraying. */
export const authLimiter = rateLimit({
  ...base,
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  skipSuccessfulRequests: true,
});

/** Uploads are expensive; keep them slow. */
export const uploadLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, max: 20 });

/** Checkout creation hits the payment gateway, so it gets its own budget. */
export const checkoutLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, max: 15 });
