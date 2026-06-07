-- ============================================================
-- Migration: Add TherapistHistory model
--
-- Why:
--   When a patient changes therapist, we need to track the
--   history of assignments so past relationships are never lost.
--   This table stores each assignment with an optional
--   unassignedAt timestamp.
-- ============================================================

-- Create therapist_history table
CREATE TABLE "therapist_history" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "therapist_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "therapist_history_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "therapist_history_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX "therapist_history_patientId_idx" ON "therapist_history"("patientId");
CREATE INDEX "therapist_history_therapistId_idx" ON "therapist_history"("therapistId");