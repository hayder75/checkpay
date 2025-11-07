import { Router } from 'express';
import { ingestTransaction } from '../controllers/txnController';
import { authenticateApiKey } from '../middleware/auth';
import { customRateLimiter } from '../middleware/rateLimit';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// Ingest endpoint uses API key auth and custom rate limiting
router.post('/', authenticateApiKey as any, customRateLimiter as any, auditLog as any, ingestTransaction as any);

export default router;

