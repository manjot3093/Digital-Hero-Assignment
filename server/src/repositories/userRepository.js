import { db } from '../db/pool.js';

const PUBLIC_COLUMNS = `
  u.id, u.email, u.first_name, u.last_name, u.home_club, u.handicap,
  u.charity_id, u.charity_percent, u.status, u.last_login_at, u.created_at,
  r.key AS role
`;

export const userRepository = {
  async findByEmail(email, exec = db) {
    return exec.queryOne(
      `SELECT ${PUBLIC_COLUMNS}, u.password_hash
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.email = $1 AND u.status <> 'deleted'`,
      [email]
    );
  },

  async findById(id, exec = db) {
    return exec.queryOne(
      `SELECT ${PUBLIC_COLUMNS} FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [id]
    );
  },

  async create({ email, passwordHash, firstName, lastName, homeClub = null, handicap = null, role = 'subscriber' }, exec = db) {
    return exec.queryOne(
      `INSERT INTO users (email, password_hash, first_name, last_name, home_club, handicap, role_id)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT id FROM roles WHERE key = $7))
       RETURNING id, email, first_name, last_name, home_club, handicap, charity_id, charity_percent, status, created_at`,
      [email, passwordHash, firstName, lastName, homeClub, handicap, role]
    );
  },

  async updateProfile(id, { firstName, lastName, homeClub, handicap }, exec = db) {
    return exec.queryOne(
      `UPDATE users SET first_name = COALESCE($2, first_name),
                        last_name  = COALESCE($3, last_name),
                        home_club  = $4,
                        handicap   = $5
        WHERE id = $1
        RETURNING id, email, first_name, last_name, home_club, handicap, charity_id, charity_percent`,
      [id, firstName, lastName, homeClub ?? null, handicap ?? null]
    );
  },

  async setCharity(id, { charityId, charityPercent }, exec = db) {
    return exec.queryOne(
      `UPDATE users SET charity_id = $2, charity_percent = $3
        WHERE id = $1
        RETURNING id, charity_id, charity_percent`,
      [id, charityId, charityPercent]
    );
  },

  async updatePassword(id, passwordHash, exec = db) {
    await exec.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
  },

  async touchLogin(id, exec = db) {
    await exec.query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
  },

  async setStatus(id, status, exec = db) {
    return exec.queryOne(
      `UPDATE users SET status = $2 WHERE id = $1 RETURNING id, email, status`,
      [id, status]
    );
  },

  async list({ search = '', role = null, status = null, page = 1, pageSize = 20 }, exec = db) {
    const offset = (page - 1) * pageSize;
    const { rows } = await exec.query(
      `SELECT ${PUBLIC_COLUMNS},
              c.name AS charity_name,
              s.status AS subscription_status,
              s.current_period_end,
              p.code AS plan_code,
              COUNT(*) OVER() AS total_count
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN charities c ON c.id = u.charity_id
         LEFT JOIN LATERAL (
           SELECT * FROM subscriptions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
         ) s ON true
         LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE u.status <> 'deleted'
          AND ($1 = '' OR u.email ILIKE '%' || $1 || '%'
               OR (u.first_name || ' ' || u.last_name) ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR r.key = $2)
          AND ($3::text IS NULL OR u.status = $3)
        ORDER BY u.created_at DESC
        LIMIT $4 OFFSET $5`,
      [search, role, status, pageSize, offset]
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  },

  async countByRole(exec = db) {
    const { rows } = await exec.query(
      `SELECT r.key AS role, COUNT(u.id) AS count
         FROM roles r LEFT JOIN users u ON u.role_id = r.id AND u.status = 'active'
        GROUP BY r.key`
    );
    return rows;
  },

  async growthByMonth(months = 12, exec = db) {
    const { rows } = await exec.query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
              COUNT(*) AS signups
         FROM users
        WHERE created_at >= date_trunc('month', now()) - make_interval(months => $1)
        GROUP BY 1 ORDER BY 1`,
      [months]
    );
    return rows;
  },
};

export default userRepository;
