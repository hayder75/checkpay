import { Router } from 'express';
import {
  register,
  login,
  verifyOTP,
  resendOTP,
  getMe,
  regenerateApiKey,
  getSimCards,
  addSimCard,
  removeSimCard,
  checkSimCard,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { generalRateLimiter } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Auth routes - wrapped with asyncHandler to catch errors
router.post('/register', generalRateLimiter, asyncHandler(register));
router.post('/login', generalRateLimiter, asyncHandler(login));
router.post('/verify-otp', generalRateLimiter, asyncHandler(verifyOTP));
router.post('/resend-otp', generalRateLimiter, asyncHandler(resendOTP));
router.get('/me', authenticate as any, asyncHandler(getMe));
router.post('/regenerate-key', authenticate as any, asyncHandler(regenerateApiKey));

// SIM card management routes
router.get('/sims', authenticate as any, asyncHandler(getSimCards));
router.post('/sims', authenticate as any, asyncHandler(addSimCard));
router.delete('/sims', authenticate as any, asyncHandler(removeSimCard));
router.get('/sims/check', authenticate as any, asyncHandler(checkSimCard));

export default router;

