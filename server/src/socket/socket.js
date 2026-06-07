import { Server } from 'socket.io';
import { authenticateSocket } from './auth.socket.js';
import { registerMessageHandlers } from './handlers/message.handler.js';

/** @type {import('socket.io').Server | null} */
let _io = null;

/**
 * Retourne l'instance Socket.IO (ou null si pas encore initialisée).
 */
export const getIO = () => _io;

/**
 * Crée et configure le serveur Socket.IO.
 *
 * @param {import('http').Server} httpServer - Le serveur HTTP Express
 * @returns {import('socket.io').Server}
 */
export const createSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Permettre le fallback polling si WebSocket est bloqué
    transports: ['websocket', 'polling'],
  });

  // Middleware d'authentification (exécuté avant chaque connexion)
  io.use(authenticateSocket);

  // Stocker l'instance pour l'export getIO()
  _io = io;

  // Gérer les connexions
  io.on('connection', (socket) => {
    const { userId, role } = socket.data;

    // Rejoindre sa propre room privée
    // Les events sont émis vers `user:${userId}` pour un delivery ciblé
    socket.join(`user:${userId}`);

    console.log(`[socket] ${role}:${userId.substring(0, 8)}... connected (socket: ${socket.id.substring(0, 8)}...)`);

    // Enregistrer les handlers de messagerie
    registerMessageHandlers(io, socket);

    // Gérer la déconnexion
    socket.on('disconnect', (reason) => {
      console.log(`[socket] ${role}:${userId.substring(0, 8)}... disconnected (reason: ${reason})`);
    });

    // Gérer les erreurs
    socket.on('error', (error) => {
      console.error(`[socket] ${role}:${userId.substring(0, 8)}... error:`, error.message);
    });
  });

  return io;
};