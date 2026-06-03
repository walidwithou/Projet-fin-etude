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
const normalizeRole = (role) =>
  typeof role === 'string' ? role.trim().toUpperCase() : '';

/**
 * Public, anonymous landing page identifier. Used as a safe default
 * whenever we cannot determine the user's role (e.g. before the
 * /auth/me call has returned, or after it has failed and we are
 * treating the user as logged out). Keeping this as a named constant
 * makes the intent obvious and avoids the risk of returning a
 * private route (THERAPIST, PATIENT, ADMIN) for an anonymous user.
 */
export const PUBLIC_LANDING_PAGE = 'REGISTRATION';

/**
 * Returns true only when the input looks like a real, usable user
 * object (a non-null object with a string role). Defensive helper
 * used everywhere we need to make a routing decision.
 */
const isValidUser = (user) =>
  Boolean(user) && typeof user === 'object' && typeof user.role === 'string';

/**
 * Determines if a user is allowed to access the admin panel.
 * Rule: role === "ADMIN"
 */
export const canAccessAdmin = (user) => {
  if (!isValidUser(user)) return false;
  return normalizeRole(user.role) === 'ADMIN';
};

/**
 * Determines if a user is allowed to access the patient view.
 * Rule: role === "PATIENT"
 */
export const canAccessPatient = (user) => {
  if (!isValidUser(user)) return false;
  return normalizeRole(user.role) === 'PATIENT';
};

/**
 * Determines if a user is allowed to access the therapist view.
 * Rule: role === "THERAPIST" AND verificationStatus === "verified"
 */
export const canAccessTherapist = (user) => {
  if (!isValidUser(user)) return false;
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
 *
 * SAFETY: this function MUST NEVER return a private route
 * (THERAPIST / PATIENT / ADMIN) for an anonymous, undefined, or
 * malformed user. If we cannot prove the user has a known role,
 * we fall back to the public landing page so the app never
 * accidentally exposes a private dashboard to a logged-out visitor.
 */
export const defaultPageForUser = (user) => {
  // Guard 1 — explicit early return for the most common cases.
  if (!user || typeof user !== 'object') {
    return PUBLIC_LANDING_PAGE;
  }

  // Guard 2 — the user object must carry a string role. If not,
  // we treat the session as anonymous and bounce to the landing page.
  if (typeof user.role !== 'string' || user.role.trim() === '') {
    return PUBLIC_LANDING_PAGE;
  }

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

  // Guard 3 — unknown role. Refuse to route to a private page and
  // return the public landing page instead.
  return PUBLIC_LANDING_PAGE;
};
