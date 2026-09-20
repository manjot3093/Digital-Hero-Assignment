import { db } from '../db/pool.js';

export const scoreRepository = {
  async listByUser(userId, exec = db) {
    const { rows } = await exec.query(
      `SELECT id, user_id, value, played_on, course_name, notes, created_at, updated_at
         FROM scores WHERE user_id = $1
        ORDER BY played_on DESC, created_at DESC`,
      [userId]
    );
    return rows;
  },

  async findById(id, exec = db) {
    return exec.queryOne('SELECT * FROM scores WHERE id = $1', [id]);
  },

  /** Locks the user's rows so a concurrent insert cannot break the retention rule. */
  async listByUserForUpdate(userId, exec = db) {
    const { rows } = await exec.query(
      `SELECT id, user_id, value, played_on, created_at FROM scores
        WHERE user_id = $1 ORDER BY played_on DESC FOR UPDATE`,
      [userId]
    );
    return rows;
  },

  async insert({ userId, value, playedOn, courseName = null, notes = null }, exec = db) {
    return exec.queryOne(
      `INSERT INTO scores (user_id, value, played_on, course_name, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, value, playedOn, courseName, notes]
    );
  },

  async update(id, { value, playedOn, courseName, notes }, exec = db) {
    return exec.queryOne(
      `UPDATE scores SET value = $2, played_on = $3, course_name = $4, notes = $5
        WHERE id = $1 RETURNING *`,
      [id, value, playedOn, courseName ?? null, notes ?? null]
    );
  },

  async deleteMany(ids, exec = db) {
    if (!ids.length) return 0;
    const { rowCount } = await exec.query('DELETE FROM scores WHERE id = ANY($1::uuid[])', [ids]);
    return rowCount;
  },

  async deleteOne(id, userId, exec = db) {
    const { rowCount } = await exec.query('DELETE FROM scores WHERE id = $1 AND user_id = $2', [id, userId]);
    return rowCount;
  },

  /** Retained scores for everyone entitled to play — used to build draw tickets. */
  async listForActiveSubscribers(exec = db) {
    const { rows } = await exec.query(
      `SELECT u.id AS user_id, COALESCE(array_agg(s.value ORDER BY s.played_on DESC)
                FILTER (WHERE s.id IS NOT NULL), '{}') AS scores
         FROM users u
         JOIN subscriptions sub ON sub.user_id = u.id
          AND sub.status IN ('active','past_due','cancelled')
          AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
         LEFT JOIN scores s ON s.user_id = u.id
        WHERE u.status = 'active'
        GROUP BY u.id`
    );
    return rows;
  },

  async adminList({ search = '', page = 1, pageSize = 25 }, exec = db) {
    const offset = (page - 1) * pageSize;
    const { rows } = await exec.query(
      `SELECT s.*, u.email, u.first_name, u.last_name, COUNT(*) OVER() AS total_count
         FROM scores s JOIN users u ON u.id = s.user_id
        WHERE ($1 = '' OR u.email ILIKE '%' || $1 || '%')
        ORDER BY s.played_on DESC LIMIT $2 OFFSET $3`,
      [search, pageSize, offset]
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  },

  async distribution(exec = db) {
    const { rows } = await exec.query(
      `SELECT width_bucket(value, 1, 46, 9) AS bucket,
              MIN(value) AS min_value, MAX(value) AS max_value, COUNT(*) AS count
         FROM scores GROUP BY 1 ORDER BY 1`
    );
    return rows;
  },
};

export default scoreRepository;
