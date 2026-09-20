import crypto from 'node:crypto';
import { withTransaction } from '../db/pool.js';
import winnerRepository from '../repositories/winnerRepository.js';
import auditRepository from '../repositories/auditRepository.js';
import { storageProvider, ALLOWED_PROOF_TYPES } from '../integrations/storage/index.js';
import {
  WINNER_STATES,
  transition,
  paymentStatusFor,
  allowedActions,
  WinnerStateError,
} from '../domain/winners/winnerStateMachine.js';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';

function wrap(error) {
  if (error instanceof WinnerStateError) {
    return new AppError(error.message, { status: 409, code: error.code });
  }
  return error;
}

export const winnerService = {
  async listForUser(userId) {
    const rows = await winnerRepository.listByUser(userId);
    return rows.map((row) => ({ ...row, actions: allowedActions(row.state) }));
  },

  async summaryForUser(userId) {
    const rows = await winnerRepository.listByUser(userId);
    return {
      totalWonMinor: rows.reduce((sum, row) => sum + Number(row.amount_minor), 0),
      paidMinor: rows.filter((r) => r.state === WINNER_STATES.PAID).reduce((s, r) => s + Number(r.amount_minor), 0),
      pendingCount: rows.filter((r) => r.payment_status === 'pending' && r.state !== 'REJECTED').length,
      awaitingProof: rows.filter((r) => r.state === WINNER_STATES.PENDING_PROOF).length,
      winCount: rows.length,
    };
  },

  /**
   * A winner uploads their score screenshot. The bytes go to object storage,
   * the database keeps only the key, and the claim moves to PROOF_SUBMITTED.
   */
  async submitProof({ winnerId, userId, file }) {
    if (!file) throw AppError.badRequest('Attach a screenshot of your scores.', 'PROOF_REQUIRED');
    if (!ALLOWED_PROOF_TYPES.includes(file.mimetype)) {
      throw AppError.badRequest('Upload a PNG, JPEG, WebP or PDF.', 'INVALID_FILE_TYPE');
    }
    if (file.size > env.storage.maxFileBytes) {
      throw AppError.payloadTooLarge(`Keep the file under ${Math.round(env.storage.maxFileBytes / 1024 / 1024)}MB.`);
    }

    const winner = await winnerRepository.findById(winnerId);
    if (!winner) throw AppError.notFound('That win does not exist.', 'WINNER_NOT_FOUND');
    if (winner.user_id !== userId) throw AppError.forbidden('That win belongs to someone else.');

    try {
      const nextState = transition(winner.state, 'SUBMIT_PROOF');
      const extension = file.originalname.split('.').pop()?.toLowerCase().slice(0, 5) ?? 'png';
      const key = `proofs/${winner.draw_id}/${winnerId}/${crypto.randomUUID()}.${extension}`;
      const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

      await storageProvider().put(key, file.buffer, { contentType: file.mimetype });

      return await withTransaction(async (tx) => {
        const proof = await winnerRepository.addProof(winnerId, {
          storageKey: key,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          checksum,
        }, tx);
        const updated = await winnerRepository.transition(winnerId, { state: nextState }, tx);
        return { winner: updated, proof: { id: proof.id, fileName: proof.file_name, uploadedAt: proof.uploaded_at } };
      });
    } catch (error) {
      throw wrap(error);
    }
  },

  async proofUrl(winnerId) {
    const proof = await winnerRepository.currentProof(winnerId);
    if (!proof) throw AppError.notFound('No proof has been uploaded yet.', 'PROOF_NOT_FOUND');
    const url = await storageProvider().signedUrl(proof.storage_key, 900);
    return { url, fileName: proof.file_name, mimeType: proof.mime_type, uploadedAt: proof.uploaded_at };
  },

  async adminList(filters) {
    const { rows, total } = await winnerRepository.adminList(filters);
    return { winners: rows.map((row) => ({ ...row, actions: allowedActions(row.state) })), total };
  },

  /** Admin approves a claim. Approval immediately queues the payout. */
  async approve(winnerId, { actor, notes }) {
    try {
      return await withTransaction(async (tx) => {
        const winner = await winnerRepository.findByIdForUpdate(winnerId, tx);
        if (!winner) throw AppError.notFound('That win does not exist.', 'WINNER_NOT_FOUND');

        const proof = await winnerRepository.currentProof(winnerId, tx);
        if (!proof) throw AppError.unprocessable('There is no proof to review yet.', 'PROOF_NOT_FOUND');

        const approved = transition(winner.state, 'APPROVE');
        const queued = transition(approved, 'QUEUE_PAYOUT');

        const updated = await winnerRepository.transition(winnerId, {
          state: queued,
          paymentStatus: paymentStatusFor(queued),
          reviewedBy: actor.id,
          reviewNotes: notes ?? null,
        }, tx);

        await winnerRepository.upsertPayout(winnerId, {
          amountMinor: winner.amount_minor,
          status: 'pending',
        }, tx);

        await auditRepository.record({
          actorId: actor.id, actorEmail: actor.email,
          action: 'winner.approve', entityType: 'winner', entityId: winnerId,
          metadata: { amountMinor: winner.amount_minor, notes: notes ?? null },
        }, tx);

        return updated;
      });
    } catch (error) {
      throw wrap(error);
    }
  },

  async reject(winnerId, { actor, notes }) {
    if (!notes) throw AppError.badRequest('Tell the member why the proof was rejected.', 'REVIEW_NOTES_REQUIRED');
    try {
      return await withTransaction(async (tx) => {
        const winner = await winnerRepository.findByIdForUpdate(winnerId, tx);
        if (!winner) throw AppError.notFound('That win does not exist.', 'WINNER_NOT_FOUND');
        const rejected = transition(winner.state, 'REJECT');
        const updated = await winnerRepository.transition(winnerId, {
          state: rejected,
          paymentStatus: paymentStatusFor(rejected),
          reviewedBy: actor.id,
          reviewNotes: notes,
        }, tx);
        await auditRepository.record({
          actorId: actor.id, actorEmail: actor.email,
          action: 'winner.reject', entityType: 'winner', entityId: winnerId,
          metadata: { notes },
        }, tx);
        return updated;
      });
    } catch (error) {
      throw wrap(error);
    }
  },

  /** Marks the money as sent: PAYOUT_PENDING → PAID. */
  async markPaid(winnerId, { actor, reference, method = 'bank_transfer' }) {
    try {
      return await withTransaction(async (tx) => {
        const winner = await winnerRepository.findByIdForUpdate(winnerId, tx);
        if (!winner) throw AppError.notFound('That win does not exist.', 'WINNER_NOT_FOUND');
        const paid = transition(winner.state, 'MARK_PAID');

        const updated = await winnerRepository.transition(winnerId, {
          state: paid,
          paymentStatus: paymentStatusFor(paid),
        }, tx);

        await winnerRepository.upsertPayout(winnerId, {
          amountMinor: winner.amount_minor,
          status: 'paid',
          reference: reference ?? null,
          processedBy: actor.id,
          method,
        }, tx);

        await auditRepository.record({
          actorId: actor.id, actorEmail: actor.email,
          action: 'winner.payout', entityType: 'winner', entityId: winnerId,
          metadata: { amountMinor: winner.amount_minor, reference: reference ?? null, method },
        }, tx);

        return updated;
      });
    } catch (error) {
      throw wrap(error);
    }
  },

  async startReview(winnerId, { actor }) {
    try {
      const winner = await winnerRepository.findById(winnerId);
      if (!winner) throw AppError.notFound('That win does not exist.', 'WINNER_NOT_FOUND');
      const next = transition(winner.state, 'START_REVIEW');
      return winnerRepository.transition(winnerId, { state: next, reviewedBy: actor.id });
    } catch (error) {
      throw wrap(error);
    }
  },
};

export default winnerService;
