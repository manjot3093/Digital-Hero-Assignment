import { Router } from 'express';
import authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { registerSchema, loginSchema, changePasswordSchema } from '../validators/schemas.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post('/password', authenticate, authLimiter, validate({ body: changePasswordSchema }), authController.changePassword);

export default router;
