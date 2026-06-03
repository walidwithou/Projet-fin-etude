import crypto from 'crypto';

/**
 * Session lifecycle constants and generators.
 *
 * The Session model stores opaque random tokens (no JWT, no JWT
 * signing key to leak). All IDs/keys are generated locally on
 * the server; the client only ever sees the public `token`.
 */

/** 7 days, in milliseconds. Matches the original JWT_EXPIRES_IN. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Generate a cryptographically secure random session token.
 * Returns a 64-character hex string (256 bits of entropy).
 */
export const generateSessionToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Generate a cuid2-style opaque ID. We use 12 random bytes
 * (96 bits) URL-safe-base64 encoded → 16 chars, which mirrors
 * the collision-safe length of cuid2 and matches the style
 * the rest of the Prisma schema uses for new records.
 *
 * Used as the `id` for new Session rows (the schema's Session
 * model has `id String @id` with no default, so we must
 * supply it).
 */
export const generateCuid = () => crypto.randomBytes(12).toString('base64url');

/**
 * Convenience: produce the full { id, token, expiresAt } triple
 * needed to insert a new Session row.
 */
export const buildSessionInsert = () => ({
  id: generateCuid(),
  token: generateSessionToken(),
  expiresAt: new Date(Date.now() + SESSION_TTL_MS),
});
