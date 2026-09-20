import userService from '../services/userService.js';
import charityService from '../services/charityService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';

export const userController = {
  me: asyncHandler(async (req, res) => ok(res, { user: await userService.me(req.user.id) })),

  updateProfile: asyncHandler(async (req, res) =>
    ok(res, { user: await userService.updateProfile(req.user.id, req.body) }, 'Profile updated.')
  ),

  selectCharity: asyncHandler(async (req, res) => {
    const result = await charityService.selectForUser(req.user.id, req.body);
    return ok(res, result, `You are now supporting ${result.charity.name}.`);
  }),
};

export default userController;
