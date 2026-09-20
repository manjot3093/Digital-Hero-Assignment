import { db } from '../db/pool.js';

const SUB = `
  s.id, s.user_id, s.plan_id, s.status, s.provider, s.provider_customer_id,
  s.provider_subscription_id, s.current_period_start, s.current_period_end,
  s.cancel_at_period_end, s.cancelled_at, s.created_at,
  p.code AS plan_code, p.name AS plan_name, p.interval, p.amount_minor, p.currency, p.prize_share
`;

export const subscriptionRepository = {
  async plans(exec = db) {
    const { rows } = await exec.query(
      `SELECT id, code, name, interval, amount_minor, currency, provider_price_id, prize_share
         FROM subscription_plans WHERE is_active ORDER BY amount_minor ASC`
    );
    return rows;
  },

  async planByCode(code, exec = db) {
    return exec.queryOne('SELECT * FROM subscription_plans WHERE code = $1 AND is_active', [code]);
  },

  async findByUser(userId, exec = db) {
    return exec.queryOne(
      `SELECT ${SUB} FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 1`,
      [userId]
    );
  },

  async findByProviderId(providerSubscriptionId, exec = db) {
    return exec.queryOne(
      `SELECT ${SUB} FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.provider_subscription_id = $1`,
      [providerSubscriptionId]
    );
  },

  async upsertForUser({ userId, planId, status, provider = 'stripe', providerCustomerId, providerSubscriptionId,
                        currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd = false }, exec = db) {
    return exec.queryOne(
      `INSERT INTO subscriptions (user_id, plan_id, status, provider, provider_customer_id,
                                  provider_subscription_id, current_period_start, current_period_end, cancel_at_period_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (provider_subscription_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         status = EXCLUDED.status,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         cancel_at_period_end = EXCLUDED.cancel_at_period_end
       RETURNING *`,
      [userId, planId, status, provider, providerCustomerId ?? null, providerSubscriptionId ?? null,
       currentPeriodStart ?? null, currentPeriodEnd ?? null, cancelAtPeriodEnd]
    );
  },

  async updateStatus(id, { status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, cancelledAt }, exec = db) {
    return exec.queryOne(
      `UPDATE subscriptions SET
         status = COALESCE($2, status),
         current_period_start = COALESCE($3, current_period_start),
         current_period_end = COALESCE($4, current_period_end),
         cancel_at_period_end = COALESCE($5, cancel_at_period_end),
         cancelled_at = COALESCE($6, cancelled_at)
       WHERE id = $1 RETURNING *`,
      [id, status ?? null, currentPeriodStart ?? null, currentPeriodEnd ?? null,
       cancelAtPeriodEnd ?? null, cancelledAt ?? null]
    );
  },

  /** Every subscription that is currently entitled, with the data the pool needs. */
  async listEntitled(exec = db) {
    const { rows } = await exec.query(
      `SELECT s.id, s.user_id, s.status, s.current_period_end,
              p.interval, p.amount_minor, p.prize_share, u.charity_percent, u.charity_id
         FROM subscriptions s
         JOIN subscription_plans p ON p.id = s.plan_id
         JOIN users u ON u.id = s.user_id
        WHERE s.status IN ('active','past_due','cancelled')
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
          AND u.status = 'active'`
    );
    return rows;
  },

  async expireLapsed(exec = db) {
    const { rowCount } = await exec.query(
      `UPDATE subscriptions SET status = 'expired'
        WHERE status IN ('active','past_due') AND current_period_end < now()`
    );
    return rowCount;
  },

  async adminList({ status = null, page = 1, pageSize = 25 }, exec = db) {
    const offset = (page - 1) * pageSize;
    const { rows } = await exec.query(
      `SELECT ${SUB}, u.email, u.first_name, u.last_name, COUNT(*) OVER() AS total_count
         FROM subscriptions s
         JOIN subscription_plans p ON p.id = s.plan_id
         JOIN users u ON u.id = s.user_id
        WHERE ($1::text IS NULL OR s.status = $1)
        ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`,
      [status, pageSize, offset]
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  },

  async planDistribution(exec = db) {
    const { rows } = await exec.query(
      `SELECT p.code, p.name, COUNT(s.id) AS count
         FROM subscription_plans p
         LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status IN ('active','past_due')
        GROUP BY p.code, p.name ORDER BY p.code`
    );
    return rows;
  },

  async recordPayment({ userId, subscriptionId, providerPaymentId, amountMinor, currency, status,
                        charityMinor = 0, prizeMinor = 0, platformMinor = 0, failureReason = null, paidAt = null }, exec = db) {
    return exec.queryOne(
      `INSERT INTO payments (user_id, subscription_id, provider_payment_id, amount_minor, currency,
                             status, charity_minor, prize_minor, platform_minor, failure_reason, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (provider_payment_id) DO NOTHING
       RETURNING *`,
      [userId, subscriptionId ?? null, providerPaymentId ?? null, amountMinor, currency, status,
       charityMinor, prizeMinor, platformMinor, failureReason, paidAt]
    );
  },

  async paymentsByUser(userId, exec = db) {
    const { rows } = await exec.query(
      `SELECT id, amount_minor, currency, status, charity_minor, prize_minor, platform_minor, paid_at, created_at
         FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 24`,
      [userId]
    );
    return rows;
  },

  async wasWebhookProcessed(provider, eventId, exec = db) {
    const row = await exec.queryOne(
      'SELECT id FROM webhook_events WHERE provider = $1 AND event_id = $2',
      [provider, eventId]
    );
    return Boolean(row);
  },

  async markWebhookProcessed({ provider, eventId, eventType, payload }, exec = db) {
    return exec.queryOne(
      `INSERT INTO webhook_events (provider, event_id, event_type, payload)
       VALUES ($1,$2,$3,$4) ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`,
      [provider, eventId, eventType, payload ? JSON.stringify(payload) : null]
    );
  },
};

export default subscriptionRepository;
