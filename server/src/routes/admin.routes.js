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
router.put('/users/:id/ban', adminController.banUser);
router.put('/users/:id/reactivate', adminController.reactivateUser);

// Therapist verification
router.get('/therapists', adminController.getAllTherapists);
router.get('/therapists/pending', adminController.getPendingTherapists);
// Returns the full practitioner profile + User + SIGNED document URLs
// in a single round-trip. See admin.controller.js -> getTherapistVerificationDetails.
router.get('/therapists/:id/verification-details', adminController.getTherapistVerificationDetails);
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

// Reconciliation — detect and fix appointment/slot inconsistencies
router.post('/reconciliation', async (req, res, next) => {
  try {
    const { runReconciliation } = await import('../utils/reconciliation.js');
    const result = await runReconciliation();
    res.json({
      success: true,
      message: `${result.fixed} incohérence(s) corrigée(s)`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
