import { Router } from 'express';
import { verifyTransaction } from '../controllers/txnController';
import { authenticateApiKey } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// Verify endpoint uses API key auth
router.get('/', authenticateApiKey as any, auditLog as any, verifyTransaction as any);

export default router;

