import { Router } from 'express';
import { authController } from './controller';
import { authenticate } from '../../shared/middleware/auth';
import { authLimiter } from '../../shared/middleware/rate-limiter';

const router = Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/send-otp', authLimiter, authController.sendOtp);
router.post('/verify-otp', authLimiter, authController.verifyOtp);
router.post('/refresh-token', authController.refreshToken);
router.post('/google', authController.googleAuth);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.delete('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
