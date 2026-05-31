const { prisma } = require('../db/prisma');
const crypto = require('crypto');

const generateId = () => crypto.randomUUID();

/**
 * Get therapist reviews (public)
 */
const getTherapistReviews = async (req, res, next) => {
  try {
    const { therapistId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          therapistId,
          isVisible: true,
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.count({
        where: {
          therapistId,
          isVisible: true,
        },
      }),
    ]);

    // Hide patient info for anonymous reviews
    const sanitizedReviews = reviews.map((review) => ({
      ...review,
      patientId: review.isAnonymous ? null : review.patientId,
    }));

    res.json({
      success: true,
      data: sanitizedReviews,
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
 * Create a review
 */
const create = async (req, res, next) => {
  try {
    const { therapistId, appointmentId, rating, comment, isAnonymous } = req.body;

    if (!therapistId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Therapist ID and rating are required',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    // Get patient profile
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    // Verify patient has had an appointment with this therapist
    const hasAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        therapistId,
        status: 'completed',
      },
    });

    if (!hasAppointment) {
      return res.status(400).json({
        success: false,
        message: 'You can only review therapists you have had appointments with',
      });
    }

    // Check if patient already reviewed this therapist
    const existingReview = await prisma.review.findFirst({
      where: {
        patientId: patient.id,
        therapistId,
      },
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this therapist',
      });
    }

    const review = await prisma.review.create({
      data: {
        id: generateId(),
        patientId: patient.id,
        therapistId,
        appointmentId,
        rating,
        comment,
        isAnonymous: isAnonymous || false,
      },
    });

    // Update therapist rating
    const reviews = await prisma.review.findMany({
      where: { therapistId, isVisible: true },
      select: { rating: true },
    });

    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await prisma.therapist.update({
      where: { id: therapistId },
      data: {
        rating: averageRating,
        totalReviews: reviews.length,
        updatedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a review
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment, isAnonymous } = req.body;

    // Get patient profile
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    const review = await prisma.review.findUnique({ where: { id } });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (review.patientId !== patient.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        rating: rating !== undefined ? rating : undefined,
        comment: comment !== undefined ? comment : undefined,
        isAnonymous: isAnonymous !== undefined ? isAnonymous : undefined,
        updatedAt: new Date(),
      },
    });

    // Update therapist rating if rating changed
    if (rating !== undefined) {
      const reviews = await prisma.review.findMany({
        where: { therapistId: review.therapistId, isVisible: true },
        select: { rating: true },
      });

      const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      await prisma.therapist.update({
        where: { id: review.therapistId },
        data: { rating: averageRating, updatedAt: new Date() },
      });
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a review
 */
const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get patient profile
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    const review = await prisma.review.findUnique({ where: { id } });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (review.patientId !== patient.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await prisma.review.delete({ where: { id } });

    // Update therapist rating
    const reviews = await prisma.review.findMany({
      where: { therapistId: review.therapistId, isVisible: true },
      select: { rating: true },
    });

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    await prisma.therapist.update({
      where: { id: review.therapistId },
      data: {
        rating: averageRating,
        totalReviews: reviews.length,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Review deleted',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all reviews (admin only)
 */
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        skip,
        take: parseInt(limit),
        include: {
          patient: true,
          therapist: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.count(),
    ]);

    res.json({
      success: true,
      data: reviews,
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
 * Toggle review visibility (admin only)
 */
const toggleVisibility = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isVisible } = req.body;

    const review = await prisma.review.findUnique({ where: { id } });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        isVisible: isVisible !== undefined ? isVisible : !review.isVisible,
        updatedAt: new Date(),
      },
    });

    // Update therapist rating
    const reviews = await prisma.review.findMany({
      where: { therapistId: review.therapistId, isVisible: true },
      select: { rating: true },
    });

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    await prisma.therapist.update({
      where: { id: review.therapistId },
      data: {
        rating: averageRating,
        totalReviews: reviews.length,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        id: generateId(),
        actorId: req.user.id,
        actorRole: 'admin',
        action: 'review.visibility_changed',
        resourceType: 'review',
        resourceId: id,
        previousValue: { isVisible: review.isVisible },
        newValue: { isVisible: updated.isVisible },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTherapistReviews,
  create,
  update,
  delete: deleteReview,
  getAll,
  toggleVisibility,
};
