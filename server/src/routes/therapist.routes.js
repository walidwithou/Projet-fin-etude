import { Router } from 'express';
import multer from 'multer';
import * as therapistController from '../controllers/therapist.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

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

// Get therapist profile (own profile)
router.get('/profile', authorize(['therapist']), therapistController.getProfile);

// Update therapist profile
router.put('/profile', authorize(['therapist']), therapistController.updateProfile);

// Update availability
router.put('/availability', authorize(['therapist']), therapistController.updateAvailability);

// Get therapist's patients
router.get('/patients', authorize(['therapist']), therapistController.getPatients);

// Get therapist's appointments
router.get('/appointments', authorize(['therapist']), therapistController.getAppointments);

// Get therapist's reviews
router.get('/reviews', authorize(['therapist']), therapistController.getReviews);

// Get therapist statistics/dashboard
router.get('/stats', authorize(['therapist']), therapistController.getStats);

// Upload documents (diplomas, certificates)
router.post('/documents', authorize(['therapist']), upload.array('documents', 10), (req, res, next) => {
  therapistController.uploadDocuments(req, res, next);
});

// Admin routes
router.get('/', authorize(['admin']), therapistController.getAllTherapists);
router.get('/:id', authorize(['admin']), therapistController.getTherapistById);
router.put('/:id/verify', authorize(['admin']), therapistController.verifyTherapist);

export default router;