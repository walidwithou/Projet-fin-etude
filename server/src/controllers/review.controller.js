import { prisma } from '../db/prisma.js';
import crypto from 'crypto';

const generateId = () => crypto.randomUUID();

/**
 * Get therapist reviews (public) - uses AppointmentOutcome model
 */
const getTherapistReviews = async (req, res, next) => {
  try {
    const { therapistId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.appointmentOutcome.findMany({
        where: {
          isVisible: true,
          rating: { not: null },
          appointment: {
            therapistId,
          },
        },
        include: {
          appointment: {
            select: {
              patientId: true,
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.appointmentOutcome.count({
        where: {
          isVisible: true,
          rating: { not: null },
          appointment: {
            therapistId,
          },
        },
      }),
    ]);

    // Hide patient info for anonymous reviews
    const sanitizedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      isAnonymous: review.isAnonymous,
      isVisible: review.isVisible,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      patientId: review.isAnonymous ? null : review.appointment?.patientId,
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
 * Create a review (as AppointmentOutcome rating)
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

    // Check if patient already reviewed this therapist via AppointmentOutcome
    const existingReview = await prisma.appointmentOutcome.findFirst({
      where: {
        rating: { not: null },
        appointment: {
          patientId: patient.id,
          therapistId,
        },
      },
    });

    if (existingReview && appointmentId !== existingReview.appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this therapist',
      });
    }

    // Find or create the AppointmentOutcome
    let outcome;
    if (appointmentId) {
      outcome = await prisma.appointmentOutcome.upsert({
        where: { appointmentId },
        update: {
          rating,
          comment: comment || undefined,
          isAnonymous: isAnonymous || false,
        },
        create: {
          appointmentId,
          rating,
          comment: comment || null,
          isAnonymous: isAnonymous || false,
        },
      });
    } else {
      // If no appointmentId, use the completed appointment
      outcome = await prisma.appointmentOutcome.upsert({
        where: { appointmentId: hasAppointment.id },
        update: {
          rating,
          comment: comment || undefined,
          isAnonymous: isAnonymous || false,
        },
        create: {
          appointmentId: hasAppointment.id,
          rating,
          comment: comment || null,
          isAnonymous: isAnonymous || false,
        },
      });
    }

    // Update therapist rating
    const reviews = await prisma.appointmentOutcome.findMany({
      where: {
        isVisible: true,
        rating: { not: null },
        appointment: {
          therapistId,
        },
      },
      select: { rating: true },
    });

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : rating;

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
      data: outcome,
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

    const outcome = await prisma.appointmentOutcome.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!outcome) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (outcome.appointment.patientId !== patient.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const updated = await prisma.appointmentOutcome.update({
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
      const reviews = await prisma.appointmentOutcome.findMany({
        where: {
          isVisible: true,
          rating: { not: null },
          appointment: {
            therapistId: outcome.appointment.therapistId,
          },
        },
        select: { rating: true },
      });

      const averageRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

      await prisma.therapist.update({
        where: { id: outcome.appointment.therapistId },
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

    const outcome = await prisma.appointmentOutcome.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!outcome) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (outcome.appointment.patientId !== patient.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Clear rating fields instead of deleting the whole outcome
    await prisma.appointmentOutcome.update({
      where: { id },
      data: {
        rating: null,
        comment: null,
        isAnonymous: true,
        isVisible: false,
        updatedAt: new Date(),
      },
    });

    // Update therapist rating
    const reviews = await prisma.appointmentOutcome.findMany({
      where: {
        isVisible: true,
        rating: { not: null },
        appointment: {
          therapistId: outcome.appointment.therapistId,
        },
      },
      select: { rating: true },
    });

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    await prisma.therapist.update({
      where: { id: outcome.appointment.therapistId },
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
      prisma.appointmentOutcome.findMany({
        where: {
          rating: { not: null },
        },
        skip,
        take: parseInt(limit),
        include: {
          appointment: {
            include: {
              patient: true,
              therapist: {
                include: {
                  user: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.appointmentOutcome.count({
        where: {
          rating: { not: null },
        },
      }),
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

    const outcome = await prisma.appointmentOutcome.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!outcome) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    const updated = await prisma.appointmentOutcome.update({
      where: { id },
      data: {
        isVisible: isVisible !== undefined ? isVisible : !outcome.isVisible,
        updatedAt: new Date(),
      },
    });

    // Update therapist rating
    const reviews = await prisma.appointmentOutcome.findMany({
      where: {
        isVisible: true,
        rating: { not: null },
        appointment: {
          therapistId: outcome.appointment.therapistId,
        },
      },
      select: { rating: true },
    });

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    await prisma.therapist.update({
      where: { id: outcome.appointment.therapistId },
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
        resourceType: 'appointment_outcome',
        resourceId: id,
        previousValue: { isVisible: outcome.isVisible },
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

export {
  getTherapistReviews,
  create,
  update,
  deleteReview as delete,
  getAll,
  toggleVisibility,
};