import { Router } from 'express';
import { ingestTransaction } from '../controllers/txnController';
import { authenticate } from '../middleware/auth'; // Use JWT token auth instead of API key
import { customRateLimiter } from '../middleware/rateLimit';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// Ingest endpoint uses JWT token auth (normal authentication) and custom rate limiting
router.post('/', authenticate as any, customRateLimiter as any, auditLog as any, ingestTransaction as any);

export default router;

