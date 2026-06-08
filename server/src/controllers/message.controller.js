import { prisma } from '../db/prisma.js';
import { getIO } from '../socket/socket.js';
import crypto from 'crypto';

const generateId = () => crypto.randomUUID();

/**
 * Get all conversations for the current user
 */
const getConversations = async (req, res, next) => {
  try {
    // Get distinct conversation IDs for the user
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: req.user.id }, { receiverId: req.user.id }],
      },
      distinct: ['conversationId'],
      orderBy: { createdAt: 'desc' },
    });

    const conversations = [];

    for (const msg of messages) {
      const lastMessage = await prisma.message.findFirst({
        where: { conversationId: msg.conversationId },
        orderBy: { createdAt: 'desc' },
      });

      const unreadCount = await prisma.message.count({
        where: {
          receiverId: req.user.id,
          isRead: false,
        },
      });

      // Get the other participant
      const otherUserId = lastMessage?.senderId === req.user.id ? lastMessage.receiverId : lastMessage?.senderId;

      conversations.push({
        conversationId: msg.conversationId,
        lastMessage,
        unreadCount,
        otherUserId,
      });
    }

    res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages in a conversation (by roomId)
 */
const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Verify user is part of the conversation
    const userMessage = await prisma.message.findFirst({
      where: {
        conversationId,
        OR: [{ senderId: req.user.id }, { receiverId: req.user.id }],
      },
    });

    if (!userMessage) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    res.json({
      success: true,
      data: messages.reverse(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vérifie si un utilisateur a le droit d'envoyer un message.
 * PATIENT → uniquement son currentTherapist
 * THÉRAPEUTE → uniquement ses patients actifs
 */
const canMessage = async (senderId, receiverId, role) => {
  if (role === 'patient') {
    const patient = await prisma.patient.findFirst({
      where: { userId: senderId },
      select: { currentTherapistid: true },
    });
    const therapist = await prisma.therapist.findFirst({
      where: { userId: receiverId },
      select: { id: true },
    });
    if (!patient || !therapist) return false;
    return patient.currentTherapistid === therapist.id;
  }

  if (role === 'therapist') {
    const therapist = await prisma.therapist.findFirst({
      where: { userId: senderId },
      select: { id: true },
    });
    const patient = await prisma.patient.findFirst({
      where: { userId: receiverId },
      select: { currentTherapistid: true },
    });
    if (!therapist || !patient) return false;
    return patient.currentTherapistid === therapist.id;
  }

  return false;
};

const send = async (req, res, next) => {
  try {
    const { receiverId, content, messageType } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and content are required',
      });
    }

    // Validation métier
    const allowed = await canMessage(req.user.id, receiverId, req.role);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pas envoyer un message à cet utilisateur',
      });
    }

    // IMPORTANT: conversationId doit être construit uniquement avec des User.id.
    // Ne jamais utiliser Patient.id ou Therapist.id.
    // Le résultat doit être déterministe : [userId1, userId2].sort().
    // Backend et frontend doivent utiliser EXACTEMENT le même algorithme.
    // Generate conversation ID (sorted user IDs)
    const sortedIds = [req.user.id, receiverId].sort();
    const conversationId = `conv_${sortedIds[0]}_${sortedIds[1]}`;

    const message = await prisma.message.create({
      data: {
        id: generateId(),
        senderId: req.user.id,
        receiverId,
        conversationId,
        content,
        messageType: messageType || 'text',
      },
    });

    // Récupérer le nom de l'expéditeur pour la notification
    const sender = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true },
    });

    // Create notification for receiver
    const notification = await prisma.notification.create({
      data: {
        id: generateId(),
        userId: receiverId,
        type: 'message',
        title: `Nouveau message de ${sender?.name || "Utilisateur"}`,
        message: 'Vous avez reçu un nouveau message',
        actionUrl: `/messages/${conversationId}`,
      },
    });

    const unreadCount = await prisma.message.count({
      where: { receiverId, isRead: false },
    });

    // Émettre les events Socket.IO
    const io = getIO();
    if (io) {
      io.to(`user:${receiverId}`).emit('message:new', message);
      io.to(`user:${receiverId}`).emit('notification:new', notification);
      io.to(`user:${receiverId}`).emit('unread:count', { count: Number(unreadCount) });
      io.to(`user:${req.user.id}`).emit('message:new', message);
      io.to(`user:${receiverId}`).emit('conversation:updated', { conversationId });
      io.to(`user:${req.user.id}`).emit('conversation:updated', { conversationId });
    }

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark message as read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const message = await prisma.message.findUnique({ where: { id } });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    if (message.receiverId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const updated = await prisma.message.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all messages in a conversation as read
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    await prisma.message.updateMany({
      where: {
        conversationId,
        receiverId: req.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'All messages marked as read',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread message count
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await prisma.message.count({
      where: {
        receiverId: req.user.id,
        isRead: false,
      },
    });

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};

export {
  getConversations,
  getMessages,
  send,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};