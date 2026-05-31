const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

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

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

// Reports
router.get('/reports/appointments', adminController.getAppointmentReports);
router.get('/reports/revenue', adminController.getRevenueReports);

module.exports = router;
