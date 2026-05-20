import { Router, Response } from 'express';
import passport from '../config/passport';
import { z } from 'zod';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { 
  register, 
  login, 
  getMe, 
  updateRole, 
  updatePassword,
  updateProfile,
  updateBusinessProfile,
  resetPasswordByPhone,
  regenerateKey,
  completeProfile,
  handleGoogleAuthSuccess, 
  handleGoogleAuthFailure 
} from '../controllers/authController';
import { generalRateLimiter } from '../middleware/rateLimit';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

router.post('/register', generalRateLimiter, asyncHandler(register));
router.post('/login', generalRateLimiter, asyncHandler(login));
router.get('/me', authenticate as any, asyncHandler(getMe));
router.put('/role', authenticate as any, asyncHandler(updateRole));
router.put('/password', authenticate as any, asyncHandler(updatePassword));
router.put('/profile', authenticate as any, asyncHandler(updateProfile));
router.put('/business-profile', authenticate as any, asyncHandler(updateBusinessProfile));
router.post('/complete-profile', authenticate as any, asyncHandler(completeProfile));
router.post('/reset-password', generalRateLimiter, asyncHandler(resetPasswordByPhone));
router.post('/regenerate-key', authenticate as any, asyncHandler(regenerateKey));

router.get(
  '/google',
  (req, res, next) => {
    const redirectUri = req.query.redirect_uri as string | undefined;
    let state: string | undefined;
    
    if (redirectUri) {
      const stateData = { redirect_uri: redirectUri };
      state = Buffer.from(JSON.stringify(stateData)).toString('base64');
    }
    
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      accessType: 'offline',
      prompt: 'consent',
      state: state,
    })(req, res, next);
  }
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/auth/google/failure',
    session: false,
  }),
  asyncHandler(handleGoogleAuthSuccess)
);

router.get('/google/failure', asyncHandler(handleGoogleAuthFailure));

// Generate QR signup token for mobile app linking
router.get('/generate-qr-signup', authenticate as any, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const signupToken = jwt.sign(
    { 
      type: 'developer-link', 
      userId: req.user.id,
      createdAt: Date.now()
    },
    JWT_SECRET,
    { expiresIn: '5m' }
  );

  const qrData = JSON.stringify({
    type: 'developer-link',
    token: signupToken,
    expiresIn: 300
  });

  const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M'
  });

  res.json({
    success: true,
    data: {
      qrCode: qrCodeDataUrl,
      token: signupToken,
      expiresIn: 300,
      timestamp: Date.now()
    }
  });
}));

// Verify QR signup token
router.post('/verify-qr-signup', asyncHandler(async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    token: z.string().min(1, 'Token is required'),
  });

  const { token } = schema.parse(req.body);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.type !== 'developer-link') {
      throw new AppError(400, 'Invalid QR code type');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        apiKey: true,
        role: true,
        plan: true,
      }
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          apiKey: user.apiKey,
          role: user.role,
          plan: user.plan,
        },
        message: 'QR code verified successfully'
      }
    });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError(400, 'QR code has expired');
    }
    throw new AppError(400, 'Invalid QR code token');
  }
}));

export default router;

// Alias route for device linking
router.get('/generate-device-link', authenticate as any, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const signupToken = jwt.sign(
    { 
      type: 'developer-link', 
      userId: req.user.id,
      createdAt: Date.now()
    },
    JWT_SECRET,
    { expiresIn: '5m' }
  );

  const qrData = JSON.stringify({
    type: 'developer-link',
    token: signupToken,
    expiresIn: 300
  });

  const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M'
  });

  res.json({
    success: true,
    data: {
      qrCode: qrCodeDataUrl,
      token: signupToken,
      expiresIn: 300,
      timestamp: Date.now()
    }
  });
}));
