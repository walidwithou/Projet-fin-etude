// Repair script for orphan FKs on cancelled appointments.
//
// Background
// ----------
// `Appointment.therapistAvailableTimeSlotId` is UNIQUE in Postgres. If a
// cancelled appointment keeps a non-null FK, it permanently occupies the
// unique index, and the slot can never be re-booked (the booking code does
// `prisma.appointment.create({ therapistAvailableTimeSlotId })` and crashes
// with a unique-constraint error). The application's `reconciliation` rule
// flips the slot's `isBooked = false` once the only appointment pointing to
// it is terminal, so the slot reappears as bookable, but the index stays
// occupied — that's the exact bug we just diagnosed.
//
// What this script does
// ---------------------
// 1. Counts every Appointment row with
//      status = 'cancelled' AND therapistAvailableTimeSlotId IS NOT NULL
// 2. Inside a single transaction, sets therapistAvailableTimeSlotId = NULL
//    for every one of them (preserving the row itself — we only release the
//    FK so the unique index frees up).
// 3. Also re-flips the corresponding slot(s) to isBooked = false to be safe
//    (idempotent — they should already be free if reconciliation has been
//    running, but doing it here means the script is self-contained).
// 4. Prints a summary: how many rows were repaired, by status, and the
//    resulting orphan count.
//
// Idempotent: running it twice is a no-op the second time (the WHERE clause
// matches nothing on the second run).
//
// Usage
// -----
//   node scripts/repair-orphan-fk.mjs

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const log = (...args) => console.log('[repair-orphan-fk]', ...args);

try {
  log('Counting orphan cancelled appointments…');
  const orphanCancelled = await prisma.appointment.findMany({
    where: {
      status: 'cancelled',
      therapistAvailableTimeSlotId: { not: null },
    },
    select: {
      id: true,
      therapistAvailableTimeSlotId: true,
      cancelledAt: true,
    },
    orderBy: { cancelledAt: 'asc' },
  });

  log(`Found ${orphanCancelled.length} cancelled appointment(s) still holding an FK.`);
  for (const a of orphanCancelled) {
    log(`  - ${a.id}  slot=${a.therapistAvailableTimeSlotId}  cancelledAt=${a.cancelledAt?.toISOString?.() ?? a.cancelledAt}`);
  }

  if (orphanCancelled.length === 0) {
    log('Nothing to repair. Database is clean.');
    process.exit(0);
  }

  // Build the set of slot ids we touched so we can flip them to isBooked=false
  // in the same transaction. (Dedup with a Set — multiple cancelled
  // appointments could point to the same slot in theory, though the unique
  // constraint should normally prevent that.)
  const slotIds = Array.from(
    new Set(orphanCancelled.map((a) => a.therapistAvailableTimeSlotId)),
  );

  log(`Repairing inside a single transaction (${orphanCancelled.length} appointments, ${slotIds.length} unique slot(s))…`);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Null the FK on every cancelled appointment.
    // We can't use a single updateMany with `where: { id: { in: ids } }` AND
    // a different FK value per row, but we CAN set them all to null at once
    // because the value is constant. That's a single UPDATE statement.
    const apptUpdate = await tx.appointment.updateMany({
      where: {
        id: { in: orphanCancelled.map((a) => a.id) },
        status: 'cancelled',
        therapistAvailableTimeSlotId: { not: null },
      },
      data: {
        therapistAvailableTimeSlotId: null,
        updatedAt: new Date(),
      },
    });

    // 2. Re-flip the touched slots to isBooked = false.
    // Idempotent: a slot already false stays false.
    const slotUpdate = await tx.therapistAvailableTimeSlot.updateMany({
      where: { id: { in: slotIds } },
      data: { isBooked: false, updatedAt: new Date() },
    });

    return { apptUpdate, slotUpdate };
  });

  log(`Repaired appointments: ${result.apptUpdate.count}`);
  log(`Slots re-flipped to isBooked=false: ${result.slotUpdate.count}`);

  // 3. Sanity check: re-count, should be 0.
  const stillOrphan = await prisma.appointment.count({
    where: {
      status: 'cancelled',
      therapistAvailableTimeSlotId: { not: null },
    },
  });
  log(`Post-repair orphan count: ${stillOrphan}  (expected 0)`);

  // 4. Bonus: also report orphan completed/no_show appointments (same root
  // cause can affect them too, since `createSessionReport` previously didn't
  // null the FK). We don't mutate them automatically — the user's spec was
  // specifically for `cancelled` — but the count is useful context.
  const orphanCompleted = await prisma.appointment.count({
    where: {
      status: 'completed',
      therapistAvailableTimeSlotId: { not: null },
    },
  });
  const orphanNoShow = await prisma.appointment.count({
    where: {
      status: 'no_show',
      therapistAvailableTimeSlotId: { not: null },
    },
  });
  log(`(For reference) orphan completed appointments: ${orphanCompleted}`);
  log(`(For reference) orphan no_show appointments:    ${orphanNoShow}`);

  if (stillOrphan === 0) {
    log('SUCCESS — orphan cancelled appointments cleared.');
  } else {
    log(`WARNING — ${stillOrphan} orphan row(s) still present.`);
    process.exitCode = 2;
  }
} catch (e) {
  console.error('[repair-orphan-fk] FAILED:', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
