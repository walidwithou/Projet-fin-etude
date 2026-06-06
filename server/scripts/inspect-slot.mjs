// One-off DB inspection script — read-only.
// Goal: list every Appointment row that references a given slot id
// and show the slot's current state. Used to diagnose a UNIQUE
// constraint conflict during booking.
//
// Usage:
//   node scripts/inspect-slot.mjs <slotId>

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const slotId = process.argv[2];
if (!slotId) {
  console.error('Usage: node scripts/inspect-slot.mjs <slotId>');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  // 1) The slot itself (current isBooked, times, therapist)
  const slot = await prisma.therapistAvailableTimeSlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      isBooked: true,
      startAt: true,
      endAt: true,
      therapistId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log('=== SLOT ===');
  if (!slot) {
    console.log(`Slot ${slotId} NOT FOUND in therapist_available_timeslot.`);
  } else {
    console.log(JSON.stringify(slot, null, 2));
  }

  // 2) Every Appointment row that references the slot (any status, FK null or not)
  //    We intentionally include rows where therapistAvailableTimeSlotId === null
  //    only if the user provided a slot id and there are no rows. The query below
  //    is a positive match on the FK column.
  const appts = await prisma.appointment.findMany({
    where: { therapistAvailableTimeSlotId: slotId },
    select: {
      id: true,
      status: true,
      therapistAvailableTimeSlotId: true,
      scheduledAt: true,
      durationMinutes: true,
      type: true,
      cancelledAt: true,
      cancelledBy: true,
      createdAt: true,
      updatedAt: true,
      patientId: true,
      therapistId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n=== APPOINTMENTS REFERENCING THIS SLOT ===');
  console.log(`count = ${appts.length}`);
  for (const a of appts) {
    console.log(JSON.stringify(a, null, 2));
  }

  // 3) Sanity: the raw unique index. Use raw SQL to count rows with this FK value.
  const rawCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n
       FROM "appointment"
      WHERE "therapistAvailableTimeSlotId" = $1`,
    slotId,
  );
  console.log('\n=== RAW SQL COUNT (FK matches) ===');
  console.log(JSON.stringify(rawCount, null, 2));

  // 4) Status breakdown — useful to see if multiple rows somehow exist
  //    (should be 0 or 1 given the @unique constraint).
  const byStatus = appts.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});
  console.log('\n=== STATUS BREAKDOWN ===');
  console.log(JSON.stringify(byStatus, null, 2));
} catch (e) {
  console.error('ERROR:', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
