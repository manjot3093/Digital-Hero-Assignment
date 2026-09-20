import multer from 'multer';
import env from '../config/env.js';
import { ALLOWED_PROOF_TYPES } from '../integrations/storage/index.js';
import AppError from '../utils/AppError.js';

/**
 * Proof uploads are held in memory only long enough to hand to the storage
 * provider — nothing is written to the API server's disk.
 */
export const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.storage.maxFileBytes, files: 1 },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_PROOF_TYPES.includes(file.mimetype)) {
      return callback(AppError.badRequest('Upload a PNG, JPEG, WebP or PDF.', 'INVALID_FILE_TYPE'));
    }
    return callback(null, true);
  },
}).single('proof');

export default proofUpload;
