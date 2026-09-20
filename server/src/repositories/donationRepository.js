import { db } from '../db/pool.js';

export const donationRepository = {
  async create({ userId, charityId, donorName, donorEmail, amountMinor, message, providerPaymentId, status = 'pending' }, exec = db) {
    return exec.queryOne(
      `INSERT INTO donations (user_id, charity_id, donor_name, donor_email, amount_minor, message, provider_payment_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [userId ?? null, charityId, donorName ?? null, donorEmail ?? null, amountMinor, message ?? null, providerPaymentId ?? null, status]
    );
  },

  async markSucceeded(providerPaymentId, exec = db) {
    return exec.queryOne(
      `UPDATE donations SET status = 'succeeded' WHERE provider_payment_id = $1 RETURNING *`,
      [providerPaymentId]
    );
  },

  async listByUser(userId, exec = db) {
    const { rows } = await exec.query(
      `SELECT d.*, c.name AS charity_name FROM donations d
         JOIN charities c ON c.id = d.charity_id
        WHERE d.user_id = $1 ORDER BY d.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async totals(exec = db) {
    return exec.queryOne(
      `SELECT COALESCE(SUM(amount_minor), 0) AS total_minor, COUNT(*) AS count
         FROM donations WHERE status = 'succeeded'`
    );
  },
};

export default donationRepository;
