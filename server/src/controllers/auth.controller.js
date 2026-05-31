const { prisma } = require('../db/prisma');
const crypto = require('crypto');

/**
 * Generate a random ID
 */
const generateId = () => crypto.randomUUID();

/**
 * Generate a session token
 */
const generateToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Hash a password (simple implementation - use bcrypt in production)
 */
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

/**
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and name are required',
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Create user
    const userId = generateId();
    const user = await prisma.user.create({
      data: {
        id: userId,
        email,
        name,
        emailVerified: false,
      },
    });

    // Create account with password
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: userId,
        providerId: 'credentials',
        userId: user.id,
        password: hashPassword(password),
      },
    });

    // Create patient or therapist profile based on role
    if (role === 'therapist') {
      await prisma.therapist.create({
        data: {
          userId: user.id,
          verificationStatus: 'pending',
        },
      });
    } else {
      // Default to patient
      await prisma.patient.create({
        data: {
          userId: user.id,
          onboardingCompleted: false,
        },
      });
    }

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await prisma.session.create({
      data: {
        id: generateId(),
        token,
        expiresAt,
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: role || 'patient',
        },
        token: session.token,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
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
    else if (therapist) role = 'therapist';
    if (user.email.endsWith('@tassarut.dz') || user.email === 'admin@tassarut.dz') {
      role = 'admin';
    }

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        id: generateId(),
        token,
        expiresAt,
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
        },
        token: session.token,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 */
const logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await prisma.session.deleteMany({ where: { token } });
    }

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
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Determine role
    let role = 'user';
    const [patient, therapist] = await Promise.all([
      prisma.patient.findFirst({ where: { userId: session.user.id } }),
      prisma.therapist.findFirst({ where: { userId: session.user.id } }),
    ]);

    if (patient) role = 'patient';
    else if (therapist) role = 'therapist';
    if (session.user.email.endsWith('@tassarut.dz') || session.user.email === 'admin@tassarut.dz') {
      role = 'admin';
    }

    res.json({
      success: true,
      data: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
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
 * Refresh token
 */
const refreshToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const oldToken = authHeader.split(' ')[1];

    const session = await prisma.session.findUnique({
      where: { token: oldToken },
      include: { user: true },
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    // Generate new token
    const newToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.update({
      where: { id: session.id },
      data: { token: newToken, expiresAt },
    });

    res.json({
      success: true,
      data: {
        token: newToken,
        expiresAt,
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
      const token = generateToken();
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

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
};
