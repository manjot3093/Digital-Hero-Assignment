import userService from '../services/userService.js';
import drawService from '../services/drawService.js';
import winnerService from '../services/winnerService.js';
import reportService from '../services/reportService.js';
import charityRepository from '../repositories/charityRepository.js';
import subscriptionRepository from '../repositories/subscriptionRepository.js';
import scoreRepository from '../repositories/scoreRepository.js';
import drawRepository from '../repositories/drawRepository.js';
import auditRepository from '../repositories/auditRepository.js';
import scoreService from '../services/scoreService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ok, created, paginated } from '../utils/apiResponse.js';

const actorOf = (req) => ({ id: req.user.id, email: req.user.email });

export const adminController = {
  // ------------------------------------------------------------ dashboard --
  overview: asyncHandler(async (_req, res) => ok(res, await reportService.overview())),
  charts: asyncHandler(async (_req, res) => ok(res, await reportService.charts())),

  auditLog: asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const { rows, total } = await auditRepository.list({ page: q.page, pageSize: q.pageSize });
    return paginated(res, rows, { page: q.page, pageSize: q.pageSize, total: Number(total) });
  }),

  // ---------------------------------------------------------------- users --
  listUsers: asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const { users, total } = await userService.adminList({
      search: q.search, role: q.role ?? null, status: q.status ?? null, page: q.page, pageSize: q.pageSize,
    });
    return paginated(res, users, { page: q.page, pageSize: q.pageSize, total: Number(total) });
  }),

  setUserStatus: asyncHandler(async (req, res) =>
    ok(res, { user: await userService.setStatus(req.params.id, req.body.status, actorOf(req)) }, 'Account updated.')
  ),

  // -------------------------------------------------------- subscriptions --
  listSubscriptions: asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const { rows, total } = await subscriptionRepository.adminList({
      status: q.status ?? null, page: q.page, pageSize: q.pageSize,
    });
    return paginated(res, rows, { page: q.page, pageSize: q.pageSize, total: Number(total) });
  }),

  // --------------------------------------------------------------- scores --
  listScores: asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const { rows, total } = await scoreRepository.adminList({ search: q.search, page: q.page, pageSize: q.pageSize });
    return paginated(res, rows, { page: q.page, pageSize: q.pageSize, total: Number(total) });
  }),

  /** Admins may correct a member's score; the same rolling rules apply. */
  updateScore: asyncHandler(async (req, res) => {
    const existing = await scoreRepository.findById(req.params.id);
    const score = await scoreService.update(existing.user_id, req.params.id, req.body);
    await auditRepository.record({
      ...actorOf(req), actorId: req.user.id, actorEmail: req.user.email,
      action: 'score.admin_edit', entityType: 'score', entityId: req.params.id, metadata: req.body,
    });
    return ok(res, { score }, 'Score updated.');
  }),

  deleteScore: asyncHandler(async (req, res) => {
    const existing = await scoreRepository.findById(req.params.id);
    await scoreService.remove(existing.user_id, req.params.id);
    await auditRepository.record({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'score.admin_delete', entityType: 'score', entityId: req.params.id, metadata: {},
    });
    return ok(res, {}, 'Score deleted.');
  }),

  // ---------------------------------------------------------------- draws --
  listDraws: asyncHandler(async (_req, res) => ok(res, { draws: await drawService.list({ limit: 36 }) })),

  drawDetail: asyncHandler(async (req, res) => {
    const detail = await drawService.detail(req.params.id);
    const simulations = await drawRepository.simulations(req.params.id);
    return ok(res, { ...detail, simulations });
  }),

  createDraw: asyncHandler(async (req, res) =>
    created(res, { draw: await drawService.createNext({ ...req.body, actor: actorOf(req) }) }, 'Draw created.')
  ),

  configureDraw: asyncHandler(async (req, res) =>
    ok(res, { draw: await drawService.configure(req.params.id, { ...req.body, actor: actorOf(req) }) }, 'Draw updated.')
  ),

  refreshEntries: asyncHandler(async (req, res) =>
    ok(res, await drawService.refreshEntries(req.params.id), 'Entries rebuilt from current members.')
  ),

  /** Dry run — writes only to draw_simulations. */
  simulateDraw: asyncHandler(async (req, res) =>
    ok(res, await drawService.simulate(req.params.id, { ...req.body, actor: actorOf(req) }),
      'Simulation complete. Nothing has been committed.')
  ),

  /** The only call that commits results, tiers, winners and the rollover. */
  publishDraw: asyncHandler(async (req, res) =>
    ok(res, await drawService.publish(req.params.id, { ...req.body, actor: actorOf(req) }), 'Draw published.')
  ),

  // ------------------------------------------------------------ charities --
  listCharities: asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const { rows, total } = await charityRepository.list({
      search: q.search, page: q.page, pageSize: q.pageSize,
    });
    return paginated(res, rows, { page: q.page, pageSize: q.pageSize, total: Number(total) });
  }),

  createCharity: asyncHandler(async (req, res) => {
    const charity = await charityRepository.create(req.body);
    await auditRepository.record({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'charity.create', entityType: 'charity', entityId: charity.id, metadata: { name: charity.name },
    });
    return created(res, { charity }, `${charity.name} added to the directory.`);
  }),

  updateCharity: asyncHandler(async (req, res) => {
    const charity = await charityRepository.update(req.params.id, req.body);
    await auditRepository.record({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'charity.update', entityType: 'charity', entityId: req.params.id, metadata: {},
    });
    return ok(res, { charity }, 'Charity updated.');
  }),

  deactivateCharity: asyncHandler(async (req, res) => {
    const charity = await charityRepository.deactivate(req.params.id);
    await auditRepository.record({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'charity.deactivate', entityType: 'charity', entityId: req.params.id, metadata: {},
    });
    return ok(res, { charity }, 'Charity removed from the directory.');
  }),

  addCharityEvent: asyncHandler(async (req, res) =>
    created(res, { event: await charityRepository.addEvent(req.params.id, req.body) }, 'Event added.')
  ),

  // -------------------------------------------------------------- winners --
  listWinners: asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const { winners, total } = await winnerService.adminList({
      state: q.state ?? null, page: q.page, pageSize: q.pageSize,
    });
    return paginated(res, winners, { page: q.page, pageSize: q.pageSize, total: Number(total) });
  }),

  winnerProof: asyncHandler(async (req, res) => ok(res, await winnerService.proofUrl(req.params.id))),

  startReview: asyncHandler(async (req, res) =>
    ok(res, { winner: await winnerService.startReview(req.params.id, { actor: actorOf(req) }) }, 'Review started.')
  ),

  verifyWinner: asyncHandler(async (req, res) =>
    ok(res, { winner: await winnerService.approve(req.params.id, { actor: actorOf(req), notes: req.body.notes }) },
      'Proof approved. The payout is now pending.')
  ),

  rejectWinner: asyncHandler(async (req, res) =>
    ok(res, { winner: await winnerService.reject(req.params.id, { actor: actorOf(req), notes: req.body.notes }) },
      'Proof rejected. The member can upload a new screenshot.')
  ),

  payoutWinner: asyncHandler(async (req, res) =>
    ok(res, { winner: await winnerService.markPaid(req.params.id, { actor: actorOf(req), ...req.body }) },
      'Payout marked as paid.')
  ),
};

export default adminController;
