import drawService from '../services/drawService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';

export const drawController = {
  list: asyncHandler(async (req, res) => ok(res, { draws: await drawService.list(req.validatedQuery ?? {}) })),

  current: asyncHandler(async (_req, res) => ok(res, await drawService.current() ?? {})),

  detail: asyncHandler(async (req, res) => ok(res, await drawService.detail(req.params.id))),

  myParticipation: asyncHandler(async (req, res) =>
    ok(res, { entries: await drawService.participationForUser(req.user.id) })
  ),
};

export default drawController;
