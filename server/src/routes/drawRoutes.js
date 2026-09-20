import { Router } from 'express';
import drawController from '../controllers/drawController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/', drawController.list);
router.get('/current', drawController.current);
router.get('/me', authenticate, drawController.myParticipation);
router.get('/:id', drawController.detail);

export default router;
