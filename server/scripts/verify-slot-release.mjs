// End-to-end verification for the booking/cancellation fix.
//
// Goal
// ----
// Reproduce the exact bug scenario, then prove it's fixed:
//
//   1. Create a fresh TherapistAvailableTimeSlot
//   2. Book it (mimic what `create()` does at the Prisma level: flip
//      isBooked = true and insert an Appointment whose
//      therapistAvailableTimeSlotId points at the slot)
//   3. Cancel the appointment by calling the REAL `cancel()` controller
//      function with mocked req/res/next (this exercises the new
//      transactional fix — no parallel re-implementation of the logic)
//   4. Assert: slot.isBooked === false AND the appointment's
//      therapistAvailableTimeSlotId === null
//   5. Re-book the same slot
//   6. Assert: a new appointment row was inserted successfully (this is
//      where the previous code crashed with a unique-constraint error)
//   7. Clean up everything we created
//
// If any assertion fails, the process exits with code 1.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import * as appointmentController from '../src/controllers/appointment.controller.js';

const prisma = new PrismaClient();
const newId = () => crypto.randomUUID();

const log = (...args) => console.log('[verify]', ...args);
const assert = (cond, msg) => {
  if (!cond) {
    log('ASSERT FAILED:', msg);
    throw new Error(msg);
  }
  log('  ✓', msg);
};

// -------------------------------------------------------------------------
// 0. Pick (or create) a therapist + patient pair to use for the test.
//    We re-use an existing pair from the real DB so we don't pollute it
//    with brand-new users. The therapist/patient from the diagnosed bug
//    are a known-good pair.
// -------------------------------------------------------------------------
log('Loading test fixtures (existing therapist + patient from bug report)…');
const THERAPIST_ID = 'cmpyozl0p002g12dorxqx6wp2';
const PATIENT_ID = 'cmpzjnzjj0007hco5s8um8omr';

const therapist = await prisma.therapist.findUnique({
  where: { id: THERAPIST_ID },
  include: { user: { select: { id: true } } },
});
const patient = await prisma.patient.findUnique({
  where: { id: PATIENT_ID },
});
assert(therapist, `Therapist ${THERAPIST_ID} exists`);
assert(patient, `Patient ${PATIENT_ID} exists`);
const therapistUserId = therapist.user.id;
const patientUserId = patient.userId;
log(`  therapist.userId = ${therapistUserId}`);
log(`  patient.userId   = ${patientUserId}`);

// -------------------------------------------------------------------------
// 1. Create a fresh slot, far in the future, so it never conflicts with
//    any real production data or with the business rules in `create()`
//    (no booking in the past, no time-window collision, etc.).
// -------------------------------------------------------------------------
log('Step 1: creating a fresh test slot…');
// Pick a timestamp 1 year in the future, on a clean hour boundary.
const futureDate = new Date();
futureDate.setUTCFullYear(futureDate.getUTCFullYear() + 1);
futureDate.setUTCHours(14, 0, 0, 0);
const slotEnd = new Date(futureDate);
slotEnd.setUTCHours(15, 0, 0, 0);

const slot = await prisma.therapistAvailableTimeSlot.create({
  data: {
    therapistId: THERAPIST_ID,
    startAt: futureDate,
    endAt: slotEnd,
    isBooked: false,
  },
});
log(`  slot id = ${slot.id}, startAt = ${slot.startAt.toISOString()}`);

// Cleanup helper: removes everything we created, in dependency order.
let firstApptId = null;
let secondApptId = null;
let firstOutcomeId = null;
const cleanup = async () => {
  log('Cleaning up test data…');
  try {
    if (firstOutcomeId) {
      await prisma.appointmentOutcome.deleteMany({ where: { id: firstOutcomeId } });
    }
    if (secondApptId) {
      await prisma.appointment.deleteMany({ where: { id: secondApptId } });
    }
    if (firstApptId) {
      await prisma.appointment.deleteMany({ where: { id: firstApptId } });
    }
    await prisma.therapistAvailableTimeSlot.deleteMany({ where: { id: slot.id } });
    log('  cleanup complete');
  } catch (e) {
    log('  cleanup error (non-fatal):', e.message);
  }
};

try {
  // -------------------------------------------------------------------------
  // 2. Book the slot — mimic the controller's create() flow at the Prisma
  //    level (slot.isBooked = true, then insert Appointment).
  //    We bypass the controller's auth + duplicate-check logic to keep
  //    this test focused on the slot/appointment interaction.
  // -------------------------------------------------------------------------
  log('Step 2: booking the slot (mimicking create())…');
  await prisma.therapistAvailableTimeSlot.update({
    where: { id: slot.id },
    data: { isBooked: true },
  });
  firstApptId = newId();
  const firstAppt = await prisma.appointment.create({
    data: {
      id: firstApptId,
      patientId: PATIENT_ID,
      therapistId: THERAPIST_ID,
      therapistAvailableTimeSlotId: slot.id,
      scheduledAt: slot.startAt,
      durationMinutes: 60,
      type: 'video',
      status: 'scheduled',
    },
  });
  log(`  appointment ${firstAppt.id} created, status=${firstAppt.status}, FK=${firstAppt.therapistAvailableTimeSlotId}`);

  // Sanity: slot is booked, exactly 1 appointment references it.
  let slotAfterBook = await prisma.therapistAvailableTimeSlot.findUnique({ where: { id: slot.id } });
  assert(slotAfterBook.isBooked === true, 'after booking, slot.isBooked === true');

  // -------------------------------------------------------------------------
  // 3. Cancel the appointment via the REAL `cancel()` controller function.
  //    We mock req/res/next to satisfy the function signature and to
  //    pretend the request came from the therapist (who owns the slot).
  // -------------------------------------------------------------------------
  log('Step 3: invoking the real cancel() controller function…');
  const req = {
    params: { id: firstApptId },
    body: { reason: 'verification test' },
    user: { id: therapistUserId, role: 'therapist' },
  };
  // Minimal mock of Express res: capture status and json payload.
  // Express defaults to 200 when res.json() is called without an explicit
  // res.status(); we emulate that here.
  let resStatus = 200;
  let resBody = null;
  const res = {
    status(code) { resStatus = code; return this; },
    json(payload) { resBody = payload; return this; },
  };
  // The controller calls next(err) on caught errors. We capture that.
  let nextError = null;
  const next = (err) => { nextError = err; };

  await appointmentController.cancel(req, res, next);
  if (nextError) {
    throw new Error(`cancel() called next(err): ${nextError.message}`);
  }
  log(`  cancel() returned status=${resStatus}, success=${resBody?.success}`);
  assert(resStatus === 200, 'cancel() returned HTTP 200');

  assert(resBody?.success === true, 'cancel() returned success=true');
  assert(resBody?.data?.status === 'cancelled', 'returned appointment status is cancelled');
  assert(resBody?.data?.therapistAvailableTimeSlotId === null,
    'returned appointment.therapistAvailableTimeSlotId === null (FK cleared)');

  // -------------------------------------------------------------------------
  // 4. Verify the DB state matches the new contract:
  //    - Appointment.therapistAvailableTimeSlotId === null
  //    - TherapistAvailableTimeSlot.isBooked === false
  //    - No other appointment row references the slot's id in the FK column
  // -------------------------------------------------------------------------
  log('Step 4: verifying DB state after cancel()…');
  const apptAfter = await prisma.appointment.findUnique({ where: { id: firstApptId } });
  assert(apptAfter.status === 'cancelled', 'appointment.status === cancelled');
  assert(apptAfter.therapistAvailableTimeSlotId === null,
    'appointment.therapistAvailableTimeSlotId === null  (UNIQUE index released)');
  assert(apptAfter.cancelledAt != null, 'appointment.cancelledAt is set');

  slotAfterBook = await prisma.therapistAvailableTimeSlot.findUnique({ where: { id: slot.id } });
  assert(slotAfterBook.isBooked === false, 'slot.isBooked === false  (soft-lock freed)');

  const refs = await prisma.appointment.count({
    where: { therapistAvailableTimeSlotId: slot.id },
  });
  assert(refs === 0, 'no Appointment row references the slot in its FK  (UNIQUE index free)');

  // -------------------------------------------------------------------------
  // 5. Re-book the same slot. This is the EXACT step that crashed with
  //    "Unique constraint failed on the fields: (therapistAvailableTimeSlotId)"
  //    before the fix. If the FK was not nulled, the create() would throw.
  // -------------------------------------------------------------------------
  log('Step 5: re-booking the same slot (the exact step that previously crashed)…');
  await prisma.therapistAvailableTimeSlot.update({
    where: { id: slot.id },
    data: { isBooked: true },
  });
  secondApptId = newId();
  let secondAppt;
  try {
    secondAppt = await prisma.appointment.create({
      data: {
        id: secondApptId,
        patientId: PATIENT_ID,
        therapistId: THERAPIST_ID,
        therapistAvailableTimeSlotId: slot.id,
        scheduledAt: slot.startAt,
        durationMinutes: 60,
        type: 'video',
        status: 'scheduled',
      },
    });
  } catch (e) {
    throw new Error(`Re-booking crashed: ${e.message}`);
  }
  log(`  second appointment ${secondAppt.id} created, status=${secondAppt.status}, FK=${secondAppt.therapistAvailableTimeSlotId}`);
  assert(secondAppt.status === 'scheduled', 'second appointment.status === scheduled');
  assert(secondAppt.therapistAvailableTimeSlotId === slot.id,
    'second appointment.therapistAvailableTimeSlotId === slot.id  (no UNIQUE constraint error)');

  // -------------------------------------------------------------------------
  // 6. Verify uniqueness: only 1 row can ever hold the FK. Defensive check
  //    that the constraint is still active (we shouldn't have weakened it).
  // -------------------------------------------------------------------------
  log('Step 6: defensive UNIQUE constraint check…');
  let dupFailed = false;
  try {
    await prisma.appointment.create({
      data: {
        id: newId(),
        patientId: PATIENT_ID,
        therapistId: THERAPIST_ID,
        therapistAvailableTimeSlotId: slot.id,
        scheduledAt: slot.startAt,
        durationMinutes: 60,
        type: 'video',
        status: 'scheduled',
      },
    });
  } catch (e) {
    dupFailed = true;
    log('  duplicate insert correctly rejected:', String(e.message).split('\n')[0]);
  }
  assert(dupFailed, 'a SECOND concurrent insert with the same FK is rejected by the UNIQUE constraint');

  // -------------------------------------------------------------------------
  // 7. Cleanup
  // -------------------------------------------------------------------------
  await cleanup();

  log('');
  log('=========================================');
  log('  ALL VERIFICATION STEPS PASSED');
  log('=========================================');
  log('Summary:');
  log('  • Booking created an Appointment with FK = slot.id  ✓');
  log('  • cancel() (real controller) returned 200 + success  ✓');
  log('  • Appointment.therapistAvailableTimeSlotId is NULL  ✓');
  log('  • Slot.isBooked is false                             ✓');
  log('  • No Appointment row references the slot             ✓');
  log('  • Re-booking the same slot succeeded                 ✓');
  log('  • UNIQUE constraint is still enforced                ✓');
} catch (e) {
  log('TEST FAILED:', e.message);
  await cleanup();
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
