import { prisma } from '../db/prisma.js';

/**
 * Polymorphic session payload utilities.
 *
 * The Session row always loads its `User`, but the User's role
 * determines which nested profile table we additionally include
 * and what shape the `profile` key ends up taking in the JSON
 * response. We never load both patient and therapist on a query
 * that we already know is for the wrong role; we still include
 * both at the middleware level (cheap 1-1 relations) so we can
 * serve the same hydration response after a hard refresh
 * without a second round-trip.
 */

// -----------------------------------------------------------------------------
// Prisma include fragments
// -----------------------------------------------------------------------------

const PATIENT_INCLUDE = {
  patient: {
    include: {
      consultationModes: { include: { consultationMode: true } },
      timeSlots: { include: { timeSlot: true } },
      languages: { include: { language: true } },
      pathologies: { include: { pathology: true } },
    },
  },
};

const THERAPIST_INCLUDE = {
  therapist: {
    include: {
      publicTypes: { include: { publicType: true } },
      consultationModes: { include: { consultationMode: true } },
      timeSlots: { include: { timeSlot: true } },
      languages: { include: { language: true } },
      pathologies: { include: { pathology: true } },
    },
  },
};

const FULL_USER_INCLUDE = {
  ...PATIENT_INCLUDE,
  ...THERAPIST_INCLUDE,
};

// Re-exported so controllers and middleware can use the exact same
// include shape when they need to query by a non-id key (e.g. email).
export { FULL_USER_INCLUDE };

/**
 * Fetch a single User by id with the role-relevant profile relation
 * eagerly loaded.
 */
export const loadUserWithProfile = async (userId) => {
  return prisma.user.findUnique({
    where: { id: userId },
    include: FULL_USER_INCLUDE,
  });
};

/**
 * Fetch a single User by email with the same include shape. Used by
 * POST /auth/login where we don't yet have a user id.
 */
export const loadUserWithProfileByEmail = async (email) => {
  return prisma.user.findUnique({
    where: { email },
    include: FULL_USER_INCLUDE,
  });
};

// -----------------------------------------------------------------------------
// Join-table denormalization
// -----------------------------------------------------------------------------

/**
 * Many-to-many join rows have the shape
 *   { id, <parent>Id, <child>Id, <child>: { ... } }
 *
 * The dashboard wants just the related entity, not the join row.
 * This helper unwraps the first non-id, non-`xxxId` property.
 */
const unwrapJoinRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const refKey = Object.keys(row).find(
      (k) => k !== 'id' && !k.endsWith('Id'),
    );
    return refKey ? row[refKey] : row;
  });
};

// -----------------------------------------------------------------------------
// Per-role profile extractors
// -----------------------------------------------------------------------------

const extractPatientProfile = (user) => {
  const p = user.patient;
  if (!p) return null;

  return {
    id: p.id,
    wilaya: p.wilaya,
    preferredLanguage: p.preferredLanguage,
    onboardingCompleted: p.onboardingCompleted,
    currentTherapistid: p.currentTherapistid,
    // single-choice enums (carried over so the dashboard can render them)
    genrePref: p.genrePref,
    sensibilitePatient: p.sensibilitePatient,
    experiencePassee: p.experiencePassee,
    attentesTherapie: p.attentesTherapie,
    // denormalized many-to-many lists
    consultationModes: unwrapJoinRows(p.consultationModes),
    timeSlots: unwrapJoinRows(p.timeSlots),
    languages: unwrapJoinRows(p.languages),
    pathologies: unwrapJoinRows(p.pathologies),
  };
};

const extractTherapistProfile = (user) => {
  const t = user.therapist;
  if (!t) return null;

  return {
    id: t.id,
    // critical onboarding / verification data
    verificationStatus: t.verificationStatus,
    acceptingNewPatients: t.acceptingNewPatients,
    // Decimal → string keeps precision intact in JSON
    hourlyRate: t.hourlyRate ? t.hourlyRate.toString() : null,
    currency: t.currency,
    rating: t.rating ? t.rating.toString() : null,
    totalReviews: t.totalReviews,
    bio: t.bio,
    profilePhotoUrl: t.profilePhotoUrl,
    availability: t.availability,
    // single-choice enums
    sensibiliteTherapeute: t.sensibiliteTherapeute,
    approcheTherapeute: t.approcheTherapeute,
    // denormalized many-to-many lists
    publicTypes: unwrapJoinRows(t.publicTypes),
    consultationModes: unwrapJoinRows(t.consultationModes),
    timeSlots: unwrapJoinRows(t.timeSlots),
    languages: unwrapJoinRows(t.languages),
    pathologies: unwrapJoinRows(t.pathologies),
  };
};

/**
 * Top-level dispatcher.
 * - PATIENT  → Patient profile object (or null if not yet created)
 * - THERAPIST → Therapist profile object (or null)
 * - ADMIN    → null (admins have no role-specific profile payload)
 */
export const extractProfile = (user) => {
  if (!user) return null;
  if (user.role === 'PATIENT') return extractPatientProfile(user);
  if (user.role === 'THERAPIST') return extractTherapistProfile(user);
  return null;
};

// -----------------------------------------------------------------------------
// Final payload composition
// -----------------------------------------------------------------------------

/**
 * Compose the standardized { token, user, profile? } response shape.
 *
 * The `user` passed in is the raw Prisma row (role is the UPPERCASE enum).
 * We deliberately do NOT mutate it; we return a fresh, JSON-safe object
 * with `role` normalized to lowercase for the frontend.
 *
 * Pass `profile` if you've already extracted it (e.g. the middleware
 * did) to avoid computing it twice. Otherwise pass `includeProfile: true`
 * and we'll call `extractProfile` here.
 */
export const buildAuthPayload = ({
  user,
  token,
  profile,
  includeProfile = false,
}) => {
  if (!user) {
    throw new Error('buildAuthPayload: `user` is required');
  }

  const payload = {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      // The frontend's AuthContext/canAccess expects lowercase
      // ('patient' | 'therapist' | 'admin') so we normalize here.
      role:
        typeof user.role === 'string' ? user.role.toLowerCase() : user.role,
    },
  };

  if (profile) {
    payload.profile = profile;
  } else if (includeProfile) {
    const extracted = extractProfile(user);
    if (extracted) {
      payload.profile = extracted;
    }
  }

  return payload;
};
