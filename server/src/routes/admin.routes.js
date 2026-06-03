import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as documentController from '../controllers/document.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// Dashboard statistics
router.get('/stats', adminController.getDashboardStats);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id/status', adminController.updateUserStatus);

// Therapist verification
router.get('/therapists/pending', adminController.getPendingTherapists);
router.put('/therapists/:id/verify', adminController.verifyTherapist);
router.put('/therapists/:id/reject', adminController.rejectTherapist);

// Document management (Filebase-backed S3 storage)
router.get('/documents', documentController.listDocuments);
router.get('/documents/:id', documentController.getDocument);
router.get('/documents/:id/download', documentController.getDocumentDownloadUrl);
router.delete('/documents/:id', documentController.deleteDocument);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

// Reports
router.get('/reports/appointments', adminController.getAppointmentReports);
router.get('/reports/revenue', adminController.getRevenueReports);

export default router;
