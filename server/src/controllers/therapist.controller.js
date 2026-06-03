import { prisma } from '../db/prisma.js';

/**
 * Get public list of verified therapists
 */
const getPublicTherapists = async (req, res, next) => {
  try {
    const { specialization, language, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      verificationStatus: 'verified',
      acceptingNewPatients: true,
    };

    if (specialization) {
      where.specializations = { has: specialization };
    }
    if (language) {
      where.languages = { has: language };
    }

    const [therapists, total] = await Promise.all([
      prisma.therapist.findMany({
        where,
        select: {
          id: true,
          bio: true,
          specializations: true,
          yearsOfExperience: true,
          education: true,
          profilePhotoUrl: true,
          hourlyRate: true,
          currency: true,
          languages: true,
          rating: true,
          totalReviews: true,
        },
        skip,
        take: parseInt(limit),
        orderBy: [{ rating: 'desc' }, { totalReviews: 'desc' }],
      }),
      prisma.therapist.count({ where }),
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
 * Get public therapist profile
 */
const getPublicTherapistProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const therapist = await prisma.therapist.findFirst({
      where: {
        id,
        verificationStatus: 'verified',
      },
      select: {
        id: true,
        bio: true,
        specializations: true,
        yearsOfExperience: true,
        education: true,
        profilePhotoUrl: true,
        hourlyRate: true,
        currency: true,
        availability: true,
        languages: true,
        rating: true,
        totalReviews: true,
      },
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found',
      });
    }

    res.json({
      success: true,
      data: therapist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get therapist profile (own profile)
 */
const getProfile = async (req, res, next) => {
  try {
    const therapist = await prisma.therapist.findFirst({
      where: { userId: req.user.id },
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist profile not found',
      });
    }

    res.json({
      success: true,
      data: therapist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update therapist profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const {
      licenseNumber,
      specializations,
      yearsOfExperience,
      education,
      bio,
      profilePhotoUrl,
      hourlyRate,
      currency,
      languages,
      acceptingNewPatients,
    } = req.body;

    await prisma.therapist.updateMany({
      where: { userId: req.user.id },
      data: {
        licenseNumber,
        specializations,
        yearsOfExperience,
        education,
        bio,
        profilePhotoUrl,
        hourlyRate,
        currency,
        languages,
        acceptingNewPatients,
        updatedAt: new Date(),
      },
    });

    const updatedTherapist = await prisma.therapist.findFirst({
      where: { userId: req.user.id },
    });

    res.json({
      success: true,
      data: updatedTherapist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update therapist availability
 */
const updateAvailability = async (req, res, next) => {
  try {
    const { availability } = req.body;

    if (!availability) {
      return res.status(400).json({
        success: false,
        message: 'Availability data is required',
      });
    }

    await prisma.therapist.updateMany({
      where: { userId: req.user.id },
      data: {
        availability,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Availability updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get therapist's patients
 */
const getPatients = async (req, res, next) => {
  try {
    const therapist = await prisma.therapist.findFirst({
      where: { userId: req.user.id },
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist profile not found',
      });
    }

    const patients = await prisma.patient.findMany({
      where: { matchedTherapistId: therapist.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: patients,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get therapist's appointments
 */
const getAppointments = async (req, res, next) => {
  try {
    const therapist = await prisma.therapist.findFirst({
      where: { userId: req.user.id },
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist profile not found',
      });
    }

    const { status, from, to } = req.query;
    const where = { therapistId: therapist.id };

    if (status) {
      where.status = status;
    }
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    res.json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get therapist's reviews
 */
const getReviews = async (req, res, next) => {
  try {
    const therapist = await prisma.therapist.findFirst({
      where: { userId: req.user.id },
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist profile not found',
      });
    }

    const reviews = await prisma.review.findMany({
      where: {
        therapistId: therapist.id,
        isVisible: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get therapist statistics/dashboard
 */
const getStats = async (req, res, next) => {
  try {
    const therapist = await prisma.therapist.findFirst({
      where: { userId: req.user.id },
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist profile not found',
      });
    }

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalPatients,
      totalAppointments,
      completedAppointments,
      upcomingAppointments,
      monthlyAppointments,
      averageRating,
    ] = await Promise.all([
      prisma.patient.count({ where: { matchedTherapistId: therapist.id } }),
      prisma.appointment.count({ where: { therapistId: therapist.id } }),
      prisma.appointment.count({ where: { therapistId: therapist.id, status: 'completed' } }),
      prisma.appointment.count({
        where: {
          therapistId: therapist.id,
          status: 'scheduled',
          scheduledAt: { gte: now },
        },
      }),
      prisma.appointment.count({
        where: {
          therapistId: therapist.id,
          createdAt: { gte: thisMonth },
        },
      }),
      prisma.review.aggregate({
        where: { therapistId: therapist.id, isVisible: true },
        _avg: { rating: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalPatients,
        totalAppointments,
        completedAppointments,
        upcomingAppointments,
        monthlyAppointments,
        averageRating: averageRating._avg.rating || 0,
        totalReviews: therapist.totalReviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all therapists (admin only)
 */
const getAllTherapists = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) {
      where.verificationStatus = status;
    }

    const [therapists, total] = await Promise.all([
      prisma.therapist.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.therapist.count({ where }),
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
 * Get therapist by ID (admin)
 */
const getTherapistById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const therapist = await prisma.therapist.findUnique({
      where: { id },
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found',
      });
    }

    res.json({
      success: true,
      data: therapist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify therapist (admin)
 */
const verifyTherapist = async (req, res, next) => {
  try {
    const { id } = req.params;

    const therapist = await prisma.therapist.update({
      where: { id },
      data: {
        verificationStatus: 'verified',
        licenseVerified: true,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
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
 * Upload documents (diplomas, certificates) for the authenticated therapist
 */
const uploadDocuments = async (req, res, next) => {
  try {
    const therapist = await prisma.therapist.findFirst({
      where: { userId: req.user.id },
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist profile not found',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    // Upload each file to Filebase and create a Document record
    const { uploadFile } = await import('../services/storage.service.js');
    const { randomUUID } = await import('crypto');

    const documents = [];
    for (const file of req.files) {
      const uniqueId = randomUUID();
      const extension = file.originalname.split('.').pop();
      const objectKey = `documents/${therapist.userId}/${uniqueId}.${extension}`;

      await uploadFile(file.buffer, objectKey, file.mimetype);

      const doc = await prisma.document.create({
        data: {
          ownerId: therapist.userId,
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
      documents.push(doc);
    }

    res.status(200).json({
      success: true,
      data: {
        documents,
        message: `${documents.length} document(s) uploaded successfully`,
      },
    });
  } catch (error) {
    next(error);
  }
};

export {
  getPublicTherapists,
  getPublicTherapistProfile,
  getProfile,
  updateProfile,
  updateAvailability,
  getPatients,
  getAppointments,
  getReviews,
  getStats,
  getAllTherapists,
  getTherapistById,
  verifyTherapist,
  uploadDocuments,
};
