import scoreService from '../services/scoreService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ok, created, noContent } from '../utils/apiResponse.js';

export const scoreController = {
  list: asyncHandler(async (req, res) => ok(res, await scoreService.list(req.user.id))),

  create: asyncHandler(async (req, res) => {
    const { score, evicted } = await scoreService.add(req.user.id, req.body);
    const message = evicted.length
      ? 'Score saved. Your oldest round dropped off to keep the last five.'
      : 'Score saved.';
    return created(res, { score, evicted }, message);
  }),

  update: asyncHandler(async (req, res) =>
    ok(res, { score: await scoreService.update(req.user.id, req.params.id, req.body) }, 'Score updated.')
  ),

  remove: asyncHandler(async (req, res) => {
    await scoreService.remove(req.user.id, req.params.id);
    return noContent(res);
  }),
};

export default scoreController;
