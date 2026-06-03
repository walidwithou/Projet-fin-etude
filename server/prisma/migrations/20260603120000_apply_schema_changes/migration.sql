-- ============================================================
-- Migration: Apply all schema changes from the updated prisma schema
-- Drop old tables, add new tables, update columns
-- All statements are idempotent (safe to re-run)
-- ============================================================

-- Drop tables that no longer exist in the schema
DROP TABLE IF EXISTS "review" CASCADE;
DROP TABLE IF EXISTS "session_report" CASCADE;

-- ============================================================
-- 1. Create therapist_available_timeslot table if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS "therapist_available_timeslot" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "therapist_available_timeslot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "therapist_available_timeslot_therapistId_idx" ON "therapist_available_timeslot"("therapistId");
CREATE INDEX IF NOT EXISTS "therapist_available_timeslot_startAt_endAt_idx" ON "therapist_available_timeslot"("startAt", "endAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'therapist_available_timeslot_therapistId_fkey') THEN
        ALTER TABLE "therapist_available_timeslot" ADD CONSTRAINT "therapist_available_timeslot_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================
-- 2. Remove old columns from therapist table
-- ============================================================
ALTER TABLE "therapist" DROP COLUMN IF EXISTS "documents",
                       DROP COLUMN IF EXISTS "licenseNumber",
                       DROP COLUMN IF EXISTS "licenseVerified",
                       DROP COLUMN IF EXISTS "yearsOfExperience",
                       DROP COLUMN IF EXISTS "education";

-- ============================================================
-- 3. Remove old columns from appointment table
-- ============================================================
ALTER TABLE "appointment" DROP COLUMN IF EXISTS "meetingUrl",
                          DROP COLUMN IF EXISTS "cancellationReason";

-- ============================================================
-- 4. Add therapistAvailableTimeSlotId column to appointment
-- ============================================================
ALTER TABLE "appointment" ADD COLUMN IF NOT EXISTS "therapistAvailableTimeSlotId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_therapistAvailableTimeSlotId_key" ON "appointment"("therapistAvailableTimeSlotId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_therapistAvailableTimeSlotId_fkey') THEN
        ALTER TABLE "appointment" ADD CONSTRAINT "appointment_therapistAvailableTimeSlotId_fkey" FOREIGN KEY ("therapistAvailableTimeSlotId") REFERENCES "therapist_available_timeslot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================
-- 5. Create Document table
-- ============================================================
CREATE TABLE IF NOT EXISTS "document" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL DEFAULT 'therapist',
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'filebase',
    "documentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_objectKey_key" ON "document"("objectKey");
CREATE INDEX IF NOT EXISTS "document_ownerId_ownerRole_idx" ON "document"("ownerId", "ownerRole");
CREATE INDEX IF NOT EXISTS "document_documentType_idx" ON "document"("documentType");
CREATE INDEX IF NOT EXISTS "document_createdAt_idx" ON "document"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_therapist_fkey') THEN
        ALTER TABLE "document" ADD CONSTRAINT "document_therapist_fkey" FOREIGN KEY ("ownerId") REFERENCES "therapist"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================
-- 6. Create AppointmentOutcome table
-- ============================================================
CREATE TABLE IF NOT EXISTS "appointment_outcome" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "sessionNotes" TEXT,
    "interventionsUsed" TEXT[],
    "progressAssessment" TEXT,
    "riskAssessment" TEXT,
    "isConfidential" BOOLEAN NOT NULL DEFAULT true,
    "rating" INTEGER,
    "comment" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "appointment_outcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_outcome_appointmentId_key" ON "appointment_outcome"("appointmentId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_outcome_appointmentId_fkey') THEN
        ALTER TABLE "appointment_outcome" ADD CONSTRAINT "appointment_outcome_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;