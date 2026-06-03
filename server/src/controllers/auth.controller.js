import { prisma } from '../db/prisma.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { buildSessionInsert } from '../utils/crypto.js';
import {
  buildAuthPayload,
  extractProfile,
  loadUserWithProfile,
  loadUserWithProfileByEmail,
} from '../utils/authPayload.js';

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------
//
// We use bcryptjs (pure-JS, no native build step) with a cost factor of 10.
// This replaces the previous SHA-256 implementation; old test users that
// were stored as SHA-256 will fail to log in and need to be re-created.

const BCRYPT_SALT_ROUNDS = 10;

const hashPassword = async (password) =>
  bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

const verifyPassword = async (password, hash) => {
  if (!hash) return false;
  // bcrypt.compare handles both $2a$/$2b$/$2y$ prefixes; any other value
  // (e.g. a legacy SHA-256 hex digest) is simply treated as a mismatch.
  return bcrypt.compare(password, hash);
};

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------
//
// We keep using crypto.randomUUID() for the auth-related tables (User,
// Account, Verification) to preserve backward compatibility with existing
// seeded data. New Session rows use the cuid2-style generator from
// ../utils/crypto.js (see buildSessionInsert).

const generateId = () => crypto.randomUUID();

// ---------------------------------------------------------------------------
// Registration validation helpers (unchanged from the previous version)
// ---------------------------------------------------------------------------

const REGISTRATION_ROLES = new Set(['PATIENT', 'THERAPIST']);

const REGISTRATION_ENUMS = {
  genrePref: new Set(['FEMME', 'HOMME', 'PEU_IMPORTE']),
  sensibilitePatient: new Set([
    'OUI_IMPORTANT',
    'NON_NECESSAIRE',
    'NE_SAIS_PAS',
  ]),
  experiencePassee: new Set([
    'OUI_POSITIVE',
    'OUI_NON_SATISFAISANTE',
    'NON_PREMIERE_FOIS',
    'NE_SAIS_PAS',
  ]),
  attentesTherapie: new Set([
    'ECOUTE_ACTIVE',
    'EXERCICES_OUTILS',
    'COMPRENDRE_PASSE',
    'NE_SAIS_PAS',
  ]),
  sensibiliteTherapeute: new Set([
    'INTEGRE_DEMANDE',
    'LAIQUE_NEUTRE',
    'AUTRE',
  ]),
  approcheTherapeute: new Set([
    'TCC',
    'PSYCHANALYSE',
    'HUMANISTE_GESTALT',
    'INTEGRATIVE',
  ]),
};

class RegistrationValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const requireObject = (value, field) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RegistrationValidationError(`${field} must be an object`);
  }
  return value;
};

const requiredString = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RegistrationValidationError(`${field} is required`);
  }
  return value.trim();
};

const emailAddress = (value) => {
  const email = requiredString(value, 'account.email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RegistrationValidationError(
      'account.email must be a valid email address',
    );
  }
  return email;
};

const passwordString = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RegistrationValidationError('account.password is required');
  }
  return value;
};

const optionalString = (value, field) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !value.trim()) {
    throw new RegistrationValidationError(
      `${field} must be a non-empty string`,
    );
  }
  return value.trim();
};

const optionalDate = (value, field) => {
  if (value === undefined || value === null) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RegistrationValidationError(`${field} must be a valid date`);
  }
  return date;
};

const optionalEnum = (value, field) => {
  if (value === undefined || value === null) return undefined;
  if (!REGISTRATION_ENUMS[field].has(value)) {
    throw new RegistrationValidationError(`${field} has an invalid value`);
  }
  return value;
};

const stringArray = (value, field) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new RegistrationValidationError(`${field} must be an array`);
  }
  const values = value.map((entry) => requiredString(entry, `${field} entries`));
  return [...new Set(values)];
};

const nestedLookupCreates = (relation, codes) => {
  if (!codes.length) return undefined;
  return {
    create: codes.map((code) => ({
      [relation]: { connect: { code } },
    })),
  };
};

const buildPatientRegistration = (profile, matching) => {
  if (matching.publicTypes !== undefined) {
    throw new RegistrationValidationError(
      'matching.publicTypes is only supported for therapists',
    );
  }
  return {
    dateOfBirth: optionalDate(profile.dateOfBirth, 'profile.dateOfBirth'),
    gender: optionalString(profile.gender, 'profile.gender'),
    phone: optionalString(profile.phone, 'profile.phone'),
    address: optionalString(profile.address, 'profile.address'),
    wilaya: optionalString(profile.wilaya, 'profile.wilaya'),
    emergencyContact: optionalString(
      profile.emergencyContact,
      'profile.emergencyContact',
    ),
    emergencyPhone: optionalString(
      profile.emergencyPhone,
      'profile.emergencyPhone',
    ),
    genrePref: optionalEnum(matching.genrePref, 'genrePref'),
    sensibilitePatient: optionalEnum(
      matching.sensibilitePatient,
      'sensibilitePatient',
    ),
    experiencePassee: optionalEnum(
      matching.experiencePassee,
      'experiencePassee',
    ),
    attentesTherapie: optionalEnum(
      matching.attentesTherapie,
      'attentesTherapie',
    ),
    onboardingCompleted: true,
    questionnaireDataRaw: matching,
    pathologies: nestedLookupCreates(
      'pathology',
      stringArray(matching.pathologies, 'matching.pathologies'),
    ),
    languages: nestedLookupCreates(
      'language',
      stringArray(matching.languages, 'matching.languages'),
    ),
    consultationModes: nestedLookupCreates(
      'consultationMode',
      stringArray(matching.consultationModes, 'matching.consultationModes'),
    ),
    timeSlots: nestedLookupCreates(
      'timeSlot',
      stringArray(matching.timeSlots, 'matching.timeSlots'),
    ),
  };
};

const buildTherapistRegistration = (profile, matching) => ({
  gender: optionalString(profile.gender, 'profile.gender'),
  sensibiliteTherapeute: optionalEnum(
    matching.sensibiliteTherapeute,
    'sensibiliteTherapeute',
  ),
  approcheTherapeute: optionalEnum(
    matching.approcheTherapeute,
    'approcheTherapeute',
  ),
  pathologies: nestedLookupCreates(
    'pathology',
    stringArray(matching.pathologies, 'matching.pathologies'),
  ),
  languages: nestedLookupCreates(
    'language',
    stringArray(matching.languages, 'matching.languages'),
  ),
  consultationModes: nestedLookupCreates(
    'consultationMode',
    stringArray(matching.consultationModes, 'matching.consultationModes'),
  ),
  publicTypes: nestedLookupCreates(
    'publicType',
    stringArray(matching.publicTypes, 'matching.publicTypes'),
  ),
  timeSlots: nestedLookupCreates(
    'timeSlot',
    stringArray(matching.timeSlots, 'matching.timeSlots'),
  ),
});

// ---------------------------------------------------------------------------
// Therapist verification messages (shared by login + middleware)
// ---------------------------------------------------------------------------

const therapistVerificationMessage = (status) => {
  if (status === 'pending') {
    return 'Votre compte est toujours en cours de vérification. Veuillez réessayer plus tard.';
  }
  if (status === 'rejected') {
    return "Votre compte a été rejeté. Veuillez contacter le support pour plus d'informations.";
  }
  return 'Votre compte thérapeute n\u2019est pas encore vérifié.';
};

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
//
// Same body shape as before, but the response is now the unified
// { token, user, profile } session payload. The user is auto-logged-in:
// we insert a Session row in the same request, and the frontend can
// drop them straight into the standard session hydration flow.

const register = async (req, res, next) => {
  try {
    const body = requireObject(req.body, 'body');
    const role = typeof body.role === 'string' ? body.role.toUpperCase() : '';
    if (!REGISTRATION_ROLES.has(role)) {
      throw new RegistrationValidationError('role must be PATIENT or THERAPIST');
    }

    const account = requireObject(body.account, 'account');
    const profile = requireObject(body.profile, 'profile');
    const matching = requireObject(body.matching, 'matching');
    const name = requiredString(account.name, 'account.name');
    const email = emailAddress(account.email);
    const password = passwordString(account.password);
    const profileRelation = role === 'PATIENT' ? 'patient' : 'therapist';
    const profileData =
      role === 'PATIENT'
        ? buildPatientRegistration(profile, matching)
        : buildTherapistRegistration(profile, matching);
    const userId = generateId();
    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(
      (transaction) => {
        return transaction.user.create({
          data: {
            id: userId,
            email,
            name,
            emailVerified: false,
            role, // persisted in the User record
            accounts: {
              create: {
                id: generateId(),
                accountId: userId,
                providerId: 'credentials',
                password: passwordHash,
              },
            },
            [profileRelation]: { create: profileData },
          },
        });
      },
      {
        maxWait: 10000, // 10s max to acquire a connection from the pool
        timeout: 30000, // 30s max for the transaction to complete
      },
    );

    // 3. Handle file uploads — upload to Filebase and create Document records.
    // Same logic as the previous version; therapists can attach diplomas.
    if (req.files && req.files.length > 0 && role === 'THERAPIST') {
      const { uploadFile } = await import('../services/storage.service.js');
      const { randomUUID } = await import('crypto');

      for (const file of req.files) {
        const uniqueId = randomUUID();
        const extension = file.originalname.split('.').pop();
        const objectKey = `documents/${user.id}/${uniqueId}.${extension}`;

        await uploadFile(file.buffer, objectKey, file.mimetype);

        await prisma.document.create({
          data: {
            ownerId: user.id,
            ownerRole: 'therapist',
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            objectKey,
            bucketName: process.env.FILEBASE_BUCKET || 'tassarutdocuments',
            storageProvider: 'filebase',
            documentType: 'diploma',
          },
        });
      }
    }

    // 4. Auto-login: issue a session row + token, just like /auth/login.
    const sessionRow = buildSessionInsert();
    await prisma.session.create({
      data: {
        ...sessionRow,
        userId: user.id,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    // 5. Reload the user with the role-relevant profile, then compose the
    //    standardized payload.
    const fullUser = await loadUserWithProfile(user.id);
    const profile2 = extractProfile(fullUser);
    const payload = buildAuthPayload({
      user: fullUser,
      token: sessionRow.token,
      profile: profile2,
    });

    res.status(201).json({ success: true, data: payload });
  } catch (error) {
    if (error.code === 'P2002') {
      error.status = 409;
      error.message = 'User with this email already exists';
    }
    if (error.code === 'P2018' || error.code === 'P2025') {
      error.status = 400;
      error.message = 'One or more questionnaire option codes are invalid';
    }
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
//
// Phase A of the session lifecycle:
//   1. Find user (with role + nested profile via polymorphic include).
//   2. Verify password (bcrypt).
//   3. Block therapists whose verificationStatus is pending/rejected.
//   4. Insert a Session row.
//   5. Return { token, user, profile }.

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';

    // Polymorphic include: returns user + patient? + therapist? all in
    // one round-trip, so we can extract the role-specific profile for
    // both the response payload and the therapist verification check.
    const userByEmail = await loadUserWithProfileByEmail(normalizedEmail);

    if (!userByEmail) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Find the credentials account and verify the password via bcrypt.
    const account = await prisma.account.findFirst({
      where: { userId: userByEmail.id, providerId: 'credentials' },
    });

    const ok = await verifyPassword(password, account?.password);
    if (!account || !ok) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Therapist-only: enforce the verification status at login time.
    if (userByEmail.role === 'THERAPIST') {
      const status = userByEmail.therapist?.verificationStatus;
      if (status === 'pending' || status === 'rejected') {
        return res.status(403).json({
          success: false,
          message: therapistVerificationMessage(status),
          verificationStatus: status,
        });
      }
    }

    // Generate the session row.
    const sessionRow = buildSessionInsert();
    await prisma.session.create({
      data: {
        ...sessionRow,
        userId: userByEmail.id,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    const profile = extractProfile(userByEmail);
    const payload = buildAuthPayload({
      user: userByEmail,
      token: sessionRow.token,
      profile,
    });

    res.json({ success: true, data: payload });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------
//
// Deletes the active Session row. Idempotent: a missing token or a missing
// row still returns 200 so the frontend can always clear its local copy.

const logout = async (req, res, next) => {
  try {
    const token =
      req.sessionToken ||
      (req.cookies && req.cookies.token) ||
      (typeof req.headers.authorization === 'string' &&
        req.headers.authorization.startsWith('Bearer ') &&
        req.headers.authorization.split(' ')[1]);

    if (token) {
      try {
        await prisma.session.delete({ where: { token } });
      } catch (err) {
        if (err.code !== 'P2025') throw err; // P2025 = record not found; ignore
      }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /auth/me   (Phase C — session hydration)
// ---------------------------------------------------------------------------
//
// Runs AFTER the authenticate middleware, which has already attached
// `req.user` (with nested patient/therapist), `req.role`, and `req.profile`.
// We just compose the response from those.

const getCurrentUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const payload = buildAuthPayload({
      user: req.user,
      token: req.sessionToken,
      profile: req.profile,
    });

    res.json({ success: true, data: payload });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /auth/forgot-password
// ---------------------------------------------------------------------------
//
// Creates a one-shot Verification row. We don't change the password
// here — the client will call /auth/reset-password with the token.

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (normalizedEmail) {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (user) {
        const token = generateId();
        await prisma.verification.create({
          data: {
            id: generateId(),
            identifier: normalizedEmail,
            value: token,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
          },
        });
        // TODO: send email with the reset link.
        console.log(`Password reset token for ${normalizedEmail}: ${token}`);
      }
    }

    res.json({
      success: true,
      message:
        'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /auth/reset-password
// ---------------------------------------------------------------------------

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'token and password are required',
      });
    }

    const verification = await prisma.verification.findFirst({
      where: { value: token, expiresAt: { gt: new Date() } },
    });
    if (!verification) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: verification.identifier },
    });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const passwordHash = await hashPassword(password);
    await prisma.account.updateMany({
      where: { userId: user.id, providerId: 'credentials' },
      data: { password: passwordHash },
    });
    // Invalidate every active session for this user — the password
    // just changed, so any leaked token should be revoked.
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.verification.delete({ where: { id: verification.id } });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /auth/verify-email
// ---------------------------------------------------------------------------

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'token is required',
      });
    }

    const verification = await prisma.verification.findFirst({
      where: { value: token, expiresAt: { gt: new Date() } },
    });
    if (!verification) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }

    await prisma.user.update({
      where: { email: verification.identifier },
      data: { emailVerified: true },
    });
    await prisma.verification.delete({ where: { id: verification.id } });

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

export {
  register,
  login,
  logout,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
};
