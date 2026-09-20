import { db } from '../db/pool.js';

const CARD = `
  c.id, c.slug, c.name, c.tagline, c.description, c.category, c.region,
  c.hero_image_url, c.logo_url, c.website_url, c.impact_headline,
  c.impact_metrics, c.is_featured, c.is_active, c.created_at
`;

export const charityRepository = {
  async list({ search = '', category = null, featuredOnly = false, page = 1, pageSize = 24 }, exec = db) {
    const offset = (page - 1) * pageSize;
    const { rows } = await exec.query(
      `SELECT ${CARD},
              COALESCE(stats.supporters, 0) AS supporter_count,
              COALESCE(stats.raised_minor, 0) AS raised_minor,
              COUNT(*) OVER() AS total_count
         FROM charities c
         LEFT JOIN LATERAL (
           SELECT COUNT(DISTINCT u.id) AS supporters,
                  (SELECT COALESCE(SUM(amount_minor), 0) FROM charity_contributions WHERE charity_id = c.id) AS raised_minor
             FROM users u WHERE u.charity_id = c.id AND u.status = 'active'
         ) stats ON true
        WHERE c.is_active
          AND ($1 = '' OR c.name ILIKE '%' || $1 || '%' OR c.description ILIKE '%' || $1 || '%'
               OR c.category ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR c.category = $2)
          AND ($3::boolean IS NOT TRUE OR c.is_featured)
        ORDER BY c.is_featured DESC, c.name ASC
        LIMIT $4 OFFSET $5`,
      [search, category, featuredOnly, pageSize, offset]
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  },

  async categories(exec = db) {
    const { rows } = await exec.query(
      `SELECT category, COUNT(*) AS count FROM charities WHERE is_active GROUP BY category ORDER BY category`
    );
    return rows;
  },

  async findById(id, exec = db) {
    return exec.queryOne(`SELECT ${CARD} FROM charities c WHERE c.id = $1`, [id]);
  },

  async findByIdOrSlug(idOrSlug, exec = db) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    return exec.queryOne(
      `SELECT ${CARD} FROM charities c WHERE ${isUuid ? 'c.id = $1' : 'c.slug = $1'}`,
      [idOrSlug]
    );
  },

  async events(charityId, exec = db) {
    const { rows } = await exec.query(
      `SELECT id, title, description, venue, starts_at FROM charity_events
        WHERE charity_id = $1 AND starts_at > now() - interval '1 day'
        ORDER BY starts_at ASC LIMIT 10`,
      [charityId]
    );
    return rows;
  },

  async stats(charityId, exec = db) {
    return exec.queryOne(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE charity_id = $1 AND status = 'active') AS supporter_count,
         (SELECT COALESCE(SUM(amount_minor), 0) FROM charity_contributions WHERE charity_id = $1) AS raised_minor,
         (SELECT COALESCE(SUM(amount_minor), 0) FROM donations WHERE charity_id = $1 AND status = 'succeeded') AS donated_minor`,
      [charityId]
    );
  },

  async create(data, exec = db) {
    return exec.queryOne(
      `INSERT INTO charities (slug, name, tagline, description, category, region,
                              hero_image_url, logo_url, website_url, impact_headline,
                              impact_metrics, is_featured, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING ${CARD.replace(/c\./g, '')}`,
      [data.slug, data.name, data.tagline, data.description, data.category, data.region ?? 'National',
       data.heroImageUrl, data.logoUrl, data.websiteUrl, data.impactHeadline,
       JSON.stringify(data.impactMetrics ?? []), data.isFeatured ?? false, data.isActive ?? true]
    );
  },

  async update(id, data, exec = db) {
    return exec.queryOne(
      `UPDATE charities SET
         name = COALESCE($2, name), tagline = $3, description = COALESCE($4, description),
         category = COALESCE($5, category), region = COALESCE($6, region),
         hero_image_url = $7, logo_url = $8, website_url = $9, impact_headline = $10,
         impact_metrics = COALESCE($11::jsonb, impact_metrics),
         is_featured = COALESCE($12, is_featured), is_active = COALESCE($13, is_active)
       WHERE id = $1 RETURNING ${CARD.replace(/c\./g, '')}`,
      [id, data.name, data.tagline, data.description, data.category, data.region,
       data.heroImageUrl, data.logoUrl, data.websiteUrl, data.impactHeadline,
       data.impactMetrics ? JSON.stringify(data.impactMetrics) : null,
       data.isFeatured, data.isActive]
    );
  },

  /** Soft delete: supporters keep their history, the charity leaves the directory. */
  async deactivate(id, exec = db) {
    return exec.queryOne('UPDATE charities SET is_active = false WHERE id = $1 RETURNING id, name, is_active', [id]);
  },

  async addEvent(charityId, { title, description, venue, startsAt }, exec = db) {
    return exec.queryOne(
      `INSERT INTO charity_events (charity_id, title, description, venue, starts_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [charityId, title, description ?? null, venue ?? null, startsAt]
    );
  },

  async recordContribution({ charityId, userId, paymentId, amountMinor, percent, source = 'subscription' }, exec = db) {
    return exec.queryOne(
      `INSERT INTO charity_contributions (charity_id, user_id, payment_id, amount_minor, percent, source)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [charityId, userId, paymentId, amountMinor, percent, source]
    );
  },

  async totals(exec = db) {
    return exec.queryOne(
      `SELECT COALESCE(SUM(amount_minor), 0) AS total_minor,
              COUNT(DISTINCT charity_id) AS charities_supported,
              COUNT(DISTINCT user_id) AS contributors
         FROM charity_contributions`
    );
  },

  async contributionsByMonth(months = 12, exec = db) {
    const { rows } = await exec.query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
              COALESCE(SUM(amount_minor), 0) AS amount_minor
         FROM charity_contributions
        WHERE created_at >= date_trunc('month', now()) - make_interval(months => $1)
        GROUP BY 1 ORDER BY 1`,
      [months]
    );
    return rows;
  },

  async topCharities(limit = 5, exec = db) {
    const { rows } = await exec.query(
      `SELECT c.id, c.name, COALESCE(SUM(cc.amount_minor), 0) AS amount_minor,
              COUNT(DISTINCT cc.user_id) AS contributors
         FROM charities c LEFT JOIN charity_contributions cc ON cc.charity_id = c.id
        GROUP BY c.id, c.name ORDER BY amount_minor DESC LIMIT $1`,
      [limit]
    );
    return rows;
  },
};

export default charityRepository;
