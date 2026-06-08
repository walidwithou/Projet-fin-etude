import { prisma } from "../../db/prisma.js";
import crypto from "crypto";

const generateId = () => crypto.randomUUID();

/**
 * Vérifie si un utilisateur a le droit d'envoyer un message à un autre.
 *
 * PATIENT → uniquement son currentTherapist
 * THÉRAPEUTE → uniquement ses patients actifs (ceux qui ont currentTherapistid = lui)
 * ADMIN → bypass (non implémenté ici)
 */
const canMessage = async (senderId, receiverId, role) => {
  if (role === "patient") {
    // Le patient envoie → receiverId doit être son currentTherapist
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

  if (role === "therapist") {
    // Le thérapeute répond → senderId (lui) doit être le currentTherapist du patient
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

/**
 * Génère un conversationId déterministe basé sur les deux User.id triés.
 * Identique à la logique dans message.controller.js
 *
 * IMPORTANT: conversationId doit être construit uniquement avec des User.id.
 * Ne jamais utiliser Patient.id ou Therapist.id.
 * Le résultat doit être déterministe : [userId1, userId2].sort().
 * Backend et frontend doivent utiliser EXACTEMENT le même algorithme.
 */
const generateConversationId = (userId1, userId2) => {
  if (!userId1 || !userId2) {
    console.error(
      "[CRITICAL] generateConversationId called with invalid participants",
    );
    return undefined;
  }
  const sorted = [userId1, userId2].sort();
  return `conv_${sorted[0]}_${sorted[1]}`;
};

/**
 * Enregistre les handlers Socket.IO pour la messagerie.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export const registerMessageHandlers = (io, socket) => {
  const { userId, role } = socket.data;

  /**
   * Envoi d'un message en temps réel.
   * Payload : { receiverId, content, messageType }
   *
   * 1. Validation métier (canMessage)
   * 2. Création en DB
   * 3. Notification si destinataire hors ligne
   * 4. Emission des events
   */
  socket.on("message:send", async (data, callback) => {
    try {
      const { receiverId, content, messageType } = data;

      if (!receiverId || !content) {
        if (callback)
          callback({
            success: false,
            message: "receiverId and content are required",
          });
        return;
      }

      // Étape 1 : Validation métier
      const allowed = await canMessage(userId, receiverId, role);
      if (!allowed) {
        if (callback)
          callback({
            success: false,
            message: "Vous ne pouvez pas envoyer un message à cet utilisateur",
          });
        return;
      }

      // Étape 2 : Générer conversationId
      const conversationId = generateConversationId(userId, receiverId);

      // Étape 3 : Créer le message en DB
      // Note : le champ Prisma s'appelle conversationId (mappé à la colonne roomId en DB)
      const message = await prisma.message.create({
        data: {
          id: generateId(),
          senderId: userId,
          receiverId,
          conversationId,
          content,
          messageType: messageType || "text",
        },
      });

      // Étape 4 : Créer notification pour le destinataire
      // On la crée toujours — le frontend gère l'affichage
      const notificationData = {
        id: generateId(),
        userId: receiverId,
        type: "message",
        title: "Nouveau message",
        message: `Vous avez reçu un nouveau message`,
        actionUrl: `/messages/${conversationId}`,
      };

      const notification = await prisma.notification.create({
        data: notificationData,
      });

      // Étape 5 : Compter les non-lus du destinataire
      const unreadCount = await prisma.message.count({
        where: {
          receiverId,
          isRead: false,
        },
      });

      // Étape 6 : Emettre les events via Socket.IO
      // Notifier le destinataire
      io.to(`user:${receiverId}`).emit("message:new", message);
      io.to(`user:${receiverId}`).emit("notification:new", notification);
      io.to(`user:${receiverId}`).emit("unread:count", {
        count: Number(unreadCount),
      });

      // Notifier l'expéditeur aussi (au cas où il aurait plusieurs onglets)
      io.to(`user:${userId}`).emit("message:new", message);

      // Mettre à jour les deux côtés pour la liste des conversations
      io.to(`user:${receiverId}`).emit("conversation:updated", {
        conversationId,
      });
      io.to(`user:${userId}`).emit("conversation:updated", { conversationId });

      // Succès
      if (callback) callback({ success: true, data: message });
    } catch (error) {
      console.error("[socket] message:send error:", error.message);
      if (callback) callback({ success: false, message: error.message });
    }
  });

  /**
   * Modification d'un message existant.
   * Payload : { messageId, content }
   *
   * Validations :
   * - message existe
   * - message.senderId === socket.data.userId
   * - contenu non vide
   * - longueur maximale identique à celle de l'envoi normal
   */
  socket.on("message:edit", async (data, callback) => {
    try {
      const { messageId, content } = data;

      // Validation : messageId requis
      if (!messageId) {
        if (callback)
          callback({ success: false, message: "messageId is required" });
        return;
      }

      // Validation : contenu non vide
      if (!content || !content.trim()) {
        if (callback)
          callback({ success: false, message: "Content cannot be empty" });
        return;
      }

      // Validation : longueur maximale (2000 caractères, identique à l'envoi normal)
      if (content.length > 2000) {
        if (callback) callback({ success: false, message: "Content too long" });
        return;
      }

      // Récupérer le message existant
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      // Validation : message existe
      if (!message) {
        if (callback) callback({ success: false });
        return;
      }

      // Validation : seul l'expéditeur peut modifier
      if (message.senderId !== userId) {
        if (callback) callback({ success: false });
        return;
      }

      // Mettre à jour le message en DB
      const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: {
          content: content.trim(),
          isEdited: true,
        },
      });

      // Emettre l'événement aux deux participants
      io.to(`user:${message.senderId}`).emit("message:updated", updatedMessage);
      io.to(`user:${message.receiverId}`).emit(
        "message:updated",
        updatedMessage,
      );

      // Succès
      if (callback) callback({ success: true, data: updatedMessage });
    } catch (error) {
      console.error("[socket] message:edit error:", error.message);
      if (callback) callback({ success: false });
    }
  });

  /**
   * Suppression logique d'un message.
   * Payload : { messageId }
   *
   * Validations :
   * - message existe
   * - message.senderId === socket.data.userId
   * - message pas déjà supprimé
   * 
   * Comportement :
   * - content = 'Ce message a été supprimé'
   * - isDeleted = true
   * - PAS de prisma.message.delete()
   */
  socket.on("message:delete", async (data, callback) => {
    try {
      const { messageId } = data;

      if (!messageId) {
        if (callback) callback({ success: false });
        return;
      }

      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        if (callback) callback({ success: false });
        return;
      }

      if (message.senderId !== userId) {
        if (callback) callback({ success: false });
        return;
      }

      if (message.isDeleted) {
        if (callback) callback({ success: false, message: "Already deleted" });
        return;
      }

      const deletedMessage = await prisma.message.update({
        where: { id: messageId },
        data: {
          content: "Ce message a été supprimé",
          isDeleted: true,
        },
      });

      io.to(`user:${message.senderId}`).emit("message:deleted", deletedMessage);
      io.to(`user:${message.receiverId}`).emit("message:deleted", deletedMessage);

      if (callback) callback({ success: true });
    } catch (error) {
      console.error("[socket] message:delete error:", error.message);
      if (callback) callback({ success: false });
    }
  });

  /**
   * Marquage d'un message comme lu.
   * Payload : { messageId }
   */
  socket.on("message:read", async (data, callback) => {
    try {
      const { messageId } = data;

      if (!messageId) {
        if (callback)
          callback({ success: false, message: "messageId is required" });
        return;
      }

      // Vérifier que le user est bien le receiver de ce message
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        if (callback)
          callback({ success: false, message: "Message not found" });
        return;
      }

      if (message.receiverId !== userId) {
        if (callback) callback({ success: false, message: "Access denied" });
        return;
      }

      // Marquer comme lu
      const updated = await prisma.message.update({
        where: { id: messageId },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      // Compter les non-lus restants
      const unreadCount = await prisma.message.count({
        where: {
          receiverId: userId,
          isRead: false,
        },
      });

      // Notifier l'expéditeur que son message a été lu
      io.to(`user:${message.senderId}`).emit("message:read", {
        messageId: updated.id,
        conversationId: generateConversationId(
          message.senderId,
          message.receiverId,
        ),
      });

      // Mettre à jour le compteur non-lu du receiver
      io.to(`user:${userId}`).emit("unread:count", {
        count: Number(unreadCount),
      });

      if (callback) callback({ success: true, data: updated });
    } catch (error) {
      console.error("[socket] message:read error:", error.message);
      if (callback) callback({ success: false, message: error.message });
    }
  });

  /**
   * Récupération des messages manqués (après reconnexion).
   * Payload : { since: ISO timestamp }
   */
  socket.on("messages:missed", async (data, callback) => {
    try {
      const { since } = data;

      if (!since) {
        if (callback)
          callback({ success: false, message: "since timestamp is required" });
        return;
      }

      const messages = await prisma.message.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
          createdAt: { gt: new Date(since) },
        },
        orderBy: { createdAt: "asc" },
      });

      if (callback) callback({ success: true, data: messages });
    } catch (error) {
      console.error("[socket] messages:missed error:", error.message);
      if (callback) callback({ success: false, message: error.message });
    }
  });
};
