import { Router } from 'express';
import subscriptionController from '../controllers/subscriptionController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { checkoutLimiter } from '../middleware/rateLimit.js';
import { checkoutSchema } from '../validators/schemas.js';

const router = Router();

router.get('/plans', subscriptionController.plans);
router.get('/', authenticate, subscriptionController.mine);
router.post('/checkout', authenticate, checkoutLimiter, validate({ body: checkoutSchema }), subscriptionController.checkout);
router.post('/portal', authenticate, checkoutLimiter, subscriptionController.portal);
router.post('/cancel', authenticate, subscriptionController.cancel);

export default router;
