import { prisma } from '../db/prisma.js';
import crypto from 'crypto';

const generateId = () => crypto.randomUUID();

/**
 * Get dashboard statistics
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers,
      totalPatients,
      totalTherapists,
      pendingTherapists,
      totalAppointments,
      monthlyAppointments,
      completedAppointments,
      cancelledAppointments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.patient.count(),
      prisma.therapist.count(),
      prisma.therapist.count({ where: { verificationStatus: 'pending' } }),
      prisma.appointment.count(),
      prisma.appointment.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.appointment.count({ where: { status: 'completed' } }),
      prisma.appointment.count({ where: { status: 'cancelled' } }),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalPatients,
        totalTherapists,
        pendingTherapists,
        totalAppointments,
        monthlyAppointments,
        completedAppointments,
        cancelledAppointments,
        completionRate: totalAppointments > 0
          ? ((completedAppointments / totalAppointments) * 100).toFixed(2)
          : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get associated profiles
    const [patient, therapist] = await Promise.all([
      prisma.patient.findFirst({ where: { userId: id } }),
      prisma.therapist.findFirst({ where: { userId: id } }),
    ]);

    res.json({
      success: true,
      data: {
        ...user,
        patient,
        therapist,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user status
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // For now, we can track status by managing sessions
    // A more robust solution would add a status field to the user table
    
    if (status === 'disabled') {
      // Delete all user sessions to log them out
      await prisma.session.deleteMany({ where: { userId: id } });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        id: generateId(),
        actorId: req.user.id,
        actorRole: 'admin',
        action: 'user.status_updated',
        resourceType: 'user',
        resourceId: id,
        newValue: { status },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: `User status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending therapists
 */
const getPendingTherapists = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [therapists, total] = await Promise.all([
      prisma.therapist.findMany({
        where: { verificationStatus: 'pending' },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'asc' },
      }),
      prisma.therapist.count({ where: { verificationStatus: 'pending' } }),
    ]);

    res.json({
      success: true,
      data: therapists,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify therapist
 */
const verifyTherapist = async (req, res, next) => {
  try {
    const { id } = req.params;

    const therapist = await prisma.therapist.update({
      where: { id },
      data: {
        verificationStatus: 'verified',
        updatedAt: new Date(),
      },
    });

    // Notify therapist
    await prisma.notification.create({
      data: {
        id: generateId(),
        userId: therapist.userId,
        type: 'verification',
        title: 'Account Verified',
        message: 'Congratulations! Your therapist account has been verified. You can now start accepting patients.',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        id: generateId(),
        actorId: req.user.id,
        actorRole: 'admin',
        action: 'therapist.verified',
        resourceType: 'therapist',
        resourceId: id,
        newValue: { verificationStatus: 'verified' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      data: therapist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject therapist
 */
const rejectTherapist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const therapist = await prisma.therapist.update({
      where: { id },
      data: {
        verificationStatus: 'rejected',
        updatedAt: new Date(),
      },
    });

    // Notify therapist
    await prisma.notification.create({
      data: {
        id: generateId(),
        userId: therapist.userId,
        type: 'verification',
        title: 'Verification Rejected',
        message: reason || 'Your therapist verification has been rejected. Please contact support for more information.',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        id: generateId(),
        actorId: req.user.id,
        actorRole: 'admin',
        action: 'therapist.rejected',
        resourceType: 'therapist',
        resourceId: id,
        newValue: { verificationStatus: 'rejected', reason },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      data: therapist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit logs
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, action, resourceType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get appointment reports
 */
const getAppointmentReports = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    const where = {};
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }

    const appointments = await prisma.appointment.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const statusCounts = appointments.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        byStatus: statusCounts,
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get revenue reports
 */
const getRevenueReports = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    const where = { status: 'completed' };
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: { therapist: { select: { hourlyRate: true, currency: true } } },
    });

    let totalRevenue = 0;
    for (const appt of appointments) {
      if (appt.therapist.hourlyRate) {
        totalRevenue += parseFloat(appt.therapist.hourlyRate) * (appt.durationMinutes / 60);
      }
    }

    res.json({
      success: true,
      data: {
        totalRevenue,
        currency: 'DZD',
        completedAppointments: appointments.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export {
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateUserStatus,
  getPendingTherapists,
  verifyTherapist,
  rejectTherapist,
  getAuditLogs,
  getAppointmentReports,
  getRevenueReports,
};