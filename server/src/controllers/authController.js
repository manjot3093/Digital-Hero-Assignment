import authService from '../services/authService.js';
import userService from '../services/userService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ok, created } from '../utils/apiResponse.js';
import env from '../config/env.js';

/** Controllers stay thin: validate (middleware) → call service → shape response. */
export const authController = {
  register: asyncHandler(async (req, res) => {
    const { user, token } = await authService.register(req.body);
    res.cookie(env.cookieName, token, authService.cookieOptions());
    return created(res, { user, token }, 'Welcome to Digital Heroes.');
  }),

  login: asyncHandler(async (req, res) => {
    const { user, token } = await authService.login({ ...req.body, ip: req.ip });
    res.cookie(env.cookieName, token, authService.cookieOptions());
    return ok(res, { user, token }, 'Signed in.');
  }),

  logout: asyncHandler(async (_req, res) => {
    res.clearCookie(env.cookieName, { ...authService.cookieOptions(), maxAge: undefined });
    return ok(res, {}, 'Signed out.');
  }),

  me: asyncHandler(async (req, res) => ok(res, { user: await userService.me(req.user.id) })),

  changePassword: asyncHandler(async (req, res) => {
    await authService.changePassword(req.user.id, req.body);
    return ok(res, {}, 'Password updated.');
  }),
};

export default authController;
