import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import scoreRoutes from './scoreRoutes.js';
import charityRoutes from './charityRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import drawRoutes from './drawRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import winnerRoutes from './winnerRoutes.js';
import adminRoutes from './adminRoutes.js';
import fileRoutes from './fileRoutes.js';
import reportService from '../services/reportService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { healthCheck } from '../db/pool.js';

const router = Router();

router.get('/health', asyncHandler(async (_req, res) =>
  ok(res, { status: 'ok', database: await healthCheck(), time: new Date().toISOString() })
));

// Public headline figures for the homepage — all database-derived.
router.get('/stats', asyncHandler(async (_req, res) => ok(res, await reportService.publicStats())));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/scores', scoreRoutes);
router.use('/charities', charityRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/draws', drawRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/winners', winnerRoutes);
router.use('/admin', adminRoutes);
router.use('/files', fileRoutes);

export default router;
