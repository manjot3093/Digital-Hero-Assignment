import { Router } from 'express';
import scoreController from '../controllers/scoreController.js';
import { authenticate, requireSubscription } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { scoreSchema, scoreUpdateSchema, uuid } from '../validators/schemas.js';
import { z } from 'zod';

const router = Router();
const idParam = z.object({ id: uuid });

// Score entry is a subscriber feature: both checks run on every request.
router.use(authenticate, requireSubscription);

router.get('/', scoreController.list);
router.post('/', validate({ body: scoreSchema }), scoreController.create);
router.put('/:id', validate({ params: idParam, body: scoreUpdateSchema }), scoreController.update);
router.delete('/:id', validate({ params: idParam }), scoreController.remove);

export default router;
