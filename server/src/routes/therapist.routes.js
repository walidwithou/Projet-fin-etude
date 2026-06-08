import { Router } from 'express';
import multer from 'multer';
import * as therapistController from '../controllers/therapist.controller.js';
import {
  authenticate,
  authorize,
  requireVerifiedTherapist,
} from '../middleware/auth.middleware.js';

const router = Router();

const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, and PNG are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

// Public routes
router.get('/public', therapistController.getPublicTherapists);
router.get('/public/:id', therapistController.getPublicTherapistProfile);

// Protected routes
router.use(authenticate);

// All therapist self-service routes require:
//   1) role === 'therapist'
//   2) verificationStatus === 'verified'
// `requireVerifiedTherapist` runs after `authorize(['therapist'])`.
const therapistOnly = [authorize(['therapist']), requireVerifiedTherapist];

// Get therapist profile (own profile)
router.get('/profile', therapistOnly, therapistController.getProfile);

// Update therapist profile
router.put('/profile', therapistOnly, therapistController.updateProfile);

// Update availability (legacy JSON-based)
router.put('/availability', therapistOnly, therapistController.updateAvailability);

// Get therapist's available time slots (from TherapistAvailableTimeSlot)
router.get('/availability', therapistOnly, therapistController.getAvailability);

// Create time slots (generates hourly slots from date/time ranges)
router.post('/availability', therapistOnly, therapistController.createTimeSlots);

// Update (modify) an existing time slot
router.put('/availability/:slotId', therapistOnly, therapistController.updateTimeSlot);

// Delete a time slot
router.delete('/availability/:slotId', therapistOnly, therapistController.deleteTimeSlot);

// Get therapist's patients
router.get('/patients', therapistOnly, therapistController.getPatients);

// Get therapist's appointments
router.get('/appointments', therapistOnly, therapistController.getAppointments);

// Get therapist's reviews
router.get('/reviews', therapistOnly, therapistController.getReviews);

// Get therapist statistics/dashboard
router.get('/stats', therapistOnly, therapistController.getStats);

// Upload documents (diplomas, certificates)
// NOTE: this route does NOT use `requireVerifiedTherapist` because
// the therapist MUST upload documents BEFORE being verified — otherwise
// they would be caught in a catch-22 where they cannot upload the very
// documents an admin needs to verify them.
router.post(
  '/documents',
  authenticate,
  authorize(['therapist']),
  upload.array('documents', 10),
  (req, res, next) => {
    therapistController.uploadDocuments(req, res, next);
  }
);

// Admin routes
router.get('/', authorize(['admin']), therapistController.getAllTherapists);
router.get('/:id', authorize(['admin']), therapistController.getTherapistById);
router.put('/:id/verify', authorize(['admin']), therapistController.verifyTherapist);

export default router;
