import { withTransaction } from '../db/pool.js';
import drawRepository from '../repositories/drawRepository.js';
import winnerRepository from '../repositories/winnerRepository.js';
import subscriptionRepository from '../repositories/subscriptionRepository.js';
import scoreRepository from '../repositories/scoreRepository.js';
import auditRepository from '../repositories/auditRepository.js';
import { DrawEngine, buildTicket } from '../domain/draw/DrawEngine.js';
import { calculatePoolFromSubscriptions } from '../domain/draw/PrizeCalculator.js';
import { monthlyValueMinor } from '../domain/subscriptions/subscriptionRules.js';
import { randomSeed } from '../domain/draw/rng.js';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const engine = new DrawEngine();

export const drawService = {
  async list(filters = {}) {
    return drawRepository.list({ status: filters.status ?? null, limit: filters.limit ?? 24 });
  },

  async current() {
    const draw = await drawRepository.current();
    if (!draw) return null;
    const [pool, tiers] = await Promise.all([
      drawRepository.pool(draw.id),
      drawRepository.tiers(draw.id),
    ]);
    // Keep the advertised pool honest between scheduled recalculations.
    const projected = await this.projectPool(draw.id, draw.carried_in_minor);
    return { draw, pool: pool ?? projected, tiers, projected };
  },

  async detail(id) {
    const draw = await drawRepository.findById(id);
    if (!draw) throw AppError.notFound('That draw does not exist.', 'DRAW_NOT_FOUND');
    const [tiers, pool, entries] = await Promise.all([
      drawRepository.tiers(id),
      drawRepository.pool(id),
      drawRepository.entries(id),
    ]);
    const { rows: winners } = await winnerRepository.adminList({ page: 1, pageSize: 100 });
    return {
      draw,
      tiers,
      pool,
      entryCount: entries.length,
      winners: winners.filter((w) => w.draw_id === id),
    };
  },

  /** Recomputes the pool from live subscription revenue. Never hard-coded. */
  async projectPool(drawId, carriedInMinor = 0) {
    const subscriptions = await subscriptionRepository.listEntitled();
    const normalised = subscriptions.map((sub) => ({
      monthlyValueMinor: monthlyValueMinor({ amountMinor: sub.amount_minor, interval: sub.interval }),
      charityPercent: sub.charity_percent,
    }));
    return calculatePoolFromSubscriptions(normalised, {
      prizeShare: env.draw.prizeShare,
      carryOverMinor: Number(carriedInMinor ?? 0),
    });
  },

  /**
   * Builds one entry per entitled subscriber from their retained scores. Called
   * before a simulation so the admin sees exactly the field that will play.
   */
  async refreshEntries(drawId) {
    const draw = await drawRepository.findById(drawId);
    if (!draw) throw AppError.notFound('That draw does not exist.', 'DRAW_NOT_FOUND');
    if (draw.status === 'published') {
      throw AppError.conflict('This draw is published and can no longer change.', 'DRAW_ALREADY_PUBLISHED');
    }

    const participants = await scoreRepository.listForActiveSubscribers();
    const entries = participants.map((participant) => ({
      userId: participant.user_id,
      numbers: buildTicket({
        userId: participant.user_id,
        scores: participant.scores ?? [],
        poolSize: env.draw.ballPoolSize,
        picks: env.draw.numbersPerTicket,
        seed: draw.reference,
      }),
      scoreCount: (participant.scores ?? []).length,
    }));

    await withTransaction(async (tx) => {
      await drawRepository.replaceEntries(drawId, entries, tx);
      const pool = await this.projectPool(drawId, draw.carried_in_minor);
      await drawRepository.upsertPool(drawId, {
        subscriberCount: pool.subscriberCount,
        contributionMinor: pool.contributionMinor,
        carryOverMinor: pool.carryOverMinor,
        totalMinor: pool.totalMinor,
      }, tx);
    });

    return { entryCount: entries.length };
  },

  /**
   * Runs the engine and stores the outcome in draw_simulations only.
   * Nothing in prize_tiers, draw_results, winners or payouts is touched.
   */
  async simulate(drawId, { strategy, seed, actor } = {}) {
    const draw = await drawRepository.findById(drawId);
    if (!draw) throw AppError.notFound('That draw does not exist.', 'DRAW_NOT_FOUND');
    if (draw.status === 'published') {
      throw AppError.conflict('This draw is already published.', 'DRAW_ALREADY_PUBLISHED');
    }

    await this.refreshEntries(drawId);

    const [entries, participants, pool] = await Promise.all([
      drawRepository.entries(drawId),
      scoreRepository.listForActiveSubscribers(),
      this.projectPool(drawId, draw.carried_in_minor),
    ]);

    const result = engine.run({
      strategy: strategy ?? draw.strategy,
      seed: seed ?? randomSeed(),
      entries: entries.map((entry) => ({
        entryId: entry.entry_id,
        userId: entry.user_id,
        numbers: entry.numbers,
        name: `${entry.first_name} ${entry.last_name}`,
        email: entry.email,
      })),
      participants: participants.map((p) => ({ userId: p.user_id, scores: p.scores ?? [] })),
      poolMinor: pool.totalMinor,
      carriedInMinor: pool.carryOverMinor,
    });

    const saved = await drawRepository.saveSimulation({
      drawId,
      createdBy: actor?.id ?? null,
      strategy: result.strategy,
      seed: result.seed,
      result,
    });

    if (draw.status !== 'simulated') {
      await drawRepository.updateConfig(drawId, { status: 'simulated' });
    }

    await auditRepository.record({
      actorId: actor?.id, actorEmail: actor?.email,
      action: 'draw.simulate', entityType: 'draw', entityId: drawId,
      metadata: { seed: result.seed, strategy: result.strategy, numbers: result.numbers },
    });

    return { simulation: { ...saved, result }, draw };
  },

  /**
   * Commits a draw. Everything — results, tiers, winners, the rollover figure
   * and next month's carry-in — is written in one transaction, so a failure
   * halfway through cannot leave half a published draw behind.
   */
  async publish(drawId, { seed, strategy, actor }) {
    return withTransaction(async (tx) => {
      const draw = await drawRepository.findByIdForUpdate(drawId, tx);
      if (!draw) throw AppError.notFound('That draw does not exist.', 'DRAW_NOT_FOUND');
      if (draw.status === 'published') {
        throw AppError.conflict('This draw has already been published.', 'DRAW_ALREADY_PUBLISHED');
      }

      const entries = await drawRepository.entries(drawId, tx);
      if (!entries.length) {
        throw AppError.unprocessable('There are no entries to draw from yet.', 'DRAW_HAS_NO_ENTRIES');
      }

      const storedPool = await drawRepository.pool(drawId, tx);
      const poolMinor = Number(storedPool?.total_minor ?? 0);
      const participants = await scoreRepository.listForActiveSubscribers(tx);

      const result = engine.run({
        strategy: strategy ?? draw.strategy,
        seed: seed ?? randomSeed(),
        entries: entries.map((entry) => ({
          entryId: entry.entry_id,
          userId: entry.user_id,
          numbers: entry.numbers,
        })),
        participants: participants.map((p) => ({ userId: p.user_id, scores: p.scores ?? [] })),
        poolMinor,
        carriedInMinor: Number(storedPool?.carry_over_minor ?? 0),
      });

      const results = await drawRepository.saveResults(drawId, result.awards, tx);
      await drawRepository.saveTiers(drawId, result.tiers, tx);

      const resultByEntry = new Map(results.map((row) => [row.entry_id, row.id]));
      await winnerRepository.createMany(
        drawId,
        result.awards.map((award) => ({
          userId: award.userId,
          matchCount: award.matchCount,
          amountMinor: award.amountMinor,
          resultId: resultByEntry.get(award.entryId) ?? null,
        })),
        tx
      );

      const published = await drawRepository.publish(drawId, {
        seed: result.seed,
        numbers: result.numbers,
        rolloverMinor: result.rolloverMinor,
        publishedBy: actor?.id ?? null,
      }, tx);

      await auditRepository.record({
        actorId: actor?.id, actorEmail: actor?.email,
        action: 'draw.publish', entityType: 'draw', entityId: drawId,
        metadata: {
          seed: result.seed,
          numbers: result.numbers,
          winners: result.awards.length,
          rolloverMinor: result.rolloverMinor,
        },
      }, tx);

      logger.info('Draw published', { drawId, winners: result.awards.length });
      return { draw: published, result };
    });
  },

  /** Creates next month's draw, carrying any unclaimed jackpot forward. */
  async createNext({ periodMonth, strategy = 'random', actor } = {}) {
    const month = periodMonth ? new Date(periodMonth) : nextMonthStart();
    const reference = `DH-${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
    const existing = (await drawRepository.list({ limit: 100 })).find((d) => d.reference === reference);
    if (existing) throw AppError.conflict('A draw already exists for that month.', 'DRAW_EXISTS');

    const latest = await drawRepository.latestPublished();
    const carriedInMinor = Number(latest?.rollover_minor ?? 0);

    const entriesCloseAt = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 20, 0, 0));
    const drawAt = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1, 19, 0, 0));

    const draw = await drawRepository.create({
      reference,
      periodMonth: month.toISOString().slice(0, 10),
      strategy,
      entriesCloseAt,
      drawAt,
      carriedInMinor,
    });

    await auditRepository.record({
      actorId: actor?.id, actorEmail: actor?.email,
      action: 'draw.create', entityType: 'draw', entityId: draw.id,
      metadata: { reference, carriedInMinor },
    });

    return draw;
  },

  async configure(drawId, { strategy, entriesCloseAt, drawAt, actor }) {
    const draw = await drawRepository.findById(drawId);
    if (!draw) throw AppError.notFound('That draw does not exist.', 'DRAW_NOT_FOUND');
    if (draw.status === 'published') {
      throw AppError.conflict('A published draw cannot be reconfigured.', 'DRAW_ALREADY_PUBLISHED');
    }
    const updated = await drawRepository.updateConfig(drawId, { strategy, entriesCloseAt, drawAt });
    await auditRepository.record({
      actorId: actor?.id, actorEmail: actor?.email,
      action: 'draw.configure', entityType: 'draw', entityId: drawId,
      metadata: { strategy, entriesCloseAt, drawAt },
    });
    return updated;
  },

  async participationForUser(userId) {
    return drawRepository.entriesForUser(userId);
  },
};

function nextMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export default drawService;
