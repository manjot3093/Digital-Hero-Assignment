/**
 * Operational errors the API is willing to describe to a caller. Anything that
 * is *not* an AppError is treated as a bug and reduced to a generic 500 so a
 * stack trace never reaches a user.
 */
export class AppError extends Error {
  constructor(message, { status = 400, code = 'BAD_REQUEST', errors = [], cause } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.isOperational = true;
    if (cause) this.cause = cause;
  }

  static badRequest(message, code = 'BAD_REQUEST', errors = []) {
    return new AppError(message, { status: 400, code, errors });
  }

  static unauthorized(message = 'Sign in to continue.', code = 'UNAUTHENTICATED') {
    return new AppError(message, { status: 401, code });
  }

  static forbidden(message = 'You do not have access to this.', code = 'FORBIDDEN') {
    return new AppError(message, { status: 403, code });
  }

  static notFound(message = 'Not found.', code = 'NOT_FOUND') {
    return new AppError(message, { status: 404, code });
  }

  static conflict(message, code = 'CONFLICT') {
    return new AppError(message, { status: 409, code });
  }

  static payloadTooLarge(message = 'That file is too large.', code = 'FILE_TOO_LARGE') {
    return new AppError(message, { status: 413, code });
  }

  static unprocessable(message, code = 'UNPROCESSABLE', errors = []) {
    return new AppError(message, { status: 422, code, errors });
  }
}

export default AppError;
