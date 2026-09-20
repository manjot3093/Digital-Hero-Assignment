import { Router } from 'express';
import { z } from 'zod';
import adminController from '../controllers/adminController.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import {
  paginationSchema, drawCreateSchema, drawConfigureSchema, drawSimulateSchema, drawPublishSchema,
  winnerReviewSchema, winnerRejectSchema, payoutSchema, charityAdminSchema, charityEventSchema,
  userStatusSchema, scoreUpdateSchema, uuid,
} from '../validators/schemas.js';

const router = Router();
const idParam = z.object({ id: uuid });

// Role enforcement lives here, at the API boundary — hiding admin links in the
// client is presentation, not security.
router.use(authenticate, requireRole('admin'));

// dashboard & reports
router.get('/overview', adminController.overview);
router.get('/reports', adminController.charts);
router.get('/audit', validate({ query: paginationSchema }), adminController.auditLog);

// users & subscriptions
router.get('/users', validate({ query: paginationSchema }), adminController.listUsers);
router.patch('/users/:id/status', validate({ params: idParam, body: userStatusSchema }), adminController.setUserStatus);
router.get('/subscriptions', validate({ query: paginationSchema }), adminController.listSubscriptions);

// scores
router.get('/scores', validate({ query: paginationSchema }), adminController.listScores);
router.put('/scores/:id', validate({ params: idParam, body: scoreUpdateSchema }), adminController.updateScore);
router.delete('/scores/:id', validate({ params: idParam }), adminController.deleteScore);

// draws
router.get('/draws', adminController.listDraws);
router.post('/draws', validate({ body: drawCreateSchema }), adminController.createDraw);
router.get('/draws/:id', validate({ params: idParam }), adminController.drawDetail);
router.patch('/draws/:id', validate({ params: idParam, body: drawConfigureSchema }), adminController.configureDraw);
router.post('/draws/:id/entries', validate({ params: idParam }), adminController.refreshEntries);
router.post('/draws/:id/simulate', validate({ params: idParam, body: drawSimulateSchema }), adminController.simulateDraw);
router.post('/draws/:id/publish', validate({ params: idParam, body: drawPublishSchema }), adminController.publishDraw);

// charities
router.get('/charities', validate({ query: paginationSchema }), adminController.listCharities);
router.post('/charities', validate({ body: charityAdminSchema }), adminController.createCharity);
router.put('/charities/:id', validate({ params: idParam, body: charityAdminSchema.partial() }), adminController.updateCharity);
router.delete('/charities/:id', validate({ params: idParam }), adminController.deactivateCharity);
router.post('/charities/:id/events', validate({ params: idParam, body: charityEventSchema }), adminController.addCharityEvent);

// winners
router.get('/winners', validate({ query: paginationSchema }), adminController.listWinners);
router.get('/winners/:id/proof', validate({ params: idParam }), adminController.winnerProof);
router.post('/winners/:id/review', validate({ params: idParam }), adminController.startReview);
router.post('/winners/:id/verify', validate({ params: idParam, body: winnerReviewSchema }), adminController.verifyWinner);
router.post('/winners/:id/reject', validate({ params: idParam, body: winnerRejectSchema }), adminController.rejectWinner);
router.post('/winners/:id/payout', validate({ params: idParam, body: payoutSchema }), adminController.payoutWinner);

export default router;
