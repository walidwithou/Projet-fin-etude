import { Router } from 'express';
import multer from 'multer';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

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

// Register a new user (multer handles file uploads if present)
router.post('/register', upload.array('documents', 10), (req, res, next) => {
  // Multer middleware must run before controller for req.files to be populated
  authController.register(req, res, next);
});

// Login user
router.post('/login', authController.login);

// Logout user
router.post('/logout', authController.logout);

// Get current user (requires authentication)
router.get('/me', authenticate, authController.getCurrentUser);

// Request password reset
router.post('/forgot-password', authController.forgotPassword);

// Reset password
router.post('/reset-password', authController.resetPassword);

// Verify email
router.post('/verify-email', authController.verifyEmail);

export default router;