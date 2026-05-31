const { prisma } = require('../db/prisma');

/**
 * Authentication middleware
 * Verifies the session token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    // Find session by token
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      return res.status(401).json({
        success: false,
        message: 'Token expired',
      });
    }

    // Determine user role based on patient/therapist records
    let role = 'user';
    const [patient, therapist] = await Promise.all([
      prisma.patient.findFirst({ where: { userId: session.user.id } }),
      prisma.therapist.findFirst({ where: { userId: session.user.id } }),
    ]);

    if (patient) role = 'patient';
    else if (therapist) role = 'therapist';
    
    // Check if admin (you can customize this logic)
    if (session.user.email.endsWith('@tassarut.dz') || session.user.email === 'admin@tassarut.dz') {
      role = 'admin';
    }

    // Attach user and role to request
    req.user = {
      ...session.user,
      role,
      patientId: patient?.id,
      therapistId: therapist?.id,
    };
    req.session = session;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

/**
 * Authorization middleware
 * Checks if user has required role
 */
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
