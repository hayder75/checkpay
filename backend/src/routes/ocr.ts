/**
 * OCR Routes
 * Handles OCR pattern management and transaction verification
 */

import { Router } from 'express';
import {
  getOCRPatterns,
  verifyOCRTransaction,
  createOCRPatternRequest,
  getMyOCRPatternRequests,
  extractOCRData,
  createOCRPatternAdmin,
  updateOCRPatternAdmin,
} from '../controllers/ocrController';
import { authenticate } from '../middleware/auth';
import { customRateLimiter } from '../middleware/rateLimit';
import { auditLog } from '../middleware/auditLog';
import { asyncHandler } from '../middleware/errorHandler';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store in memory, we'll save to disk in controller
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

// Get universal OCR patterns
// GET /api/ocr/patterns?countryCode=ET&institution=Telebirr
router.get(
  '/patterns',
  authenticate as any,
  customRateLimiter as any,
  auditLog as any,
  asyncHandler(getOCRPatterns)
);

// Verify OCR-extracted transaction
// POST /api/ocr/verify
router.post(
  '/verify',
  authenticate as any,
  customRateLimiter as any,
  auditLog as any,
  asyncHandler(verifyOCRTransaction)
);

// Create OCR pattern request (with image upload)
// POST /api/ocr/patterns/request
router.post(
  '/patterns/request',
  authenticate as any,
  customRateLimiter as any,
  upload.single('sampleImage'),
  auditLog as any,
  asyncHandler(createOCRPatternRequest)
);

// Get user's OCR pattern requests
// GET /api/ocr/patterns/requests
router.get(
  '/patterns/requests',
  authenticate as any,
  customRateLimiter as any,
  auditLog as any,
  asyncHandler(getMyOCRPatternRequests)
);

// Extract transaction data from OCR text
// POST /api/ocr/extract
router.post(
  '/extract',
  authenticate as any,
  customRateLimiter as any,
  auditLog as any,
  asyncHandler(extractOCRData)
);

// Admin: Create OCR pattern
// POST /api/ocr/patterns/admin
router.post(
  '/patterns/admin',
  authenticate as any,
  customRateLimiter as any,
  auditLog as any,
  asyncHandler(createOCRPatternAdmin)
);

// Admin: Update OCR pattern
// PUT /api/ocr/patterns/admin/:id
router.put(
  '/patterns/admin/:id',
  authenticate as any,
  customRateLimiter as any,
  auditLog as any,
  asyncHandler(updateOCRPatternAdmin)
);

export default router;

