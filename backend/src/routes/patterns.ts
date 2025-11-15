import { Router } from 'express';
import {
  createPattern,
  getPatterns,
  getPattern,
  updatePattern,
  deletePattern,
  validatePatternEndpoint,
  getInstitutionPattern,
  createPatternFromSample,
  checkPatternAndExtract,
  getInstitutionsWithPatterns,
  getCountryPatterns,
} from '../controllers/patternController';
import { authenticate } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// Institution pattern routes (can be accessed without auth for onboarding)
router.get('/institution/:institution', getInstitutionPattern as any);
router.get('/institutions', getInstitutionsWithPatterns as any);
router.get('/country/:countryCode', getCountryPatterns as any);
router.post('/check-and-extract', checkPatternAndExtract as any);
router.post('/create-from-sample', createPatternFromSample as any);

// All other pattern routes require authentication
router.use(authenticate as any);
router.use(auditLog as any);

router.post('/', createPattern as any);
router.get('/', getPatterns as any);
router.get('/:id', getPattern as any);
router.put('/:id', updatePattern as any);
router.delete('/:id', deletePattern as any);
router.post('/validate', validatePatternEndpoint as any);

export default router;

