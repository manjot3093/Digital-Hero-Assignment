import { db } from '../db/pool.js';

export const auditRepository = {
  async record({ actorId, actorEmail, action, entityType, entityId, metadata = {}, ipAddress = null }, exec = db) {
    return exec.queryOne(
      `INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, metadata, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, action, created_at`,
      [actorId ?? null, actorEmail ?? null, action, entityType, entityId ? String(entityId) : null,
       JSON.stringify(metadata), ipAddress]
    );
  },

  async list({ page = 1, pageSize = 50, action = null }, exec = db) {
    const offset = (page - 1) * pageSize;
    const { rows } = await exec.query(
      `SELECT id, actor_email, action, entity_type, entity_id, metadata, created_at,
              COUNT(*) OVER() AS total_count
         FROM audit_logs
        WHERE ($1::text IS NULL OR action = $1)
        ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [action, pageSize, offset]
    );
    return { rows, total: rows[0]?.total_count ?? 0 };
  },
};

export default auditRepository;
