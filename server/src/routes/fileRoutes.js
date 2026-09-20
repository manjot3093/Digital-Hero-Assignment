import { Router } from 'express';
import { storageProvider } from '../integrations/storage/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';

const router = Router();

/**
 * Serves a stored object against a time-limited HMAC signature. Only the local
 * driver needs this; with S3 the signed URL points straight at the bucket.
 */
router.get('/', asyncHandler(async (req, res) => {
  if (env.storage.driver !== 'local') {
    throw AppError.notFound('Files are served directly by object storage.', 'NOT_APPLICABLE');
  }
  const { key, expires, signature } = req.query;
  if (!key || !expires || !signature) throw AppError.badRequest('That link is incomplete.', 'INVALID_LINK');

  const provider = storageProvider();
  if (!provider.verifySignature(key, expires, signature)) {
    throw AppError.forbidden('That link has expired.', 'LINK_EXPIRED');
  }

  const buffer = await provider.get(String(key));
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Disposition', 'inline');
  return res.send(buffer);
}));

export default router;
