import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import {
  register,
  verifyOTP,
  resendOTP,
  googleCallback,
  getMe,
  regenerateApiKey,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { generalRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Configure Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    },
    async (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);

// Auth routes
router.post('/register', generalRateLimiter, register as any);
router.post('/verify-otp', generalRateLimiter, verifyOTP as any);
router.post('/resend-otp', generalRateLimiter, resendOTP as any);
router.get('/me', authenticate as any, getMe as any);
router.post('/regenerate-key', authenticate as any, regenerateApiKey as any);

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  googleCallback as any
);

export default router;

