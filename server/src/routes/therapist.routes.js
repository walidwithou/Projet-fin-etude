const express = require('express');
const router = express.Router();
const therapistController = require('../controllers/therapist.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

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

// Admin routes
router.get('/', authorize(['admin']), therapistController.getAllTherapists);
router.get('/:id', authorize(['admin']), therapistController.getTherapistById);
router.put('/:id/verify', authorize(['admin']), therapistController.verifyTherapist);

module.exports = router;
