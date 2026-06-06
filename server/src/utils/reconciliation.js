import { prisma } from '../db/prisma.js';

/**
 * runReconciliation
 *
 * Détecte et corrige automatiquement les incohérences entre
 * Appointment et TherapistAvailableTimeSlot.
 *
 * Vérifications :
 * 1. Appointment cancelled/completed/no_show avec slot encore isBooked = true
 * 2. Slot réservé sans aucun appointment actif (scheduled/confirmed)
 * 3. Appointment scheduled/confirmed sans slot réservé
 *
 * @returns {Promise<{fixed: number, details: string[]}>}
 */
export const runReconciliation = async () => {
  const details = [];
  let fixed = 0;

  // ── 1. Appointments terminés dont le slot est encore réservé ──
  const terminalAppointments = await prisma.appointment.findMany({
    where: {
      status: { in: ['cancelled', 'completed', 'no_show'] },
    },
    include: {
      therapistAvailableTimeSlot: true,
    },
  });

  for (const appt of terminalAppointments) {
    if (appt.therapistAvailableTimeSlot?.isBooked) {
      await prisma.therapistAvailableTimeSlot.update({
        where: { id: appt.therapistAvailableTimeSlotId },
        data: { isBooked: false },
      });
      details.push(
        `Correction #1: Appointment ${appt.id} (status=${appt.status}) — slot ${appt.therapistAvailableTimeSlotId} libéré`,
      );
      fixed++;
    }
  }

  // ── 2. Slots réservés sans aucun appointment actif ──
  const bookedSlots = await prisma.therapistAvailableTimeSlot.findMany({
    where: { isBooked: true },
  });

  for (const slot of bookedSlots) {
    // Cherche un appointment (scheduled ou confirmed) lié à ce slot
    const activeAppointment = await prisma.appointment.findFirst({
      where: {
        therapistAvailableTimeSlotId: slot.id,
        status: { in: ['scheduled', 'confirmed'] },
      },
    });

    if (!activeAppointment) {
      // Soit le slot n'a aucun appointment, soit seulement des
      // appointments terminés. Dans les deux cas, on libère.
      await prisma.therapistAvailableTimeSlot.update({
        where: { id: slot.id },
        data: { isBooked: false },
      });
      details.push(
        `Correction #2: Slot ${slot.id} réservé sans appointment actif — libéré`,
      );
      fixed++;
    }
  }

  // ── 3. Appointments actifs dont le slot n'est pas réservé ──
  const activeAppointments = await prisma.appointment.findMany({
    where: {
      status: { in: ['scheduled', 'confirmed'] },
    },
    include: {
      therapistAvailableTimeSlot: true,
    },
  });

  for (const appt of activeAppointments) {
    if (!appt.therapistAvailableTimeSlot?.isBooked) {
      if (appt.therapistAvailableTimeSlotId) {
        await prisma.therapistAvailableTimeSlot.update({
          where: { id: appt.therapistAvailableTimeSlotId },
          data: { isBooked: true },
        });
        details.push(
          `Correction #3: Appointment ${appt.id} (status=${appt.status}) — slot ${appt.therapistAvailableTimeSlotId} marqué réservé`,
        );
        fixed++;
      }
    }
  }

  return { fixed, details };
};