import { db } from '../db/pool.js';

const DRAW = `
  d.id, d.reference, d.period_month, d.configuration_id, d.strategy, d.status,
  d.entries_close_at, d.draw_at, d.published_at, d.seed, d.winning_numbers,
  d.carried_in_minor, d.rollover_minor, d.created_at
`;

export const drawRepository = {
  async list({ status = null, limit = 24 }, exec = db) {
    const { rows } = await exec.query(
      `SELECT ${DRAW}, pp.total_minor, pp.subscriber_count,
              (SELECT COUNT(*) FROM draw_entries e WHERE e.draw_id = d.id) AS entry_count,
              (SELECT COUNT(*) FROM winners w WHERE w.draw_id = d.id) AS winner_count
         FROM draws d LEFT JOIN prize_pools pp ON pp.draw_id = d.id
        WHERE ($1::text IS NULL OR d.status = $1)
        ORDER BY d.period_month DESC LIMIT $2`,
      [status, limit]
    );
    return rows;
  },

  async findById(id, exec = db) {
    return exec.queryOne(
      `SELECT ${DRAW}, pp.total_minor, pp.contribution_minor, pp.carry_over_minor, pp.subscriber_count
         FROM draws d LEFT JOIN prize_pools pp ON pp.draw_id = d.id WHERE d.id = $1`,
      [id]
    );
  },

  async findByIdForUpdate(id, exec = db) {
    return exec.queryOne(`SELECT * FROM draws WHERE id = $1 FOR UPDATE`, [id]);
  },

  /** The draw accepting entries right now, or the next scheduled one. */
  async current(exec = db) {
    return exec.queryOne(
      `SELECT ${DRAW}, pp.total_minor, pp.subscriber_count,
              (SELECT COUNT(*) FROM draw_entries e WHERE e.draw_id = d.id) AS entry_count
         FROM draws d LEFT JOIN prize_pools pp ON pp.draw_id = d.id
        WHERE d.status IN ('scheduled','open','locked','simulated')
        ORDER BY d.draw_at ASC LIMIT 1`
    );
  },

  async latestPublished(exec = db) {
    return exec.queryOne(
      `SELECT ${DRAW}, pp.total_minor, pp.subscriber_count
         FROM draws d LEFT JOIN prize_pools pp ON pp.draw_id = d.id
        WHERE d.status = 'published' ORDER BY d.published_at DESC LIMIT 1`
    );
  },

  async create({ reference, periodMonth, strategy = 'random', configurationId = null, entriesCloseAt, drawAt, carriedInMinor = 0 }, exec = db) {
    return exec.queryOne(
      `INSERT INTO draws (reference, period_month, strategy, configuration_id, entries_close_at, draw_at, carried_in_minor, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'open') RETURNING *`,
      [reference, periodMonth, strategy, configurationId, entriesCloseAt, drawAt, carriedInMinor]
    );
  },

  async updateConfig(id, { strategy, entriesCloseAt, drawAt, status }, exec = db) {
    return exec.queryOne(
      `UPDATE draws SET strategy = COALESCE($2, strategy),
                        entries_close_at = COALESCE($3, entries_close_at),
                        draw_at = COALESCE($4, draw_at),
                        status = COALESCE($5, status)
        WHERE id = $1 RETURNING *`,
      [id, strategy ?? null, entriesCloseAt ?? null, drawAt ?? null, status ?? null]
    );
  },

  async publish(id, { seed, numbers, rolloverMinor, publishedBy }, exec = db) {
    return exec.queryOne(
      `UPDATE draws SET status = 'published', published_at = now(), published_by = $5,
                        seed = $2, winning_numbers = $3::smallint[], rollover_minor = $4
        WHERE id = $1 RETURNING *`,
      [id, seed, numbers, rolloverMinor, publishedBy ?? null]
    );
  },

  async upsertPool(drawId, { subscriberCount, contributionMinor, carryOverMinor, totalMinor }, exec = db) {
    return exec.queryOne(
      `INSERT INTO prize_pools (draw_id, subscriber_count, contribution_minor, carry_over_minor, total_minor)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (draw_id) DO UPDATE SET
         subscriber_count = EXCLUDED.subscriber_count,
         contribution_minor = EXCLUDED.contribution_minor,
         carry_over_minor = EXCLUDED.carry_over_minor,
         total_minor = EXCLUDED.total_minor,
         calculated_at = now()
       RETURNING *`,
      [drawId, subscriberCount, contributionMinor, carryOverMinor, totalMinor]
    );
  },

  async pool(drawId, exec = db) {
    return exec.queryOne('SELECT * FROM prize_pools WHERE draw_id = $1', [drawId]);
  },

  async replaceEntries(drawId, entries, exec = db) {
    await exec.query('DELETE FROM draw_entries WHERE draw_id = $1', [drawId]);
    for (const entry of entries) {
      await exec.query(
        `INSERT INTO draw_entries (draw_id, user_id, numbers, score_count)
         VALUES ($1,$2,$3::smallint[],$4)
         ON CONFLICT (draw_id, user_id) DO UPDATE SET numbers = EXCLUDED.numbers`,
        [drawId, entry.userId, entry.numbers, entry.scoreCount ?? 0]
      );
    }
    return entries.length;
  },

  async entries(drawId, exec = db) {
    const { rows } = await exec.query(
      `SELECT e.id AS entry_id, e.user_id, e.numbers, e.score_count,
              u.first_name, u.last_name, u.email
         FROM draw_entries e JOIN users u ON u.id = e.user_id
        WHERE e.draw_id = $1`,
      [drawId]
    );
    return rows;
  },

  async entriesForUser(userId, exec = db) {
    const { rows } = await exec.query(
      `SELECT e.id, e.numbers, e.created_at, d.id AS draw_id, d.reference, d.status,
              d.draw_at, d.winning_numbers,
              r.match_count, r.amount_minor
         FROM draw_entries e
         JOIN draws d ON d.id = e.draw_id
         LEFT JOIN draw_results r ON r.entry_id = e.id
        WHERE e.user_id = $1 ORDER BY d.draw_at DESC LIMIT 24`,
      [userId]
    );
    return rows;
  },

  async saveTiers(drawId, tiers, exec = db) {
    await exec.query('DELETE FROM prize_tiers WHERE draw_id = $1', [drawId]);
    for (const tier of tiers) {
      await exec.query(
        `INSERT INTO prize_tiers (draw_id, match_count, share, amount_minor, winner_count, per_winner_minor, rolled_over)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [drawId, tier.matchCount, tier.share, tier.amountMinor, tier.winnerCount, tier.perWinnerMinor, tier.rolledOver]
      );
    }
  },

  async tiers(drawId, exec = db) {
    const { rows } = await exec.query(
      'SELECT * FROM prize_tiers WHERE draw_id = $1 ORDER BY match_count DESC',
      [drawId]
    );
    return rows;
  },

  async saveResults(drawId, awards, exec = db) {
    await exec.query('DELETE FROM draw_results WHERE draw_id = $1', [drawId]);
    const saved = [];
    for (const award of awards) {
      const row = await exec.queryOne(
        `INSERT INTO draw_results (draw_id, entry_id, user_id, match_count, amount_minor)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [drawId, award.entryId, award.userId, award.matchCount, award.amountMinor]
      );
      saved.push(row);
    }
    return saved;
  },

  async saveSimulation({ drawId, createdBy, strategy, seed, result }, exec = db) {
    return exec.queryOne(
      `INSERT INTO draw_simulations (draw_id, created_by, strategy, seed, result)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, draw_id, strategy, seed, created_at`,
      [drawId, createdBy ?? null, strategy, seed, JSON.stringify(result)]
    );
  },

  async simulations(drawId, exec = db) {
    const { rows } = await exec.query(
      `SELECT id, strategy, seed, result, created_at FROM draw_simulations
        WHERE draw_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [drawId]
    );
    return rows;
  },

  async unclaimedRollover(exec = db) {
    const row = await exec.queryOne(
      `SELECT COALESCE(SUM(rollover_minor), 0) AS minor FROM draws
        WHERE status = 'published' AND rollover_minor > 0
          AND NOT EXISTS (SELECT 1 FROM draws later WHERE later.period_month > draws.period_month AND later.carried_in_minor > 0)`
    );
    return Number(row?.minor ?? 0);
  },

  async configurations(exec = db) {
    const { rows } = await exec.query('SELECT * FROM draw_configurations ORDER BY is_default DESC, name');
    return rows;
  },

  async poolHistory(limit = 12, exec = db) {
    const { rows } = await exec.query(
      `SELECT d.reference, to_char(d.period_month, 'YYYY-MM') AS month,
              COALESCE(pp.total_minor, 0) AS total_minor,
              COALESCE(pp.subscriber_count, 0) AS subscriber_count,
              (SELECT COUNT(*) FROM draw_entries e WHERE e.draw_id = d.id) AS entry_count
         FROM draws d LEFT JOIN prize_pools pp ON pp.draw_id = d.id
        ORDER BY d.period_month DESC LIMIT $1`,
      [limit]
    );
    return rows.reverse();
  },

  async winnerDistribution(exec = db) {
    const { rows } = await exec.query(
      `SELECT match_count, COUNT(*) AS count, COALESCE(SUM(amount_minor), 0) AS amount_minor
         FROM winners GROUP BY match_count ORDER BY match_count DESC`
    );
    return rows;
  },
};

export default drawRepository;
