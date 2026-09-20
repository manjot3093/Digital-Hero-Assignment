import authService from '../services/authService.js';
import userRepository from '../repositories/userRepository.js';
import subscriptionRepository from '../repositories/subscriptionRepository.js';
import { isEntitled, deriveStatus } from '../domain/subscriptions/subscriptionRules.js';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';

function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[env.cookieName] ?? null;
}

/** Populates req.user from an HTTP-only cookie or a bearer token. */
export async function authenticate(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw AppError.unauthorized();

    const payload = authService.verifyToken(token);
    const user = await userRepository.findById(payload.sub);
    if (!user) throw AppError.unauthorized('Account not found.', 'USER_NOT_FOUND');
    if (user.status !== 'active') throw AppError.forbidden('This account is not active.', 'ACCOUNT_INACTIVE');

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/** Attaches req.user when a token is present but never rejects the request. */
export async function optionalAuth(req, _res, next) {
  try {
    const token = extractToken(req);
    if (token) {
      const payload = authService.verifyToken(token);
      req.user = await userRepository.findById(payload.sub);
    }
  } catch {
    req.user = null;
  }
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('This area is for administrators.', 'INSUFFICIENT_ROLE'));
    }
    return next();
  };
}

/**
 * Re-derives subscription status on every protected request (PRD §04) rather
 * than trusting a flag set at login. Admins pass through.
 */
export async function requireSubscription(req, _res, next) {
  try {
    if (!req.user) throw AppError.unauthorized();
    if (req.user.role === 'admin') return next();

    const subscription = await subscriptionRepository.findByUser(req.user.id);
    const shaped = {
      status: subscription?.status,
      currentPeriodEnd: subscription?.current_period_end,
    };

    if (!isEntitled(shaped)) {
      throw new AppError('Your membership is not active. Start or renew it to continue.', {
        status: 402,
        code: 'SUBSCRIPTION_REQUIRED',
        errors: [{ status: deriveStatus(shaped) ?? 'none' }],
      });
    }

    req.subscription = subscription;
    return next();
  } catch (error) {
    return next(error);
  }
}

export default authenticate;
