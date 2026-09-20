import charityService from '../services/charityService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';

export const charityController = {
  directory: asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    return ok(res, await charityService.directory({
      search: q.search,
      category: q.category ?? null,
      featuredOnly: q.featured ?? false,
      page: q.page,
      pageSize: q.pageSize,
    }));
  }),

  profile: asyncHandler(async (req, res) => ok(res, await charityService.profile(req.params.id))),

  impact: asyncHandler(async (_req, res) => ok(res, await charityService.impactTotals())),

  donate: asyncHandler(async (req, res) =>
    ok(res, await charityService.startDonation({ user: req.user, ...req.body }))
  ),
};

export default charityController;
