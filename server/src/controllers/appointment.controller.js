import { prisma } from '../db/prisma.js';
import crypto from 'crypto';

const generateId = () => crypto.randomUUID();

// ---------------------------------------------------------------------------
// Timezone-agnostic date helpers
// ---------------------------------------------------------------------------
// All helpers construct dates via Date.UTC so the interpreted time (e.g. 13:00)
// is stored identically in the database. No hidden timezone offset is applied.
// Without this, building via "new Date(y, m-1, d, h, min)" uses the server's
// local timezone (UTC+1 for Africa/Algiers), causing the database to store
// {h-1}:{min} UTC, which introduces a 1-hour shift relative to the UI.

const buildLocalDate = (dateStr, timeStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = (timeStr || '00:00').split(':').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0, 0));
};

/**
 * Build a Date for the start (00:00:00.000) of a YYYY-MM-DD day,
 * stored as UTC to match the Date.UTC convention above.
 */
const startOfLocalDay = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
};

/**
 * Build a Date for the end (23:59:59.999) of a YYYY-MM-DD day,
 * stored as UTC to match the Date.UTC convention above.
 */
const endOfLocalDay = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 23, 59, 59, 999));
};

/**
 * Create a new appointment
 * Business rules:
 * 1. Patient must have a currentTherapistid set (by select-therapist)
 * 2. Patient can only have one future active appointment (scheduled/confirmed)
 * 3. Must use a TherapistAvailableTimeSlot that is not booked
 * 4. No time overlap with existing appointments for the same therapist
 */
const create = async (req, res, next) => {
  try {
    const { therapistId, scheduledAt, durationMinutes, type, notes, therapistAvailableTimeSlotId } = req.body;

    if (!therapistId || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'Therapist ID and scheduled time are required',
      });
    }

    if (!therapistAvailableTimeSlotId) {
      return res.status(400).json({
        success: false,
        message: 'A valid time slot ID is required',
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

    // Patient must have selected a therapist first
    if (!patient.currentTherapistid) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez d\'abord sélectionner un thérapeute avant de réserver.',
      });
    }

    // Check if patient already has a future active appointment
    const now = new Date();
    const existingActiveAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        status: { in: ['scheduled', 'confirmed'] },
        scheduledAt: { gte: now },
      },
    });

    if (existingActiveAppointment) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà un rendez-vous programmé.',
      });
    }

    // Verify therapist exists
    const therapist = await prisma.therapist.findUnique({
      where: { id: therapistId },
    });

    if (!therapist || therapist.verificationStatus !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Therapist is not available',
      });
    }

    // Verify the time slot exists, belongs to the therapist, and is not booked
    const timeSlot = await prisma.therapistAvailableTimeSlot.findUnique({
      where: { id: therapistAvailableTimeSlotId },
    });

    if (!timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Time slot not found',
      });
    }

    if (timeSlot.therapistId !== therapistId) {
      return res.status(400).json({
        success: false,
        message: 'Time slot does not belong to this therapist',
      });
    }

    if (timeSlot.isBooked) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is already booked',
      });
    }

    if (new Date(timeSlot.startAt) < now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book a time slot in the past',
      });
    }

    // Use the slot's startAt as the SINGLE source of truth for
    // the appointment time.
    const scheduledDate = new Date(timeSlot.startAt);
    const slotEnd = new Date(timeSlot.endAt);
    const duration = durationMinutes || Math.max(
      1,
      Math.round((slotEnd.getTime() - scheduledDate.getTime()) / 60000),
    );
    const endTime = new Date(scheduledDate.getTime() + duration * 60000);

    // Check for conflicting appointments (time overlap for the same therapist)
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
        message: 'This time slot is not available.',
      });
    }

    // Mark the time slot as booked
    await prisma.therapistAvailableTimeSlot.update({
      where: { id: therapistAvailableTimeSlotId },
      data: { isBooked: true },
    });

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        id: generateId(),
        patientId: patient.id,
        therapistId,
        therapistAvailableTimeSlotId,
        scheduledAt: scheduledDate,
        durationMinutes: duration,
        type: type || 'video',
        notes,
        status: 'scheduled',
      },
      include: {
        therapist: {
          include: {
            user: { select: { name: true } },
          },
        },
        patient: {
          include: {
            user: { select: { name: true } },
          },
        },
        therapistAvailableTimeSlot: true,
      },
    });

    // Create notification for therapist
    await prisma.notification.create({
      data: {
        id: generateId(),
        userId: therapist.userId,
        type: 'appointment_new',
        title: 'Nouvelle demande de rendez-vous',
        message: `Un patient a réservé une séance le ${scheduledDate.toLocaleDateString('fr-FR')} à ${scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        actionUrl: `/appointments/${appointment.id}`,
        metadata: { appointmentId: appointment.id },
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
        therapist: {
          include: {
            user: { select: { name: true } },
          },
        },
        patient: {
          include: {
            user: { select: { name: true } },
          },
        },
        appointmentOutcome: true,
        therapistAvailableTimeSlot: true,
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
 * Allowed transitions:
 *   scheduled  → confirmed, cancelled
 *   confirmed  → completed, cancelled, no_show
 *   completed  → (terminal)
 *   cancelled  → (terminal)
 *   no_show    → (terminal)
 *
 * Slot synchronization rules:
 *   cancelled / no_show → isBooked = false (slot freed)
 *   completed           → isBooked = false (slot freed)
 *   confirmed           → isBooked stays true
 *
 * currentTherapistId rules (BUG 4 FIX):
 *   NEVER reset currentTherapistId on cancel/no_show/complete.
 *
 * Notification rules (refus / annulation):
 *   scheduled → cancelled = "Demande refusée"      (type: appointment_refused)
 *   confirmed → cancelled = "Rendez-vous annulé"    (type: appointment_cancelled)
 *   → confirmed            = "Rendez-vous confirmé" (type: appointment_confirmed)
 *
 * The patient receives a context-rich notification that includes the
 * appointment date, time, and therapist name, and is rendered by the
 * new "Notifications" tab in the patient dashboard.
 */
const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Only allow official statuses
    const validStatuses = ['confirmed', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        therapist: {
          include: { user: { select: { name: true } } },
        },
        patient: true,
        therapistAvailableTimeSlot: true,
      },
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

    // Validate state transitions
    const currentStatus = appointment.status;
    const allowedTransitions = {
      scheduled: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled', 'no_show'],
      completed: [],
      cancelled: [],
      no_show: [],
    };

    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${currentStatus}' to '${status}'`,
      });
    }

    // -- SLOT SYNCHRONIZATION (BUG 2 FIX) -- wrapped in a single transaction
    // For terminal states, we must (a) clear the FK on the appointment so the
    // UNIQUE index releases the slot, and (b) flip the slot's soft-lock back
    // to isBooked = false. Doing these in a single transaction guarantees
    // that a partial failure can never leave an orphan FK pointing at a
    // freed slot (the exact bug we just fixed for `cancel()`).
    const isTerminal = ['cancelled', 'no_show', 'completed'].includes(status);
    const slotId = appointment.therapistAvailableTimeSlotId;

    const updated = await prisma.$transaction(async (tx) => {
      const updateData = {
        status,
        updatedAt: new Date(),
      };

      // 1 + 2. Nullify the FK for terminal states to release UNIQUE
      if (isTerminal) {
        updateData.therapistAvailableTimeSlotId = null;
      }

      if (status === 'cancelled') {
        updateData.cancelledAt = new Date();
        updateData.cancelledBy = req.user.id;
      }

      // 1 + 2. Update the appointment
      const apptUpdate = await tx.appointment.update({
        where: { id },
        data: updateData,
      });

      // 3. Free the slot's soft-lock (terminal states only)
      if (isTerminal && slotId) {
        await tx.therapistAvailableTimeSlot.update({
          where: { id: slotId },
          data: { isBooked: false },
        });
      }

      // When confirmed, ensure currentTherapistId is set
      if (status === 'confirmed') {
        await tx.patient.update({
          where: { id: appointment.patientId },
          data: {
            currentTherapistid: appointment.therapistId,
            updatedAt: new Date(),
          },
        });
      }

      return apptUpdate;
    });


    // -- NOTIFICATION --
    // Build a context-rich notification for the patient. The type, title and
    // message are chosen based on the state transition so the patient UI can
    // render "Demande refusée" and "Rendez-vous annulé" with different colors
    // and copy.
    //
    //   scheduled → cancelled : refus
    //   confirmed → cancelled : annulation (rendez-vous déjà confirmé)
    //   → confirmed           : confirmation
    //   → completed / no_show : bilan
    const therapistName = appointment.therapist?.user?.name || 'votre thérapeute';
    const apptDate = new Date(appointment.scheduledAt);
    const formattedDate = apptDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    });
    const formattedTime = apptDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let notificationType = 'appointment_update';
    let notificationTitle = 'Rendez-vous mis à jour';
    let notificationMessage = '';

    if (status === 'cancelled') {
      if (currentStatus === 'scheduled') {
        // Refus du thérapeute : la demande n'a pas été acceptée.
        notificationType = 'appointment_refused';
        notificationTitle = 'Demande refusée';
        notificationMessage =
          `Votre demande de rendez-vous du ${formattedDate} à ${formattedTime} ` +
          `avec ${therapistName} n'a pas été acceptée. ` +
          `Vous pouvez sélectionner un autre créneau.`;
      } else {
        // Annulation d'un rendez-vous déjà confirmé.
        notificationType = 'appointment_cancelled';
        notificationTitle = 'Rendez-vous annulé';
        notificationMessage =
          `Votre rendez-vous du ${formattedDate} à ${formattedTime} ` +
          `avec ${therapistName} a été annulé. ` +
          `Veuillez réserver un nouveau créneau.`;
      }
    } else if (status === 'confirmed') {
      notificationType = 'appointment_confirmed';
      notificationTitle = 'Rendez-vous confirmé';
      notificationMessage =
        `Votre rendez-vous du ${formattedDate} à ${formattedTime} ` +
        `avec ${therapistName} a été confirmé.`;
    } else if (status === 'completed') {
      notificationType = 'appointment_completed';
      notificationTitle = 'Séance terminée';
      notificationMessage =
        `Votre séance du ${formattedDate} à ${formattedTime} ` +
        `avec ${therapistName} a été marquée comme terminée.`;
    } else if (status === 'no_show') {
      notificationType = 'appointment_no_show';
      notificationTitle = 'Absence enregistrée';
      notificationMessage =
        `Vous avez été marqué(e) comme absent(e) à la séance du ${formattedDate} ` +
        `à ${formattedTime} avec ${therapistName}.`;
    } else {
      notificationMessage = `Le statut de votre rendez-vous est passé à : ${status}`;
    }

    await prisma.notification.create({
      data: {
        id: generateId(),
        userId: appointment.patient.userId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        actionUrl: `/appointments/${id}`,
        metadata: {
          appointmentId: id,
          status,
          fromStatus: currentStatus,
        },
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
 * BUG 4 FIX: currentTherapistId is NEVER reset here.
 */
const cancel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        therapist: { include: { user: { select: { name: true } } } },
        patient: true,
        therapistAvailableTimeSlot: true,
      },
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

    // Capture the status BEFORE the transaction so we can distinguish
    // "refus" (scheduled -> cancelled) from "annulation" (confirmed -> cancelled)
    // when the therapist is the one cancelling.
    const previousStatus = appointment.status;

    // -------------------------------------------------------------------------
    // Atomic cancellation: appointment + slot commit together
    // -------------------------------------------------------------------------
    // BUG FIX: previously the slot was updated first, then the appointment
    // separately, with no transaction wrapping both. If the second step
    // failed (or the column was NOT NULL at the time) we were left with an
    // orphan cancelled appointment whose therapistAvailableTimeSlotId still
    // occupied the UNIQUE index, blocking re-booking of the slot.
    //
    // We now perform both writes inside a single Prisma transaction with the
    // required order:
    //   1. Appointment.status = 'cancelled'
    //   2. Appointment.therapistAvailableTimeSlotId = null  (releases UNIQUE)
    //   3. Slot.isBooked = false                              (soft-lock freed)
    // If any step fails, the whole transaction rolls back and the slot stays
    // attached to the still-active appointment, which is the correct state.
    const slotId = appointment.therapistAvailableTimeSlotId;
    const updated = await prisma.$transaction(async (tx) => {
      // 1 + 2. Update the appointment: status -> cancelled, clear the FK
      const apptUpdate = await tx.appointment.update({
        where: { id },
        data: {
          status: 'cancelled',
          therapistAvailableTimeSlotId: null,
          cancelledAt: new Date(),
          cancelledBy: req.user.id,
          notes: reason || appointment.notes,
          updatedAt: new Date(),
        },
      });

      // 3. Free the slot's soft-lock (only if there was one)
      if (slotId) {
        await tx.therapistAvailableTimeSlot.update({
          where: { id: slotId },
          data: { isBooked: false },
        });
      }

      return apptUpdate;
    });

    // Notify the other party (outside the transaction so a notification
    // failure doesn't roll back the cancellation).
    //
    // When the patient cancels, the therapist is notified with a generic
    // "Le patient a annulé" message.
    //
    // When the therapist cancels, the patient is notified with a context-rich
    // notification that distinguishes:
    //   - previousStatus === 'scheduled' : refus ("Demande refusée")
    //   - previousStatus === 'confirmed' : annulation ("Rendez-vous annulé")
    const therapistName = appointment.therapist?.user?.name || 'votre thérapeute';
    const apptDate = new Date(appointment.scheduledAt);
    const formattedDate = apptDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    });
    const formattedTime = apptDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (isPatient) {
      await prisma.notification.create({
        data: {
          id: generateId(),
          userId: appointment.therapist.userId,
          type: 'appointment_cancelled',
          title: 'Rendez-vous annulé',
          message: `Le patient a annulé le rendez-vous du ${formattedDate} à ${formattedTime}.`,
          actionUrl: `/appointments/${id}`,
          metadata: { appointmentId: id, cancelledBy: 'patient' },
        },
      });
    } else {
      // Therapist (or admin) cancelled — notify the patient with the
      // appropriate copy depending on whether this was a refus or a
      // confirmed-appointment cancellation.
      let type;
      let title;
      let message;

      if (previousStatus === 'scheduled') {
        type = 'appointment_refused';
        title = 'Demande refusée';
        message =
          `Votre demande de rendez-vous du ${formattedDate} à ${formattedTime} ` +
          `avec ${therapistName} n'a pas été acceptée. ` +
          `Vous pouvez sélectionner un autre créneau.`;
      } else {
        type = 'appointment_cancelled';
        title = 'Rendez-vous annulé';
        message =
          `Votre rendez-vous du ${formattedDate} à ${formattedTime} ` +
          `avec ${therapistName} a été annulé. ` +
          `Veuillez réserver un nouveau créneau.`;
      }

      await prisma.notification.create({
        data: {
          id: generateId(),
          userId: appointment.patient.userId,
          type,
          title,
          message,
          actionUrl: `/appointments/${id}`,
          metadata: {
            appointmentId: id,
            cancelledBy: 'therapist',
            fromStatus: previousStatus,
          },
        },
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
 * Reschedule appointment
 */
const reschedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scheduledAt, therapistAvailableTimeSlotId } = req.body;


    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'New scheduled time is required',
      });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        therapist: true,
        patient: true,
        therapistAvailableTimeSlot: true,
      },
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

    // If a new time slot is provided, validate and swap
    if (therapistAvailableTimeSlotId && therapistAvailableTimeSlotId !== appointment.therapistAvailableTimeSlotId) {
      const newTimeSlot = await prisma.therapistAvailableTimeSlot.findUnique({
        where: { id: therapistAvailableTimeSlotId },
      });

      if (!newTimeSlot) {
        return res.status(400).json({
          success: false,
          message: 'New time slot not found',
        });
      }

      if (newTimeSlot.isBooked) {
        return res.status(400).json({
          success: false,
          message: 'New time slot is already booked',
        });
      }

      // Free old slot, book new slot
      if (appointment.therapistAvailableTimeSlotId) {
        await prisma.therapistAvailableTimeSlot.update({
          where: { id: appointment.therapistAvailableTimeSlotId },
          data: { isBooked: false },
        });
      }

      await prisma.therapistAvailableTimeSlot.update({
        where: { id: therapistAvailableTimeSlotId },
        data: { isBooked: true },
      });
    }

    const newDate = new Date(scheduledAt);
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt: newDate,
        ...(therapistAvailableTimeSlotId ? { therapistAvailableTimeSlotId } : {}),
        status: 'scheduled',
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
        title: 'Rendez-vous reprogrammé',
        message: `Le rendez-vous a été reprogrammé au ${newDate.toLocaleDateString('fr-FR')} à ${newDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
        actionUrl: `/appointments/${id}`,
        metadata: { appointmentId: id },
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
 * Get available slots for a therapist for a given day.
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

    let dateStr;
    if (date) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        dateStr = date;
      } else {
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid date parameter',
          });
        }
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${dd}`;
      }
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${dd}`;
    }

    const startOfDay = startOfLocalDay(dateStr);
    const endOfDay = endOfLocalDay(dateStr);

    const availableSlots = await prisma.therapistAvailableTimeSlot.findMany({
      where: {
        therapistId,
        isBooked: false,
        startAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { startAt: 'asc' },
    });

    // Filter out past slots
    const nowDate = new Date();
    const futureSlots = availableSlots.filter(
      (slot) => new Date(slot.startAt) > nowDate,
    );

    res.json({
      success: true,
      data: futureSlots.map((slot) => ({
        id: slot.id,
        startAt: slot.startAt,
        endAt: slot.endAt,
        isBooked: slot.isBooked,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create appointment outcome (session report) for an appointment
 *
 * BUG 1 FIX: Free the slot when marking as completed.
 * BUG 2 FIX: Clear the appointment FK too, inside the same transaction,
 *   so the UNIQUE index releases the slot.
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
      include: {
        therapist: true,
        patient: true,
        therapistAvailableTimeSlot: true,
      },
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

    // -------------------------------------------------------------------------
    // Atomic completion: outcome + appointment status + slot release commit
    // together, in the required order:
    //   1. Create AppointmentOutcome
    //   2. Appointment.status = 'completed'
    //   3. Appointment.therapistAvailableTimeSlotId = null  (releases UNIQUE)
    //   4. Slot.isBooked = false                              (soft-lock freed)
    // Previously the FK was NOT nulled on completion, leaving a completed
    // appointment that still occupied the UNIQUE index on the slot.
    // -------------------------------------------------------------------------
    const slotId = appointment.therapistAvailableTimeSlotId;
    const outcome = await prisma.$transaction(async (tx) => {
      // 1. Create the outcome
      const created = await tx.appointmentOutcome.create({
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

      // 2 + 3. Mark appointment completed AND clear the FK
      await tx.appointment.update({
        where: { id },
        data: {
          status: 'completed',
          therapistAvailableTimeSlotId: null,
          updatedAt: new Date(),
        },
      });

      // 4. Free the slot's soft-lock
      if (slotId) {
        await tx.therapistAvailableTimeSlot.update({
          where: { id: slotId },
          data: { isBooked: false },
        });
      }

      return created;
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
          therapist: {
            include: {
              user: { select: { name: true } },
            },
          },
          patient: {
            include: {
              user: { select: { name: true } },
            },
          },
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