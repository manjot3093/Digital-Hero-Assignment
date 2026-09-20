import { withTransaction } from '../db/pool.js';
import scoreRepository from '../repositories/scoreRepository.js';
import {
  planScoreInsert,
  planScoreUpdate,
  summarise,
  ScoreRuleError,
  MAX_RETAINED,
} from '../domain/scores/scoreRules.js';
import AppError from '../utils/AppError.js';

/** Translates a domain rule error into the API's error vocabulary. */
function wrap(error) {
  if (error instanceof ScoreRuleError) {
    const status = error.code === 'DUPLICATE_SCORE_DATE' ? 409 : 422;
    return new AppError(error.message, { status, code: error.code });
  }
  if (error?.constraint === 'uq_score_per_user_per_day') {
    return AppError.conflict('A score already exists for that date.', 'DUPLICATE_SCORE_DATE');
  }
  return error;
}

const toDomain = (row) => ({
  id: row.id,
  value: row.value,
  playedOn: row.played_on instanceof Date ? row.played_on.toISOString().slice(0, 10) : row.played_on,
  createdAt: row.created_at,
});

export const scoreService = {
  async list(userId) {
    const rows = await scoreRepository.listByUser(userId);
    const scores = rows.map((row) => ({ ...toDomain(row), courseName: row.course_name, notes: row.notes }));
    return {
      scores,
      retention: { max: MAX_RETAINED, used: scores.length, remaining: Math.max(0, MAX_RETAINED - scores.length) },
      summary: summarise(scores),
    };
  },

  /**
   * Adds a score inside a transaction: the user's rows are locked, the rolling
   * five-score rule is applied, the evicted rows are deleted and the new row is
   * written — all or nothing.
   */
  async add(userId, { value, playedOn, courseName, notes }) {
    try {
      return await withTransaction(async (tx) => {
        const existing = (await scoreRepository.listByUserForUpdate(userId, tx)).map(toDomain);
        const plan = planScoreInsert({ existing, value, playedOn });

        if (plan.evictIds.length) {
          await scoreRepository.deleteMany(plan.evictIds, tx);
        }
        const created = await scoreRepository.insert(
          { userId, value: plan.value, playedOn: plan.playedOn, courseName, notes },
          tx
        );
        return { score: created, evicted: plan.evictIds };
      });
    } catch (error) {
      throw wrap(error);
    }
  },

  async update(userId, scoreId, { value, playedOn, courseName, notes }) {
    try {
      return await withTransaction(async (tx) => {
        const existing = (await scoreRepository.listByUserForUpdate(userId, tx)).map(toDomain);
        const plan = planScoreUpdate({ existing, id: scoreId, value, playedOn });
        return scoreRepository.update(plan.id, { value: plan.value, playedOn: plan.playedOn, courseName, notes }, tx);
      });
    } catch (error) {
      throw wrap(error);
    }
  },

  async remove(userId, scoreId) {
    const deleted = await scoreRepository.deleteOne(scoreId, userId);
    if (!deleted) throw AppError.notFound('That score no longer exists.', 'SCORE_NOT_FOUND');
    return true;
  },
};

export default scoreService;
