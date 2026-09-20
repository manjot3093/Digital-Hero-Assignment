import { Router } from 'express';
import dashboardController from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// The dashboard itself is readable without an active subscription so a lapsed
// member can see their status and renew; the subscriber-only actions inside it
// are individually gated by requireSubscription.
router.get('/', authenticate, dashboardController.overview);

export default router;
