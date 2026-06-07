import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

/**
 * Récupère le token depuis le localStorage (identique à api.js).
 */
const getToken = () => localStorage.getItem('token');

/**
 * Connecte le socket au serveur.
 * Utilise le même token que les appels REST pour l'authentification.
 */
export const connectSocket = () => {
  if (socket?.connected) {
    return socket;
  }

  const token = getToken();
  if (!token) {
    console.warn('[socket] No token available, cannot connect');
    return null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[socket] Connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] Connection error:', err.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('[socket] Reconnected after', attemptNumber, 'attempts');
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('[socket] Reconnection attempt #', attemptNumber);
  });

  socket.on('error', (error) => {
    console.error('[socket] Error:', error.message);
  });

  return socket;
};

/**
 * Déconnecte le socket.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    console.log('[socket] Disconnected and cleaned up');
  }
};

/**
 * Retourne l'instance socket actuelle (peut être null si non connecté).
 */
export const getSocket = () => socket;

/**
 * Vérifie si le socket est connecté.
 */
export const isConnected = () => socket?.connected || false;