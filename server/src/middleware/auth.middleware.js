const { prisma } = require('../db/prisma');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
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

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Fetch user from database to get full info
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // Determine user role based on patient/therapist records
    let role = 'user';
    const [patient, therapist] = await Promise.all([
      prisma.patient.findFirst({ where: { userId: user.id } }),
      prisma.therapist.findFirst({ where: { userId: user.id } }),
    ]);

    if (patient) role = 'patient';
    else if (therapist) role = 'therapist';
    
    // Check if admin
    if (user.email.endsWith('@tassarut.dz') || user.email === 'admin@tassarut.dz') {
      role = 'admin';
    }

    // Attach user and role to request
    req.user = {
      ...user,
      role,
      patientId: patient?.id,
      therapistId: therapist?.id,
    };

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
