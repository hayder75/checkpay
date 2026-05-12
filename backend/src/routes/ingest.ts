import { Router } from 'express';
import { ingestTransaction } from '../controllers/txnController';
import { authenticateApiKey } from '../middleware/auth';
import { customRateLimiter } from '../middleware/rateLimit';
import { auditLog } from '../middleware/auditLog';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.post('/', authenticateApiKey as any, customRateLimiter as any, auditLog as any, asyncHandler(ingestTransaction));

export default router;

