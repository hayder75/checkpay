import { Router } from 'express';
import { verifyTransaction, verifyClusterTransaction } from '../controllers/txnController';
import { authenticateApiKey } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { asyncHandler } from '../middleware/errorHandler';
import { requireSignedApiAuth } from '../middleware/signedApiAuth';
import { clusterVerifyRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.get('/cluster', authenticateApiKey as any, requireSignedApiAuth as any, clusterVerifyRateLimiter as any, auditLog as any, asyncHandler(verifyClusterTransaction));
router.post('/cluster', authenticateApiKey as any, requireSignedApiAuth as any, clusterVerifyRateLimiter as any, auditLog as any, asyncHandler(verifyClusterTransaction));

router.get('/', authenticateApiKey as any, auditLog as any, asyncHandler(verifyTransaction));
router.post('/', authenticateApiKey as any, auditLog as any, asyncHandler(verifyTransaction));

export default router;
