import { Router } from 'express';
import * as reviewController from '../controllers/review.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// Public routes
router.get('/therapist/:therapistId', reviewController.getTherapistReviews);

// Protected routes
router.use(authenticate);

// Create a review (patient only)
router.post('/', authorize(['patient']), reviewController.create);

// Update a review (patient only, own review)
router.put('/:id', authorize(['patient']), reviewController.update);

// Delete a review (patient only, own review)
router.delete('/:id', authorize(['patient']), reviewController.delete);

// Admin routes
router.get('/', authorize(['admin']), reviewController.getAll);
router.put('/:id/visibility', authorize(['admin']), reviewController.toggleVisibility);

export default router;