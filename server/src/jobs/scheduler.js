import logger from '../utils/logger.js';
import subscriptionService from '../services/subscriptionService.js';
import drawService from '../services/drawService.js';
import drawRepository from '../repositories/drawRepository.js';
import env from '../config/env.js';

/**
 * In-process scheduler for the MVP.
 *
 * Each job is a plain async function with no Express dependency, so moving to
 * BullMQ/pg-boss later means registering the same functions as queue workers —
 * the job bodies do not change. Nothing here publishes a draw: publication
 * stays a deliberate admin action (PRD §06).
 */
const HOURLY = 60 * 60 * 1000;

export const jobs = {
  /** Drops access for memberships whose paid period has ended. */
  async expireLapsedSubscriptions() {
    return subscriptionService.expireLapsed();
  },

  /** Keeps the advertised prize pool in step with live subscriber numbers. */
  async recalculatePrizePool() {
    const current = await drawRepository.current();
    if (!current) return 0;
    const pool = await drawService.projectPool(current.id, current.carried_in_minor);
    await drawRepository.upsertPool(current.id, {
      subscriberCount: pool.subscriberCount,
      contributionMinor: pool.contributionMinor,
      carryOverMinor: pool.carryOverMinor,
      totalMinor: pool.totalMinor,
    });
    return pool.totalMinor;
  },

  /** Opens next month's draw so entries can accumulate. */
  async ensureNextDraw() {
    const current = await drawRepository.current();
    if (current) return null;
    return drawService.createNext({ strategy: 'random' });
  },

  /** Locks a draw once its entry window closes, ready for simulation. */
  async lockClosedDraws() {
    const current = await drawRepository.current();
    if (!current) return false;
    if (current.status === 'open' && new Date(current.entries_close_at) < new Date()) {
      await drawRepository.updateConfig(current.id, { status: 'locked' });
      await drawService.refreshEntries(current.id);
      return true;
    }
    return false;
  },
};

async function runSafely(name, job) {
  try {
    const result = await job();
    logger.debug(`Job ${name} finished`, { result });
  } catch (error) {
    logger.error(`Job ${name} failed`, { message: error.message });
  }
}

export function startScheduledJobs() {
  if (env.isTest || process.env.DISABLE_JOBS === 'true') return () => {};

  const timer = setInterval(async () => {
    await runSafely('expireLapsedSubscriptions', jobs.expireLapsedSubscriptions);
    await runSafely('recalculatePrizePool', jobs.recalculatePrizePool);
    await runSafely('ensureNextDraw', jobs.ensureNextDraw);
    await runSafely('lockClosedDraws', jobs.lockClosedDraws);
  }, HOURLY);

  timer.unref();
  logger.info('Scheduled jobs started (hourly).');
  return () => clearInterval(timer);
}

export default startScheduledJobs;
