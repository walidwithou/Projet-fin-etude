-- Add currentTherapistid column to patient table
ALTER TABLE "patient" ADD COLUMN "currentTherapistid" TEXT;

-- Create index for the new column
CREATE INDEX "patient_currentTherapistid_idx" ON "patient"("currentTherapistid");

-- Add foreign key constraint
ALTER TABLE "patient" ADD CONSTRAINT "patient_currentTherapistid_fkey" FOREIGN KEY ("currentTherapistid") REFERENCES "therapist"("id") ON DELETE SET NULL ON UPDATE CASCADE;