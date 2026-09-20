import winnerService from '../services/winnerService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';

export const winnerController = {
  mine: asyncHandler(async (req, res) => ok(res, {
    winnings: await winnerService.listForUser(req.user.id),
    summary: await winnerService.summaryForUser(req.user.id),
  })),

  uploadProof: asyncHandler(async (req, res) =>
    ok(res, await winnerService.submitProof({
      winnerId: req.params.id,
      userId: req.user.id,
      file: req.file,
    }), 'Proof uploaded. An administrator will review it shortly.')
  ),
};

export default winnerController;
