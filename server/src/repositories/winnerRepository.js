import { db } from '../db/pool.js';

const WINNER = `
  w.id, w.draw_id, w.user_id, w.match_count, w.amount_minor, w.state,
  w.payment_status, w.reviewed_at, w.review_notes, w.created_at
`;

export const winnerRepository = {
  async createMany(drawId, awards, exec = db) {
    const created = [];
    for (const award of awards) {
      const row = await exec.queryOne(
        `INSERT INTO winners (draw_id, user_id, result_id, match_count, amount_minor, state, payment_status)
         VALUES ($1,$2,$3,$4,$5,'PENDING_PROOF','pending')
         ON CONFLICT (draw_id, user_id, match_count) DO UPDATE SET amount_minor = EXCLUDED.amount_minor
         RETURNING *`,
        [drawId, award.userId, award.resultId ?? null, award.matchCount, award.amountMinor]
      );
      created.push(row);
    }
    return created;
  },

  async findById(id, exec = db) {
    return exec.queryOne(
      `SELECT ${WINNER}, d.reference, d.draw_at, u.email, u.first_name, u.last_name
         FROM winners w JOIN draws d ON d.id = w.draw_id JOIN users u ON u.id = w.user_id
        WHERE w.id = $1`,
      [id]
    );
  },

  async findByIdForUpdate(id, exec = db) {
    return exec.queryOne('SELECT * FROM winners WHERE id = $1 FOR UPDATE', [id]);
  },

  async listByUser(userId, exec = db) {
    const { rows } = await exec.query(
      `SELECT ${WINNER}, d.reference, d.draw_at, d.winning_numbers,
              p.status AS payout_status, p.processed_at,
              pr.file_name, pr.uploaded_at AS proof_uploaded_at
         FROM winners w
         JOIN draws d ON d.id = w.draw_id
         LEFT JOIN payouts p ON p.winner_id = w.id
         LEFT JOIN winner_proofs pr ON pr.winner_id = w.id AND pr.is_current
        WHERE w.user_id = $1 ORDER BY w.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async adminList({ state = null, page = 1, pageSize = 25 }, exec = db) {
    const offset = (page - 1) * pageSize;
    const { rows } = await exec.query(
      `SELECT ${WINNER}, d.reference, u.email, u.first_name, u.last_name,
              pr.id AS proof_id, pr.file_name, pr.storage_key, pr.mime_type, pr.uploaded_at,
              p.status AS payout_status, p.reference AS payout_reference, p.processed_at,
              COUNT(*) OVER() AS total_count
         FROM winners w
         JOIN draws d ON d.id = w.draw_id
         JOIN users u ON u.id = w.user_id
         LEFT JOIN winner_proofs pr ON pr.winner_id = w.id AND pr.is_current
         LEFT JOIN payouts p ON p.winner_id = w.id
        WHERE ($1::text IS NULL OR w.state = $1)
        ORDER BY w.created_at DESC LIMIT $2 OFFSET $3`,
      [state, pageSize, offset]
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  },

  async transition(id, { state, paymentStatus, reviewedBy, reviewNotes }, exec = db) {
    return exec.queryOne(
      `UPDATE winners SET state = $2,
                          payment_status = COALESCE($3, payment_status),
                          reviewed_by = COALESCE($4, reviewed_by),
                          reviewed_at = CASE WHEN $4::uuid IS NULL THEN reviewed_at ELSE now() END,
                          review_notes = COALESCE($5, review_notes)
        WHERE id = $1 RETURNING *`,
      [id, state, paymentStatus ?? null, reviewedBy ?? null, reviewNotes ?? null]
    );
  },

  async currentProof(winnerId, exec = db) {
    return exec.queryOne(
      'SELECT * FROM winner_proofs WHERE winner_id = $1 AND is_current',
      [winnerId]
    );
  },

  async addProof(winnerId, { storageKey, fileName, mimeType, sizeBytes, checksum }, exec = db) {
    await exec.query('UPDATE winner_proofs SET is_current = false WHERE winner_id = $1', [winnerId]);
    return exec.queryOne(
      `INSERT INTO winner_proofs (winner_id, storage_key, file_name, mime_type, size_bytes, checksum)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [winnerId, storageKey, fileName, mimeType, sizeBytes, checksum ?? null]
    );
  },

  async upsertPayout(winnerId, { amountMinor, status = 'pending', reference = null, processedBy = null, method = 'bank_transfer' }, exec = db) {
    return exec.queryOne(
      `INSERT INTO payouts (winner_id, amount_minor, status, reference, processed_by, method,
                            processed_at)
       VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $3 = 'paid' THEN now() ELSE NULL END)
       ON CONFLICT (winner_id) DO UPDATE SET
         status = EXCLUDED.status,
         reference = COALESCE(EXCLUDED.reference, payouts.reference),
         processed_by = COALESCE(EXCLUDED.processed_by, payouts.processed_by),
         processed_at = CASE WHEN EXCLUDED.status = 'paid' THEN now() ELSE payouts.processed_at END
       RETURNING *`,
      [winnerId, amountMinor, status, reference, processedBy, method]
    );
  },

  async stats(exec = db) {
    return exec.queryOne(
      `SELECT COUNT(*) AS total_winners,
              COUNT(*) FILTER (WHERE state IN ('PROOF_SUBMITTED','UNDER_REVIEW')) AS pending_verification,
              COUNT(*) FILTER (WHERE state = 'PENDING_PROOF') AS awaiting_proof,
              COUNT(*) FILTER (WHERE state = 'PAID') AS paid_count,
              COALESCE(SUM(amount_minor) FILTER (WHERE state = 'PAID'), 0) AS paid_minor,
              COALESCE(SUM(amount_minor) FILTER (WHERE state <> 'PAID' AND state <> 'REJECTED'), 0) AS outstanding_minor
         FROM winners`
    );
  },

  async recent(limit = 8, exec = db) {
    const { rows } = await exec.query(
      `SELECT w.id, w.match_count, w.amount_minor, w.state, w.created_at,
              d.reference, u.first_name, u.last_name
         FROM winners w JOIN draws d ON d.id = w.draw_id JOIN users u ON u.id = w.user_id
        ORDER BY w.created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  },
};

export default winnerRepository;
