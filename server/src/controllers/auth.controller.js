import { prisma } from '../db/prisma.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d'; // 7 days

/**
 * Generate a random ID
 */
const generateId = () => crypto.randomUUID();


/**
 * Hash a password (simple implementation - use bcrypt in production)
 */
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

/**
 * Generate JWT token
 */
const generateJWT = (userId, email) => {
  return jwt.sign(
    { id: userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const REGISTRATION_ROLES = new Set(['PATIENT', 'THERAPIST']);

const REGISTRATION_ENUMS = {
  genrePref: new Set(['FEMME', 'HOMME', 'PEU_IMPORTE']),
  sensibilitePatient: new Set(['OUI_IMPORTANT', 'NON_NECESSAIRE', 'NE_SAIS_PAS']),
  experiencePassee: new Set(['OUI_POSITIVE', 'OUI_NON_SATISFAISANTE', 'NON_PREMIERE_FOIS', 'NE_SAIS_PAS']),
  attentesTherapie: new Set(['ECOUTE_ACTIVE', 'EXERCICES_OUTILS', 'COMPRENDRE_PASSE', 'NE_SAIS_PAS']),
  sensibiliteTherapeute: new Set(['INTEGRE_DEMANDE', 'LAIQUE_NEUTRE', 'AUTRE']),
  approcheTherapeute: new Set(['TCC', 'PSYCHANALYSE', 'HUMANISTE_GESTALT', 'INTEGRATIVE']),
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
    throw new RegistrationValidationError('account.email must be a valid email address');
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
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new RegistrationValidationError(`${field} must be a non-empty string`);
  }

  return value.trim();
};

const optionalDate = (value, field) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RegistrationValidationError(`${field} must be a valid date`);
  }

  return date;
};

const optionalEnum = (value, field) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!REGISTRATION_ENUMS[field].has(value)) {
    throw new RegistrationValidationError(`${field} has an invalid value`);
  }

  return value;
};

const stringArray = (value, field) => {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new RegistrationValidationError(`${field} must be an array`);
  }

  const values = value.map((entry) => requiredString(entry, `${field} entries`));
  return [...new Set(values)];
};

const nestedLookupCreates = (relation, codes) => {
  if (!codes.length) {
    return undefined;
  }

  return {
    create: codes.map((code) => ({
      [relation]: {
        connect: { code },
      },
    })),
  };
};

const buildPatientRegistration = (profile, matching) => {
  if (matching.publicTypes !== undefined) {
    throw new RegistrationValidationError('matching.publicTypes is only supported for therapists');
  }

  return {
    dateOfBirth: optionalDate(profile.dateOfBirth, 'profile.dateOfBirth'),
    gender: optionalString(profile.gender, 'profile.gender'),
    phone: optionalString(profile.phone, 'profile.phone'),
    address: optionalString(profile.address, 'profile.address'),
    wilaya: optionalString(profile.wilaya, 'profile.wilaya'),
    emergencyContact: optionalString(profile.emergencyContact, 'profile.emergencyContact'),
    emergencyPhone: optionalString(profile.emergencyPhone, 'profile.emergencyPhone'),
    genrePref: optionalEnum(matching.genrePref, 'genrePref'),
    sensibilitePatient: optionalEnum(matching.sensibilitePatient, 'sensibilitePatient'),
    experiencePassee: optionalEnum(matching.experiencePassee, 'experiencePassee'),
    attentesTherapie: optionalEnum(matching.attentesTherapie, 'attentesTherapie'),
    onboardingCompleted: true,
    questionnaireDataRaw: matching,
    pathologies: nestedLookupCreates('pathology', stringArray(matching.pathologies, 'matching.pathologies')),
    languages: nestedLookupCreates('language', stringArray(matching.languages, 'matching.languages')),
    consultationModes: nestedLookupCreates('consultationMode', stringArray(matching.consultationModes, 'matching.consultationModes')),
    timeSlots: nestedLookupCreates('timeSlot', stringArray(matching.timeSlots, 'matching.timeSlots')),
  };
};

const buildTherapistRegistration = (profile, matching) => ({
  gender: optionalString(profile.gender, 'profile.gender'),
  sensibiliteTherapeute: optionalEnum(matching.sensibiliteTherapeute, 'sensibiliteTherapeute'),
  approcheTherapeute: optionalEnum(matching.approcheTherapeute, 'approcheTherapeute'),
  pathologies: nestedLookupCreates('pathology', stringArray(matching.pathologies, 'matching.pathologies')),
  languages: nestedLookupCreates('language', stringArray(matching.languages, 'matching.languages')),
  consultationModes: nestedLookupCreates('consultationMode', stringArray(matching.consultationModes, 'matching.consultationModes')),
  publicTypes: nestedLookupCreates('publicType', stringArray(matching.publicTypes, 'matching.publicTypes')),
  timeSlots: nestedLookupCreates('timeSlot', stringArray(matching.timeSlots, 'matching.timeSlots')),
});

/**
 * Register a new user
 */
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
    const profileData = role === 'PATIENT'
      ? buildPatientRegistration(profile, matching)
      : buildTherapistRegistration(profile, matching);
    const userId = generateId();

    const user = await prisma.$transaction(
      (transaction) => {
        return transaction.user.create({
          data: {
            id: userId,
            email,
            name,
            emailVerified: false,
            accounts: {
              create: {
                id: generateId(),
                accountId: userId,
                providerId: 'credentials',
                password: hashPassword(password),
              },
            },
            [profileRelation]: {
              create: profileData,
            },
          },
        });
      },
      {
        maxWait: 10000, // 10s max to acquire a connection from the pool
        timeout: 30000, // 30s max for the transaction to complete (Neon cloud latency)
      }
    );

    // 3. Handle file uploads — upload to Filebase and create Document records
    if (req.files && req.files.length > 0 && role === 'THERAPIST') {
      // Dynamic import to avoid circular dependency issues at module level
      const { uploadFile } = await import('../services/storage.service.js');
      const { randomUUID } = await import('crypto');

      const documentRecords = [];
      for (const file of req.files) {
        const uniqueId = randomUUID();
        const extension = file.originalname.split('.').pop();
        const objectKey = `documents/${user.id}/${uniqueId}.${extension}`;

        await uploadFile(file.buffer, objectKey, file.mimetype);

        const doc = await prisma.document.create({
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
        documentRecords.push(doc);
      }
    }

    // Generate JWT token
    const token = generateJWT(user.id, user.email);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: role.toLowerCase(),
        },
        token,
      },
    });
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

/**
 * Login user
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Find account and verify password
    const account = await prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: 'credentials',
      },
    });

    if (!account || account.password !== hashPassword(password)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Determine role
    let role = 'user';
    const [patient, therapist] = await Promise.all([
      prisma.patient.findFirst({ where: { userId: user.id } }),
      prisma.therapist.findFirst({ where: { userId: user.id } }),
    ]);

    if (patient) role = 'patient';
    else if (therapist) {
      role = 'therapist';

      // Restrict login for unverified therapists
      if (therapist.verificationStatus === 'pending') {
        return res.status(403).json({
          success: false,
          message: 'Votre compte est toujours en cours de vérification. Veuillez réessayer plus tard.',
        });
      }

      if (therapist.verificationStatus === 'rejected') {
        return res.status(403).json({
          success: false,
          message: 'Votre compte a été rejeté. Veuillez contacter le support pour plus d\'informations.',
        });
      }
    }
    if (user.email.endsWith('@tassarut.dz') || user.email === 'admin@tassarut.dz') {
      role = 'admin';
    }

    // Generate JWT token
    const token = generateJWT(user.id, user.email);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user (stateless - no action needed on backend with JWT)
 */
const logout = async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 */
const getCurrentUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    // Determine role
    let role = 'user';
    const [patient, therapist] = await Promise.all([
      prisma.patient.findFirst({ where: { userId: req.user.id } }),
      prisma.therapist.findFirst({ where: { userId: req.user.id } }),
    ]);

    if (patient) role = 'patient';
    else if (therapist) role = 'therapist';
    if (req.user.email.endsWith('@tassarut.dz') || req.user.email === 'admin@tassarut.dz') {
      role = 'admin';
    }

    res.json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role,
        patientId: patient?.id,
        therapistId: therapist?.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Don't reveal if user exists
    if (user) {
      // Create verification token
      const token = generateId();
      await prisma.verification.create({
        data: {
          id: generateId(),
          identifier: email,
          value: token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // TODO: Send email with reset link
      console.log(`Password reset token for ${email}: ${token}`);
    }

    res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const verification = await prisma.verification.findFirst({
      where: {
        value: token,
        expiresAt: { gt: new Date() },
      },
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

    // Update password
    await prisma.account.updateMany({
      where: { userId: user.id, providerId: 'credentials' },
      data: { password: hashPassword(password) },
    });

    // Delete verification token
    await prisma.verification.delete({ where: { id: verification.id } });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    const verification = await prisma.verification.findFirst({
      where: {
        value: token,
        expiresAt: { gt: new Date() },
      },
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

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
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