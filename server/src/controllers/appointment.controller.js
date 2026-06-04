import { prisma } from '../db/prisma.js';
import crypto from 'crypto';

const generateId = () => crypto.randomUUID();

/**
 * Create a new appointment
 */
const create = async (req, res, next) => {
  try {
    const { therapistId, scheduledAt, durationMinutes, type, notes } = req.body;

    if (!therapistId || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'Therapist ID and scheduled time are required',
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

    // Verify therapist exists and is available
    const therapist = await prisma.therapist.findUnique({
      where: { id: therapistId },
    });

    if (!therapist || therapist.verificationStatus !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Therapist is not available',
      });
    }

    // Check for conflicting appointments
    const scheduledDate = new Date(scheduledAt);
    const endTime = new Date(scheduledDate.getTime() + (durationMinutes || 60) * 60000);

    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        therapistId,
        status: { in: ['scheduled', 'confirmed'] },
        scheduledAt: {
          gte: scheduledDate,
          lt: endTime,
        },
      },
    });

    if (conflictingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is not available',
      });
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        id: generateId(),
        patientId: patient.id,
        therapistId,
        scheduledAt: scheduledDate,
        durationMinutes: durationMinutes || 60,
        type: type || 'video',
        notes,
        status: 'scheduled',
      },
      include: {
        therapist: true,
        patient: true,
      },
    });

    // Create notification for therapist
    await prisma.notification.create({
      data: {
        id: generateId(),
        userId: therapist.userId,
        type: 'appointment_new',
        title: 'New Appointment',
        message: `You have a new appointment scheduled for ${scheduledDate.toLocaleString()}`,
        actionUrl: `/appointments/${appointment.id}`,
      },
    });

    res.status(201).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get appointment by ID
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        therapist: true,
        patient: true,
        appointmentOutcome: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Check access rights
    if (req.user.role === 'patient' && appointment.patient.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    if (req.user.role === 'therapist' && appointment.therapist.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update appointment status
 */
const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['confirmed', 'in_progress', 'completed', 'no_show', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { therapist: true, patient: true },
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Verify therapist ownership
    if (req.user.role === 'therapist' && appointment.therapist.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    });

    // Notify patient of status change
    await prisma.notification.create({
      data: {
        id: generateId(),
        userId: appointment.patient.userId,
        type: 'appointment_update',
        title: 'Appointment Updated',
        message: `Your appointment status has been updated to: ${status}`,
        actionUrl: `/appointments/${id}`,
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

/**
 * Cancel appointment
 */
const cancel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { therapist: true, patient: true },
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Verify ownership
    const isPatient = req.user.role === 'patient' && appointment.patient.userId === req.user.id;
    const isTherapist = req.user.role === 'therapist' && appointment.therapist.userId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isTherapist && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: req.user.id,
        notes: reason || appointment.notes,
        updatedAt: new Date(),
      },
    });

    // Notify the other party
    const notifyUserId = isPatient ? appointment.therapist.userId : appointment.patient.userId;
    await prisma.notification.create({
      data: {
        id: generateId(),
        userId: notifyUserId,
        type: 'appointment_cancelled',
        title: 'Appointment Cancelled',
        message: `An appointment scheduled for ${appointment.scheduledAt.toLocaleString()} has been cancelled.`,
        actionUrl: `/appointments/${id}`,
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

/**
 * Reschedule appointment
 */
const reschedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'New scheduled time is required',
      });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { therapist: true, patient: true },
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Verify ownership
    const isPatient = req.user.role === 'patient' && appointment.patient.userId === req.user.id;
    const isTherapist = req.user.role === 'therapist' && appointment.therapist.userId === req.user.id;

    if (!isPatient && !isTherapist) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const newDate = new Date(scheduledAt);
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt: newDate,
        status: 'scheduled', // Reset to scheduled when rescheduled
        updatedAt: new Date(),
      },
    });

    // Notify the other party
    const notifyUserId = isPatient ? appointment.therapist.userId : appointment.patient.userId;
    await prisma.notification.create({
      data: {
        id: generateId(),
        userId: notifyUserId,
        type: 'appointment_rescheduled',
        title: 'Appointment Rescheduled',
        message: `An appointment has been rescheduled to ${newDate.toLocaleString()}.`,
        actionUrl: `/appointments/${id}`,
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

/**
 * Get available slots for a therapist
 */
const getAvailableSlots = async (req, res, next) => {
  try {
    const { therapistId } = req.params;
    const { date } = req.query;

    const therapist = await prisma.therapist.findUnique({
      where: { id: therapistId },
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found',
      });
    }

    // Get therapist's availability
    const availability = therapist.availability || {};
    const requestedDate = date ? new Date(date) : new Date();
    const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Get booked appointments for the date
    const startOfDay = new Date(requestedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(requestedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        therapistId,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ['scheduled', 'confirmed'] },
      },
      select: { scheduledAt: true, durationMinutes: true },
    });

    // Generate available slots based on availability and booked times
    const slots = [];
    const dayAvailability = availability[dayOfWeek] || [];

    for (const slot of dayAvailability) {
      const [startHour, startMin] = slot.start.split(':').map(Number);
      const [endHour, endMin] = slot.end.split(':').map(Number);

      let currentSlot = new Date(startOfDay);
      currentSlot.setHours(startHour, startMin, 0, 0);

      const slotEnd = new Date(startOfDay);
      slotEnd.setHours(endHour, endMin, 0, 0);

      while (currentSlot < slotEnd) {
        const isBooked = bookedAppointments.some((appt) => {
          const apptStart = new Date(appt.scheduledAt);
          const apptEnd = new Date(apptStart.getTime() + appt.durationMinutes * 60000);
          return currentSlot >= apptStart && currentSlot < apptEnd;
        });

        if (!isBooked && currentSlot > new Date()) {
          slots.push({
            start: new Date(currentSlot),
            end: new Date(currentSlot.getTime() + 60 * 60000),
          });
        }

        currentSlot = new Date(currentSlot.getTime() + 60 * 60000); // 1 hour slots
      }
    }

    res.json({
      success: true,
      data: slots,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create appointment outcome (session report) for an appointment
 * Uses the AppointmentOutcome model (the actual model name in the database)
 */
const createSessionReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      sessionNotes,
      interventionsUsed,
      progressAssessment,
      riskAssessment,
      isConfidential,
      rating,
      comment,
    } = req.body;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { therapist: true, patient: true },
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Verify therapist ownership
    if (appointment.therapist.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Check if outcome already exists
    const existingOutcome = await prisma.appointmentOutcome.findUnique({
      where: { appointmentId: id },
    });

    if (existingOutcome) {
      return res.status(400).json({
        success: false,
        message: 'Session report already exists for this appointment',
      });
    }

    const outcome = await prisma.appointmentOutcome.create({
      data: {
        appointmentId: id,
        sessionNotes,
        interventionsUsed: interventionsUsed || [],
        progressAssessment,
        riskAssessment,
        isConfidential: isConfidential !== false,
        rating: rating || null,
        comment: comment || null,
      },
    });

    // Update appointment status to completed
    await prisma.appointment.update({
      where: { id },
      data: { status: 'completed', updatedAt: new Date() },
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
 * Get appointment outcome (session report) for an appointment
 * Uses the AppointmentOutcome model
 */
const getSessionReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    const outcome = await prisma.appointmentOutcome.findUnique({
      where: { appointmentId: id },
      include: {
        appointment: {
          include: {
            therapist: {
              include: {
                user: { select: { name: true } },
              },
            },
            patient: true,
          },
        },
      },
    });

    if (!outcome) {
      return res.status(404).json({
        success: false,
        message: 'Session report not found',
      });
    }

    // Verify access
    if (req.user.role === 'patient' && outcome.appointment.patient.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    if (req.user.role === 'therapist' && outcome.appointment.therapist.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: outcome,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all appointments (admin only)
 */
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, from, to } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          therapist: true,
          patient: true,
        },
        skip,
        take: parseInt(limit),
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.appointment.count({ where }),
    ]);

    res.json({
      success: true,
      data: appointments,
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

export {
  create,
  getById,
  updateStatus,
  cancel,
  reschedule,
  getAvailableSlots,
  createSessionReport,
  getSessionReport,
  getAll,
};