import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import userRepository from '../repositories/userRepository.js';
import auditRepository from '../repositories/auditRepository.js';

const SALT_ROUNDS = 12;

export const authService = {
  async hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
  },

  signToken(user) {
    return jwt.sign(
      { sub: user.id, role: user.role ?? 'subscriber', email: user.email },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn, issuer: 'digital-heroes' }
    );
  },

  verifyToken(token) {
    try {
      return jwt.verify(token, env.jwtSecret, { issuer: 'digital-heroes' });
    } catch {
      throw AppError.unauthorized('Your session has expired. Sign in again.', 'INVALID_TOKEN');
    }
  },

  async register({ email, password, firstName, lastName, homeClub, handicap }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw AppError.conflict('An account with that email already exists.', 'EMAIL_TAKEN');
    }
    const passwordHash = await this.hashPassword(password);
    const user = await userRepository.create({ email, passwordHash, firstName, lastName, homeClub, handicap });
    const fresh = await userRepository.findById(user.id);
    return { user: fresh, token: this.signToken(fresh) };
  },

  async login({ email, password, ip }) {
    const record = await userRepository.findByEmail(email);
    // Compare against a dummy hash when the user is missing so the response
    // time does not reveal whether an email is registered.
    const hash = record?.password_hash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const matches = await bcrypt.compare(password, hash);

    if (!record || !matches) {
      throw AppError.unauthorized('That email and password do not match.', 'INVALID_CREDENTIALS');
    }
    if (record.status === 'suspended') {
      throw AppError.forbidden('This account is suspended. Contact support.', 'ACCOUNT_SUSPENDED');
    }

    await userRepository.touchLogin(record.id);
    await auditRepository.record({
      actorId: record.id, actorEmail: record.email, action: 'auth.login',
      entityType: 'user', entityId: record.id, ipAddress: ip ?? null,
    });

    const { password_hash: _ignored, ...user } = record;
    return { user, token: this.signToken(user) };
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const record = await userRepository.findByEmail((await userRepository.findById(userId))?.email ?? '');
    if (!record) throw AppError.notFound('Account not found.', 'USER_NOT_FOUND');
    const matches = await bcrypt.compare(currentPassword, record.password_hash);
    if (!matches) throw AppError.badRequest('Your current password is not correct.', 'INVALID_CREDENTIALS');
    await userRepository.updatePassword(userId, await this.hashPassword(newPassword));
    return true;
  },

  cookieOptions() {
    return {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };
  },
};

export default authService;
