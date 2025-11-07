import { Router } from 'express';
import { getStats, getTransactions } from '../controllers/txnController';
import { authenticate } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate as any);
router.use(auditLog as any);

router.get('/stats', getStats as any);
router.get('/transactions', getTransactions as any);

export default router;

