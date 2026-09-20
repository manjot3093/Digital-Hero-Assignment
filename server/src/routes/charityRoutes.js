import { Router } from 'express';
import charityController from '../controllers/charityController.js';
import { optionalAuth } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { checkoutLimiter } from '../middleware/rateLimit.js';
import { charityQuerySchema, donationSchema } from '../validators/schemas.js';

const router = Router();

router.get('/', validate({ query: charityQuerySchema }), charityController.directory);
router.get('/impact', charityController.impact);
// Donations are open to signed-out visitors too (PRD §08.1).
router.post('/donate', optionalAuth, checkoutLimiter, validate({ body: donationSchema }), charityController.donate);
router.get('/:id', charityController.profile);

export default router;
