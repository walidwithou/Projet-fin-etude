import { prisma } from '../db/prisma.js';

// ---------------------------------------------------------------------------
// Timezone-agnostic date helpers
// ---------------------------------------------------------------------------
// All helpers construct dates via Date.UTC so the interpreted time (e.g. 13:00)
// is stored identically in the database. No hidden timezone offset is applied.
// Without this, building via "new Date(y, m-1, d, h, min)" uses the server's
// local timezone (UTC+1 for Africa/Algiers), causing the database to store
// {h-1}:{min} UTC, which introduces a 1-hour shift relative to the UI.

const buildLocalDate = (dateStr, timeStr) => {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  const [h = 0, min = 0] = (timeStr || '00:00').split(':').map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid date components from "${dateStr}" "${timeStr}"`);
  }
  return new Date(Date.UTC(y, m - 1, d, h, min, 0, 0));
};

const startOfLocalDay = (dateStr) => {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
};

const endOfLocalDay = (dateStr) => {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 23, 59, 59, 999));
};

/**
 * Get public list of verified therapists
 */
const getPublicTherapists = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      verificationStatus: 'verified',
      acceptingNewPatients: true,
    };

    const [therapists, total] = await Promise.all([
      prisma.therapist.findMany({
        where,
        include: {
          consultationModes: {
            include: { consultationMode: true },
          },
          languages: {
            include: { language: true },
          },
          pathologies: {
            include: { pathology: true },
          },
          user: {
            select: { name: true },
          },
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
      include: {
        consultationModes: {
          include: { consultationMode: true },
        },
        languages: {
          include: { language: true },
        },
        pathologies: {
          include: { pathology: true },
        },
        user: {
          select: { name: true },
        },
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
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
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
      bio,
      profilePhotoUrl,
      hourlyRate,
      currency,
      acceptingNewPatients,
    } = req.body;

    await prisma.therapist.updateMany({
      where: { userId: req.user.id },
      data: {
        bio,
        profilePhotoUrl,
        hourlyRate,
        currency,
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
 *
 * DEPRECATED: availability is now stored in
 * `TherapistAvailableTimeSlot` (one row per slot). The legacy
 * JSON column on `Therapist` is kept for backwards compatibility
 * but no longer drives the calendar. New clients must use
 *   POST   /therapists/availability          (create slots)
 *   PUT    /therapists/availability/:slotId  (modify slot)
 *   DELETE /therapists/availability/:slotId  (delete slot)
 *   GET    /therapists/availability          (list slots)
 * This endpoint is kept as a no-op with a 410 Gone so old
 * clients fail fast and migrate.
 */
const updateAvailability = async (req, res, next) => {
  return res.status(410).json({
    success: false,
    message:
      'This endpoint is deprecated. Use POST/PUT/DELETE /therapists/availability to manage slots.',
  });
};

/**
 * Get therapist's patients.
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

    const patientsWithAppointments = await prisma.appointment.findMany({
      where: { therapistId: therapist.id },
      select: { patientId: true },
      distinct: ['patientId'],
    });

    const patientIds = new Set([
      ...patientsWithAppointments.map((a) => a.patientId),
    ]);

    if (therapist.id) {
      const currentlyAssigned = await prisma.patient.findMany({
        where: { currentTherapistid: therapist.id },
        select: { id: true },
      });
      currentlyAssigned.forEach((p) => patientIds.add(p.id));
    }

    const patients = patientIds.size
      ? await prisma.patient.findMany({
          where: { id: { in: Array.from(patientIds) } },
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const currentlyAssignedIds = new Set(
      patients
        .filter((p) => p.currentTherapistid === therapist.id)
        .map((p) => p.id),
    );
    const annotated = patients.map((p) => ({
      ...p,
      isCurrent: currentlyAssignedIds.has(p.id),
    }));

    res.json({
      success: true,
      data: annotated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get therapist's appointments.
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
      const statusList = String(status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statusList.length === 1) {
        where.status = statusList[0];
      } else if (statusList.length > 1) {
        where.status = { in: statusList };
      }
    }
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
        therapistAvailableTimeSlot: true,
        appointmentOutcome: true,
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
 * Get therapist's reviews.
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

    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isVisible: true,
      rating: { not: null },
      appointment: {
        therapistId: therapist.id,
      },
    };

    const [reviews, total] = await Promise.all([
      prisma.appointmentOutcome.findMany({
        where,
        include: {
          appointment: {
            select: {
              id: true,
              scheduledAt: true,
              patient: {
                select: {
                  id: true,
                  user: { select: { name: true } },
                },
              },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.appointmentOutcome.count({ where }),
    ]);

    const sanitizedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      isAnonymous: review.isAnonymous,
      isVisible: review.isVisible,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      appointmentId: review.appointmentId,
      scheduledAt: review.appointment?.scheduledAt ?? null,
      patientId: review.isAnonymous
        ? null
        : review.appointment?.patient?.id ?? null,
      patientName: review.isAnonymous
        ? null
        : review.appointment?.patient?.user?.name ?? null,
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
    ] = await Promise.all([
      prisma.patient.count({ where: { currentTherapistid: therapist.id } }),
      prisma.appointment.count({ where: { therapistId: therapist.id } }),
      prisma.appointment.count({
        where: { therapistId: therapist.id, status: 'completed' },
      }),
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
    ]);

    res.json({
      success: true,
      data: {
        totalPatients,
        totalAppointments,
        completedAppointments,
        upcomingAppointments,
        monthlyAppointments,
        totalReviews: therapist.totalReviews,
        rating: therapist.rating ? parseFloat(therapist.rating) : 0,
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
        updatedAt: new Date(),
      },
    });

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

/**
 * Get therapist's available time slots
 */
const getAvailability = async (req, res, next) => {
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

    const { from, to } = req.query;
    const where = { therapistId: therapist.id };

    if (from || to) {
      where.startAt = {};
      if (from) where.startAt.gte = new Date(from);
      if (to) where.startAt.lte = new Date(to);
    }

    const slots = await prisma.therapistAvailableTimeSlot.findMany({
      where,
      include: {
        appointment: {
          select: { id: true, status: true },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    res.json({
      success: true,
      data: slots,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create time slots for a therapist.
 */
const createTimeSlots = async (req, res, next) => {
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

    const { slots } = req.body;

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Slots array is required',
      });
    }

    const createdSlots = [];

    for (const slotGroup of slots) {
      const { date, startTime, endTime } = slotGroup;

      if (!date || !startTime || !endTime) {
        continue;
      }

      let startDate;
      let endDate;
      try {
        startDate = buildLocalDate(date, startTime);
        endDate = buildLocalDate(date, endTime);
      } catch (_) {
        continue;
      }

      if (startDate >= endDate) continue;

      let current = new Date(startDate);
      while (current < endDate) {
        const slotEnd = new Date(current);
        // Use UTC hours since the dates are constructed via Date.UTC
        slotEnd.setUTCHours(current.getUTCHours() + 1, 0, 0, 0);

        if (slotEnd > endDate) break;

        const existingSlot = await prisma.therapistAvailableTimeSlot.findFirst({
          where: {
            therapistId: therapist.id,
            startAt: current,
            endAt: slotEnd,
          },
        });

        if (!existingSlot) {
          const slot = await prisma.therapistAvailableTimeSlot.create({
            data: {
              therapistId: therapist.id,
              startAt: current,
              endAt: slotEnd,
              isBooked: false,
            },
          });
          createdSlots.push(slot);
        }

        current = new Date(slotEnd);
      }
    }

    res.status(201).json({
      success: true,
      data: createdSlots,
      message: `${createdSlots.length} créneau(x) créé(s) avec succès`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update (modify) a single time slot.
 */
const updateTimeSlot = async (req, res, next) => {
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

    const { slotId } = req.params;
    const { date, startTime, endTime } = req.body || {};

    if (!date && !startTime && !endTime) {
      return res.status(400).json({
        success: false,
        message: 'At least one of date, startTime, endTime is required',
      });
    }

    const slot = await prisma.therapistAvailableTimeSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Time slot not found',
      });
    }

    if (slot.therapistId !== therapist.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - this slot does not belong to you',
      });
    }

    if (slot.isBooked) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot modify a booked time slot. Cancel the appointment first.',
      });
    }

    const oldStart = new Date(slot.startAt);
    const oldEnd = new Date(slot.endAt);
    const oldDateStr = `${oldStart.getUTCFullYear()}-${String(
      oldStart.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(oldStart.getUTCDate()).padStart(2, '0')}`;
    const oldStartTime = `${String(oldStart.getUTCHours()).padStart(2, '0')}:${String(
      oldStart.getUTCMinutes(),
    ).padStart(2, '0')}`;
    const oldEndTime = `${String(oldEnd.getUTCHours()).padStart(2, '0')}:${String(
      oldEnd.getUTCMinutes(),
    ).padStart(2, '0')}`;

    const newDateStr = date || oldDateStr;
    const newStartTime = startTime || oldStartTime;
    const newEndTime = endTime || oldEndTime;

    let newStart;
    let newEnd;
    try {
      newStart = buildLocalDate(newDateStr, newStartTime);
      newEnd = buildLocalDate(newDateStr, newEndTime);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: `Invalid date/time: ${e.message}`,
      });
    }

    if (newStart >= newEnd) {
      return res.status(400).json({
        success: false,
        message: 'Start time must be before end time',
      });
    }

    if (new Date() >= newStart) {
      return res.status(400).json({
        success: false,
        message: 'Cannot move a slot into the past',
      });
    }

    const collision = await prisma.therapistAvailableTimeSlot.findFirst({
      where: {
        therapistId: therapist.id,
        id: { not: slotId },
        startAt: newStart,
        endAt: newEnd,
      },
    });
    if (collision) {
      return res.status(409).json({
        success: false,
        message: 'Another slot already exists at that time',
      });
    }

    const updated = await prisma.therapistAvailableTimeSlot.update({
      where: { id: slotId },
      data: {
        startAt: newStart,
        endAt: newEnd,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: updated,
      message: 'Time slot updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a time slot
 *
 * Règles métier :
 *   - Si des appointments scheduled/confirmed pointent vers ce slot → REFUS
 *   - Les appointments cancelled/completed/no_show sont automatiquement détachés
 *     par la FK `ON DELETE SET NULL` au niveau de la base de données
 *   - Le slot est supprimé en une seule opération
 *   - L'historique des rendez-vous est conservé
 */
const deleteTimeSlot = async (req, res, next) => {
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

    const { slotId } = req.params;

    const slot = await prisma.therapistAvailableTimeSlot.findUnique({
      where: { id: slotId },
      include: {
        appointment: {
          select: { status: true },
        },
      },
    });

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Time slot not found',
      });
    }

    if (slot.therapistId !== therapist.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - this slot does not belong to you',
      });
    }

    // Vérifier si un rendez-vous actif est lié → REFUS
    if (slot.appointment && ['scheduled', 'confirmed'].includes(slot.appointment.status)) {
      return res.status(400).json({
        success: false,
        message:
          'Impossible de supprimer ce créneau : un rendez-vous actif y est associé.',
      });
    }

    // Supprimer le créneau — la FK ON DELETE SET NULL détache
    // automatiquement tout rendez-vous terminal (cancelled/completed/no_show)
    await prisma.therapistAvailableTimeSlot.delete({
      where: { id: slotId },
    });

    res.json({
      success: true,
      message: 'Créneau supprimé avec succès. Les rendez-vous historiques sont conservés.',
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
  getAvailability,
  createTimeSlots,
  updateTimeSlot,
  deleteTimeSlot,
};