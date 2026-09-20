import { ZodError } from 'zod';
import multer from 'multer';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

/** Maps PostgreSQL error codes onto friendly, non-leaky messages. */
function fromDatabaseError(error) {
  switch (error.code) {
    case '23505': // unique_violation
      if (error.constraint === 'uq_score_per_user_per_day') {
        return AppError.conflict('A score already exists for that date.', 'DUPLICATE_SCORE_DATE');
      }
      if (error.constraint === 'users_email_key') {
        return AppError.conflict('An account with that email already exists.', 'EMAIL_TAKEN');
      }
      return AppError.conflict('That record already exists.', 'DUPLICATE_RECORD');
    case '23503': // foreign_key_violation
      return AppError.badRequest('A referenced record does not exist.', 'INVALID_REFERENCE');
    case '23514': // check_violation
      return AppError.unprocessable('That value is outside the allowed range.', 'CHECK_VIOLATION');
    case '22P02': // invalid_text_representation (bad uuid)
      return AppError.badRequest('That identifier is not valid.', 'INVALID_IDENTIFIER');
    case 'ECONNREFUSED':
    case '57P01':
      return new AppError('The service is temporarily unavailable. Try again shortly.', {
        status: 503, code: 'DATABASE_UNAVAILABLE',
      });
    default:
      return null;
  }
}

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`No route matches ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  let resolved = error;

  if (error instanceof ZodError) {
    resolved = AppError.unprocessable(
      'Please check the highlighted fields.',
      'VALIDATION_FAILED',
      error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
    );
  } else if (error instanceof multer.MulterError) {
    resolved = error.code === 'LIMIT_FILE_SIZE'
      ? AppError.payloadTooLarge()
      : AppError.badRequest('That upload could not be accepted.', 'INVALID_UPLOAD');
  } else if (!(error instanceof AppError)) {
    resolved = fromDatabaseError(error) ?? null;
  }

  if (!resolved || !(resolved instanceof AppError)) {
    // Unknown failure: log everything, tell the user nothing technical.
    logger.error('Unhandled error', {
      message: error.message,
      stack: env.isProduction ? undefined : error.stack,
      path: req.originalUrl,
    });
    return res.status(500).json({
      success: false,
      message: 'Something went wrong on our side. Try again shortly.',
      code: 'INTERNAL_ERROR',
      errors: [],
    });
  }

  if (resolved.status >= 500) {
    logger.error('Operational failure', { message: resolved.message, code: resolved.code });
  } else {
    logger.debug('Request rejected', { code: resolved.code, path: req.originalUrl });
  }

  return res.status(resolved.status).json({
    success: false,
    message: resolved.message,
    code: resolved.code,
    errors: resolved.errors ?? [],
  });
}

export default errorHandler;
