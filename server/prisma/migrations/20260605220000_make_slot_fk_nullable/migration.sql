-- ============================================================
-- Migration: Make therapistAvailableTimeSlotId nullable + ON DELETE SET NULL
--
-- Why:
--   When a therapist deletes a time slot, terminal appointments
--   (cancelled/completed/no_show) must keep their history but
--   lose the FK link to the deleted slot.  The previous FK was
--   ON DELETE RESTRICT, which blocked deletion entirely.
--
-- What this does:
--   1. Ensures the column is nullable (DROP NOT NULL) so that
--      setting it to NULL is allowed at the DB level.
--   2. Recreates the FK constraint with ON DELETE SET NULL so
--      that deleting the slot automatically nullifies the link
--      on any associated appointment row.
-- ============================================================

-- Step 1: Make the column nullable (idempotent via IF NOT NULL guard)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'appointment'
      AND column_name = 'therapistAvailableTimeSlotId'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "appointment" ALTER COLUMN "therapistAvailableTimeSlotId" DROP NOT NULL;
  END IF;
END $$;

-- Step 2: Drop the old FK (ON DELETE RESTRICT) and recreate with ON DELETE SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_therapistAvailableTimeSlotId_fkey') THEN
    ALTER TABLE "appointment" DROP CONSTRAINT "appointment_therapistAvailableTimeSlotId_fkey";
  END IF;
END $$;

ALTER TABLE "appointment" ADD CONSTRAINT "appointment_therapistAvailableTimeSlotId_fkey"
  FOREIGN KEY ("therapistAvailableTimeSlotId") REFERENCES "therapist_available_timeslot"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;