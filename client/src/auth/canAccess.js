/**
 * Frontend access control utility.
 *
 * Centralizes the rules for which user role can access which view.
 * Mirrors the backend's requireVerifiedTherapist middleware so the
 * UI stays consistent with the API.
 *
 * Roles are normalized to uppercase for comparison because the
 * backend stores them in lowercase (e.g. "patient", "therapist", "admin")
 * in the JWT, but the UI and Prisma schema use uppercase ("PATIENT",
 * "THERAPIST", "ADMIN"). We accept either form.
 */
const normalizeRole = (role) => (typeof role === 'string' ? role.toUpperCase() : '');

/**
 * Determines if a user is allowed to access the admin panel.
 * Rule: role === "ADMIN"
 */
export const canAccessAdmin = (user) => {
  if (!user) return false;
  return normalizeRole(user.role) === 'ADMIN';
};

/**
 * Determines if a user is allowed to access the patient view.
 * Rule: role === "PATIENT"
 */
export const canAccessPatient = (user) => {
  if (!user) return false;
  return normalizeRole(user.role) === 'PATIENT';
};

/**
 * Determines if a user is allowed to access the therapist view.
 * Rule: role === "THERAPIST" AND verificationStatus === "verified"
 */
export const canAccessTherapist = (user) => {
  if (!user) return false;
  if (normalizeRole(user.role) !== 'THERAPIST') return false;
  return user.verificationStatus === 'verified';
};

/**
 * Generic access map used by the <ProtectedRoute /> guard.
 * Keyed by view/page name, value is a predicate (user) => boolean.
 */
export const ACCESS_RULES = {
  ADMIN: canAccessAdmin,
  PATIENT: canAccessPatient,
  THERAPIST: canAccessTherapist,
  // Public views — always allowed
  REGISTRATION: () => true,
  LOGIN: () => true,
  ABOUT: () => true,
  SETTINGS: () => true,
  ACCESS_DENIED: () => true,
};

/**
 * Single entry point used by ProtectedRoute.
 * Returns true when the user can access the given page, false otherwise.
 */
export const canAccess = (page, user) => {
  const rule = ACCESS_RULES[page];
  if (!rule) {
    // Unknown pages are denied by default to fail safely.
    return false;
  }
  return Boolean(rule(user));
};

/**
 * Returns the default landing page for a user based on their role.
 * Used to redirect after login, after access denied, or for the
 * root URL when no page is set.
 */
export const defaultPageForUser = (user) => {
  if (!user) return 'REGISTRATION';
  const role = normalizeRole(user.role);
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'THERAPIST') {
    // Unverified therapists cannot reach THERAPIST — fall back to
    // a message page that explains the situation.
    if (user.verificationStatus !== 'verified') {
      return 'ACCESS_DENIED';
    }
    return 'THERAPIST';
  }
  if (role === 'PATIENT') return 'PATIENT';
  return 'REGISTRATION';
};
