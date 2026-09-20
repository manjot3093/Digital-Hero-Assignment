import { Router } from 'express';
import winnerController from '../controllers/winnerController.js';
import { authenticate } from '../middleware/authenticate.js';
import { proofUpload } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(authenticate);
router.get('/me', winnerController.mine);
router.post('/:id/proof', uploadLimiter, proofUpload, winnerController.uploadProof);

export default router;
