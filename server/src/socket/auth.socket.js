import { prisma } from '../db/prisma.js';

/**
 * Authentifie une connexion Socket.IO via le token de session.
 *
 * Le frontend envoie le token dans `socket.handshake.auth.token`.
 * On vérifie dans la table Session que le token est valide et non expiré.
 * Si OK, on attache userId, role, et user à `socket.data`.
 *
 * Si KO, on rejette la connexion avec une erreur.
 */
export const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required: no token provided'));
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!session) {
      return next(new Error('Invalid token'));
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      // Cleanup best-effort
      prisma.session.delete({ where: { token } }).catch(() => {});
      return next(new Error('Session expired'));
    }

    // Attacher les infos utilisateur au socket
    socket.data.userId = session.user.id;
    socket.data.role = session.user.role.toLowerCase();
    socket.data.user = session.user;

    next();
  } catch (error) {
    console.error('[socket auth] Error:', error.message);
    return next(new Error('Authentication failed'));
  }
};