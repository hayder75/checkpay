import { Router } from 'express';
import {
  getClusterMe,
  createClusterRequest,
  getIncomingClusterRequests,
  getOutgoingClusterRequests,
  acceptClusterRequest,
  rejectClusterRequest,
  cancelClusterRequest,
  deleteClusterRequest,
} from '../controllers/clusterController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate as any);
router.use(auditLog as any);

router.get('/me', asyncHandler(getClusterMe));
router.post('/requests', asyncHandler(createClusterRequest));
router.get('/requests/incoming', asyncHandler(getIncomingClusterRequests));
router.get('/requests/outgoing', asyncHandler(getOutgoingClusterRequests));
router.post('/requests/:id/accept', asyncHandler(acceptClusterRequest));
router.post('/requests/:id/reject', asyncHandler(rejectClusterRequest));
router.post('/requests/:id/cancel', asyncHandler(cancelClusterRequest));
router.delete('/requests/:id', asyncHandler(deleteClusterRequest));

export default router;
