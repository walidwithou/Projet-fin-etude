import { Router } from 'express';
import * as patientController from '../controllers/patient.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// ---------------------------------------------------------------------------
// Authentication is enforced for EVERY route mounted below via
// `router.use(authenticate)`. Each individual route additionally gates
// access to the right role(s) with `authorize([...])`.
//
// IMPORTANT: do NOT swap the order. `authenticate` must run first so
// that `req.user`, `req.role`, and `req.profile` are populated before
// the role gate checks `req.role`. Reordering these middlewares
// (e.g. listing `authorize` before `authenticate` on a new route)
// is the most common source of "Authentication failed" regressions.
// ---------------------------------------------------------------------------
router.use(authenticate);

// Get patient profile
router.get('/profile', authorize(['patient']), patientController.getProfile);

// Update patient profile
router.put('/profile', authorize(['patient']), patientController.updateProfile);

// Submit onboarding questionnaire
router.post('/questionnaire', authorize(['patient']), patientController.submitQuestionnaire);

// Get matched therapists based on questionnaire
// NOTE: relies on `authenticate` (via router.use above) populating
// `req.user.id` and `req.role === 'patient'`. If the front-end ever
// starts calling this endpoint as a therapist or admin, the role
// gate below will reject it with a 403 "Insufficient permissions"
// rather than the generic 500 "Authentication failed".
router.get(
  '/matched-therapists',
  authorize(['patient']),
  patientController.getMatchedTherapists,
);

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