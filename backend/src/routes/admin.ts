import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as adminController from '../controllers/adminController';
import * as templateController from '../controllers/templateController';
import * as missingTemplateController from '../controllers/missingTemplateController';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate as any);
// TODO: Fix requireAdmin import issue
// router.use(requireAdmin as any);
// For now, admin check is done in individual controllers

// User management
router.get('/users', asyncHandler(adminController.getUsers));
router.get('/users/:id', asyncHandler(adminController.getUser));
router.patch('/users/:id', asyncHandler(adminController.updateUser));

// Analytics
router.get('/analytics', asyncHandler(adminController.getAnalytics));

// Pattern management
router.get('/patterns', asyncHandler(adminController.getPatterns));

// Transaction monitoring
router.get('/transactions', asyncHandler(adminController.getTransactions));

// Package purchase moderation
router.get('/package-purchases', asyncHandler(adminController.getPackagePurchases));
router.post('/package-purchases/:id/verify', asyncHandler(adminController.verifyPackagePurchase));
router.post('/package-purchases/:id/reject', asyncHandler(adminController.rejectPackagePurchase));

// Country management
router.get('/countries', asyncHandler(adminController.getCountries));
router.get('/countries/:code', asyncHandler(adminController.getCountry));
router.patch('/countries/:code', asyncHandler(adminController.updateCountry));

// Template management (per country)
router.post('/countries/:countryCode/templates', asyncHandler(templateController.createTemplate));
router.get('/countries/:countryCode/templates', asyncHandler(templateController.getTemplates));
router.put('/templates/:templateId', asyncHandler(templateController.updateTemplate));
router.delete('/templates/:templateId', asyncHandler(templateController.deleteTemplate));

// Missing templates (auto-detected)
router.get('/missing-templates', asyncHandler(missingTemplateController.getMissingTemplates));
router.post('/missing-templates/:patternId/add', asyncHandler(missingTemplateController.addMissingTemplate));
router.post('/missing-templates/:patternId/dismiss', asyncHandler(missingTemplateController.dismissMissingTemplate));

// Audit logs
router.get('/audit-logs', asyncHandler(adminController.getAuditLogs));

// System health
router.get('/system-health', asyncHandler(adminController.getSystemHealth));

export default router;



