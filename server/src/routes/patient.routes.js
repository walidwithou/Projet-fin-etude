import { Router } from 'express';
import * as patientController from '../controllers/patient.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get patient profile
router.get('/profile', authorize(['patient']), patientController.getProfile);

// Update patient profile
router.put('/profile', authorize(['patient']), patientController.updateProfile);

// Submit onboarding questionnaire
router.post('/questionnaire', authorize(['patient']), patientController.submitQuestionnaire);

// Get matched therapists based on questionnaire
router.get('/matched-therapists', authorize(['patient']), patientController.getMatchedTherapists);

// Select a therapist
router.post('/select-therapist', authorize(['patient']), patientController.selectTherapist);

// Get patient's appointments
router.get('/appointments', authorize(['patient']), patientController.getAppointments);

// Get patient's session reports (visible to patient)
router.get('/session-reports', authorize(['patient']), patientController.getSessionReports);

// Admin routes
router.get('/', authorize(['admin']), patientController.getAllPatients);
router.get('/:id', authorize(['admin', 'therapist']), patientController.getPatientById);

export default router;