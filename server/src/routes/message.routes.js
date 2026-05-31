const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Get all conversations for the current user
router.get('/conversations', authorize(['patient', 'therapist']), messageController.getConversations);

// Get messages in a conversation
router.get('/conversations/:conversationId', authorize(['patient', 'therapist']), messageController.getMessages);

// Send a message
router.post('/', authorize(['patient', 'therapist']), messageController.send);

// Mark message as read
router.put('/:id/read', authorize(['patient', 'therapist']), messageController.markAsRead);

// Mark all messages in a conversation as read
router.put('/conversations/:conversationId/read-all', authorize(['patient', 'therapist']), messageController.markAllAsRead);

// Get unread message count
router.get('/unread-count', authorize(['patient', 'therapist']), messageController.getUnreadCount);

module.exports = router;
