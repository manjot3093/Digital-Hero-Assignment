import dashboardService from '../services/dashboardService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';

export const dashboardController = {
  overview: asyncHandler(async (req, res) => ok(res, await dashboardService.forUser(req.user.id))),
};

export default dashboardController;
