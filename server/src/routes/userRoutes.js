import { Router } from 'express';
import userController from '../controllers/userController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { profileSchema, charitySelectionSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate);
router.get('/me', userController.me);
router.put('/me', validate({ body: profileSchema }), userController.updateProfile);
// Charity selection is part of onboarding, so it does not require an active
// subscription — a member picks their cause before or after checkout.
router.post('/charity', validate({ body: charitySelectionSchema }), userController.selectCharity);

export default router;
