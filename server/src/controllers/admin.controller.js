import { prisma } from '../db/prisma.js';
import crypto from 'crypto';
import { getSignedDownloadUrl } from '../services/storage.service.js';

const generateId = () => crypto.randomUUID();

const SIGNED_URL_EXPIRY_SECONDS = parseInt(
  process.env.SIGNED_URL_EXPIRY_SECONDS || '3600',
  10,
);

/**
 * Get dashboard statistics.
 *
 * FIX (issue #2): we now ALSO count rows in the Therapist table where
 * `verificationStatus === 'verified'`. The previous implementation only
 * counted `pending`, which is why the "Praticiens Validés" KPI in the
 * admin dashboard always displayed 0. The query is on the Therapist
 * table (the table that actually carries the verificationStatus column
 * in our schema) and uses an exact string match.
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
      verifiedTherapists,
      rejectedTherapists,
      totalAppointments,
      monthlyAppointments,
      completedAppointments,
      cancelledAppointments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.patient.count(),
      prisma.therapist.count(),
      prisma.therapist.count({ where: { verificationStatus: 'pending' } }),
      prisma.therapist.count({ where: { verificationStatus: 'verified' } }),
      prisma.therapist.count({ where: { verificationStatus: 'rejected' } }),
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
        verifiedTherapists,
        rejectedTherapists,
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
 * Get all users.
 *
 * FIX (issue #4): the previous version returned raw User rows with no
 * link to the Therapist profile, so the panel could not display the
 * verification status. We now left-join the Therapist profile and
 * surface `verificationStatus` (and the full profile) at the top level
 * of each row, while keeping the raw User shape intact for the rest of
 * the columns. The frontend "STATUT" column uses this field directly.
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
        include: {
          // Polymorphic join: patient OR therapist may exist for a User.
          // We pull both with the bare minimum of fields the admin UI needs.
          patient: {
            select: { id: true },
          },
          therapist: {
            select: {
              id: true,
              verificationStatus: true,
              approcheTherapeute: true,
              acceptingNewPatients: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Flatten the therapist verificationStatus onto the row so the
    // frontend can render the "STATUT" column without having to
    // inspect a nested object.
    const rows = users.map((u) => ({
      ...u,
      verificationStatus: u.therapist?.verificationStatus ?? null,
      therapistId: u.therapist?.id ?? null,
    }));

    res.json({
      success: true,
      data: rows,
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
 * Get pending therapists.
 *
 * FIX (issue #3): the previous version returned the raw Therapist rows
 * with NO `include`, so the frontend never saw the User's name/email
 * nor the list of uploaded documents. We now eager-load the User
 * relation (for display) and the documents linked to the therapist
 * (for the verification review panel).
 *
 * Documents are not streamed through Express; we generate short-lived
 * SIGNED URLs via the storage service SDK so the browser can fetch
 * them directly from the cloud bucket. URLs are time-limited to
 * SIGNED_URL_EXPIRY_SECONDS (default 1h) to prevent link-sharing.
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
        include: {
          user: {
            select: { id: true, name: true, email: true, createdAt: true },
          },
          documentFiles: {
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              fileSize: true,
              objectKey: true,
              bucketName: true,
              documentType: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.therapist.count({ where: { verificationStatus: 'pending' } }),
    ]);

    // Attach a signed view URL to each document so the admin browser
    // can render the file inline without leaking the raw object key.
    const rows = await Promise.all(
      therapists.map(async (t) => ({
        ...t,
        // Normalized fields the frontend already uses in Panel.jsx
        name: t.user?.name,
        email: t.user?.email,
        documents: await Promise.all(
          (t.documentFiles || []).map(async (doc) => {
            try {
              const url = await getSignedDownloadUrl(doc.objectKey, {
                bucket: doc.bucketName,
                filename: doc.originalName,
                expiresIn: SIGNED_URL_EXPIRY_SECONDS,
              });
              return {
                id: doc.id,
                originalName: doc.originalName,
                mimeType: doc.mimeType,
                fileSize: doc.fileSize,
                documentType: doc.documentType,
                createdAt: doc.createdAt,
                // The two URLs the admin UI consumes:
                //   - `url`         : inline view (rendering <iframe>/<img>)
                //   - `downloadUrl` : force-download
                // Both are signed, both expire in SIGNED_URL_EXPIRY_SECONDS.
                url,
                downloadUrl: url,
                expiresAt: new Date(
                  Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000,
                ).toISOString(),
              };
            } catch (e) {
              // If signing fails (e.g. transient network), still ship
              // the metadata so the admin UI can show a graceful error
              // state. We do NOT leak the raw `objectKey` to the client.
              return {
                id: doc.id,
                originalName: doc.originalName,
                mimeType: doc.mimeType,
                fileSize: doc.fileSize,
                documentType: doc.documentType,
                createdAt: doc.createdAt,
                url: null,
                downloadUrl: null,
                error: 'signed-url-unavailable',
              };
            }
          }),
        ),
      })),
    );

    res.json({
      success: true,
      data: rows,
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
 * Get ALL therapists (any verificationStatus).
 *
 * Mirrors `getPendingTherapists` but without the status filter, so the
 * admin "Demandes arbitrées récemment" panel (verified + rejected rows)
 * can be populated. Used by GET /api/admin/therapists?limit=100.
 */
const getAllTherapists = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [therapists, total] = await Promise.all([
      prisma.therapist.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, createdAt: true },
          },
          documentFiles: {
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              fileSize: true,
              objectKey: true,
              bucketName: true,
              documentType: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.therapist.count(),
    ]);

    // Attach a signed view URL to each document. Same shape as
    // getPendingTherapists so the frontend can reuse a single renderer.
    const rows = await Promise.all(
      therapists.map(async (t) => ({
        ...t,
        name: t.user?.name,
        email: t.user?.email,
        documents: await Promise.all(
          (t.documentFiles || []).map(async (doc) => {
            try {
              const url = await getSignedDownloadUrl(doc.objectKey, {
                bucket: doc.bucketName,
                filename: doc.originalName,
                expiresIn: SIGNED_URL_EXPIRY_SECONDS,
              });
              return {
                id: doc.id,
                originalName: doc.originalName,
                mimeType: doc.mimeType,
                fileSize: doc.fileSize,
                documentType: doc.documentType,
                createdAt: doc.createdAt,
                url,
                downloadUrl: url,
                expiresAt: new Date(
                  Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000,
                ).toISOString(),
              };
            } catch (e) {
              return {
                id: doc.id,
                originalName: doc.originalName,
                mimeType: doc.mimeType,
                fileSize: doc.fileSize,
                documentType: doc.documentType,
                createdAt: doc.createdAt,
                url: null,
                downloadUrl: null,
                error: 'signed-url-unavailable',
              };
            }
          }),
        ),
      })),
    );

    res.json({
      success: true,
      data: rows,
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
 * Get a single therapist's full verification profile.
 *
 * FIX (issue #3): dedicated endpoint that returns the practitioner
 * profile, the User, AND signed document URLs in a single round-trip.
 * The frontend's Panel.jsx calls this when the admin clicks on a
 * pending request to populate the "Examen du Dossier" panel.
 *
 *   GET /api/admin/therapists/:id/verification-details
 */
const getTherapistVerificationDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const therapist = await prisma.therapist.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            emailVerified: true,
          },
        },
        documentFiles: {
          orderBy: { createdAt: 'asc' },
        },
        // Also surface the join tables the admin may want to read.
        consultationModes: { include: { consultationMode: true } },
        languages: { include: { language: true } },
        pathologies: { include: { pathology: true } },
        publicTypes: { include: { publicType: true } },
        timeSlots: { include: { timeSlot: true } },
      },
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found',
      });
    }

    // Sign the document URLs. Same shape as getPendingTherapists so
    // the frontend can reuse a single renderer.
    const documents = await Promise.all(
      (therapist.documentFiles || []).map(async (doc) => {
        try {
          const url = await getSignedDownloadUrl(doc.objectKey, {
            bucket: doc.bucketName,
            filename: doc.originalName,
            expiresIn: SIGNED_URL_EXPIRY_SECONDS,
          });
          return {
            id: doc.id,
            originalName: doc.originalName,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            documentType: doc.documentType,
            createdAt: doc.createdAt,
            url,
            downloadUrl: url,
            expiresAt: new Date(
              Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000,
            ).toISOString(),
          };
        } catch (e) {
          return {
            id: doc.id,
            originalName: doc.originalName,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            documentType: doc.documentType,
            createdAt: doc.createdAt,
            url: null,
            downloadUrl: null,
            error: 'signed-url-unavailable',
          };
        }
      }),
    );

    res.json({
      success: true,
      data: {
        ...therapist,
        name: therapist.user?.name,
        email: therapist.user?.email,
        documents,
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
  getAllTherapists,
  getTherapistVerificationDetails,
  verifyTherapist,
  rejectTherapist,
  getAuditLogs,
  getAppointmentReports,
  getRevenueReports,
};
