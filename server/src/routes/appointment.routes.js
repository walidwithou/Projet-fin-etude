import { Router } from 'express';
import * as appointmentController from '../controllers/appointment.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new appointment (patient books with therapist)
router.post('/', authorize(['patient']), appointmentController.create);

// Get appointment by ID
router.get('/:id', authorize(['patient', 'therapist', 'admin']), appointmentController.getById);

// Update appointment status (therapist confirms, completes, etc.)
router.put('/:id/status', authorize(['therapist', 'admin']), appointmentController.updateStatus);

// Cancel appointment
router.put('/:id/cancel', authorize(['patient', 'therapist', 'admin']), appointmentController.cancel);

// Reschedule appointment
router.put('/:id/reschedule', authorize(['patient', 'therapist']), appointmentController.reschedule);

// Get available slots for a therapist
router.get('/slots/:therapistId', authorize(['patient']), appointmentController.getAvailableSlots);

// Get month availability (which days have bookable slots)
router.get('/slots/:therapistId/month-availability', authorize(['patient']), appointmentController.getMonthAvailability);

// Create session report for an appointment (therapist only)
router.post('/:id/report', authorize(['therapist']), appointmentController.createSessionReport);

// Get session report for an appointment (therapist: owns appointment, patient: owns appointment, admin: all)
router.get('/:id/report', authorize(['patient', 'therapist', 'admin']), appointmentController.getSessionReport);

// Admin routes
router.get('/', authorize(['admin']), appointmentController.getAll);

export default router;