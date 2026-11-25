import { Router } from 'express';
import {
  loginController,
  logoutController,
  meController,
  registerController,
  updateMeController,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema, updateProfileSchema } from '../validators/schemas';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validateBody(registerSchema), registerController);
authRouter.post('/login', authRateLimiter, validateBody(loginSchema), loginController);
authRouter.post('/logout', logoutController);
authRouter.get('/me', authenticate, meController);
authRouter.patch('/me', authenticate, validateBody(updateProfileSchema), updateMeController);
