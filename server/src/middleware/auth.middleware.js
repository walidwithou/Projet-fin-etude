import { prisma } from '../db/prisma.js';
import { extractProfile, FULL_USER_INCLUDE } from '../utils/authPayload.js';

/**
 * Authentication & authorization middleware (database-backed sessions).
 *
 * The Session model replaces the previous JWT pipeline. Every request
 * to a protected route is resolved by:
 *   1. Extracting the opaque session token from the request
 *      (HTTP-Only cookie `token` first, then `Authorization: Bearer <token>`).
 *   2. Looking it up in the `Session` table, including the User and
 *      the role-relevant profile (polymorphic `patient` / `therapist`).
 *   3. Rejecting the request (401) if the row is missing or expired.
 *   4. Attaching `req.user`, `req.role`, `req.profile`, and
 *      `req.sessionToken` to the request context.
 *
 * Downstream middleware (e.g. `requireVerifiedTherapist`) and
 * controllers (e.g. `getCurrentUser`) consume those properties
 * directly without re-querying the database.
 */

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

/**
 * Pull the session token out of the request. The frontend uses the
 * `Authorization: Bearer <token>` header today; we also accept an
 * HTTP-Only `token` cookie for future browser-based hardening.
 */
const extractToken = (req) => {
  if (req.cookies && typeof req.cookies.token === 'string' && req.cookies.token) {
    return req.cookies.token;
  }

  const header = req.headers && req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const candidate = header.slice('Bearer '.length).trim();
    if (candidate) return candidate;
  }

  return null;
};

// ---------------------------------------------------------------------------
// authenticate
// ---------------------------------------------------------------------------

/**
 * Phase B of the session lifecycle: look up the active session row
 * and hydrate the request context. A 401 here is what the frontend's
 * `services/api.js` listens for to dispatch `tassarut:unauthorized`
 * and force a re-login.
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: { include: FULL_USER_INCLUDE },
      },
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      // Best-effort cleanup; failure here must not block the 401.
      prisma.session
        .delete({ where: { token } })
        .catch(() => {});
      return res.status(401).json({
        success: false,
        message: 'Session expired',
      });
    }

    const { user } = session;
    const role = typeof user.role === 'string' ? user.role.toLowerCase() : user.role;

    // Hydrate the request context. `req.user` keeps the raw Prisma
    // shape (with nested patient/therapist) so downstream code can
    // read whichever fields it needs; `req.profile` is the polymorphic
    // pre-extracted payload for fast access in middleware.
    req.sessionToken = session.token;
    req.user = user;
    req.userId = user.id;
    req.role = role;
    req.profile = extractProfile(user);

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

// ---------------------------------------------------------------------------
// authorize
// ---------------------------------------------------------------------------

/**
 * Role gate. `allowedRoles` is an array of lowercased role strings
 * ('patient' | 'therapist' | 'admin') to match `req.role` exactly.
 */
export const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    if (!Array.isArray(allowedRoles) || !allowedRoles.includes(req.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

// ---------------------------------------------------------------------------
// requireVerifiedTherapist
// ---------------------------------------------------------------------------

/**
 * Defense-in-depth: even if a therapist has a valid session, they
 * cannot reach protected therapist tools until an admin has flipped
 * their `verificationStatus` to 'verified'.
 *
 * Prefers the pre-extracted `req.profile` (populated by `authenticate`)
 * so we don't burn a second DB query on every protected request.
 * Falls back to a direct lookup if the session is somehow loaded
 * without the profile relation.
 */
export const requireVerifiedTherapist = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    if (req.role !== 'therapist') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Therapist role required.',
      });
    }

    let verificationStatus = req.profile && req.profile.verificationStatus;

    // Fallback: if the session middleware somehow didn't populate
    // `req.profile` (e.g. legacy code path), fetch the row directly.
    if (!verificationStatus) {
      const therapistRow = await prisma.therapist.findFirst({
        where: { userId: req.user.id },
        select: { id: true, verificationStatus: true },
      });
      if (!therapistRow) {
        return res.status(403).json({
          success: false,
          message: 'Therapist profile not found.',
        });
      }
      // Backfill req.profile so downstream controllers don't need a re-fetch.
      req.profile = {
        ...(req.profile || {}),
        id: therapistRow.id,
        verificationStatus: therapistRow.verificationStatus,
      };
      verificationStatus = therapistRow.verificationStatus;
    }

    if (verificationStatus !== 'verified') {
      const message =
        verificationStatus === 'pending'
          ? 'Votre compte est toujours en cours de vérification. Veuillez réessayer plus tard.'
          : verificationStatus === 'rejected'
            ? "Votre compte a été rejeté. Veuillez contacter le support pour plus d'informations."
            : 'Votre compte thérapeute n\u2019est pas encore vérifié.';

      return res.status(403).json({
        success: false,
        message,
        verificationStatus,
      });
    }

    // Expose the verified status on req.user for any legacy consumer
    // (e.g. therapist controller code that reads `req.user.verificationStatus`).
    req.user.verificationStatus = verificationStatus;

    next();
  } catch (error) {
    console.error('Therapist verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify therapist account',
    });
  }
};
