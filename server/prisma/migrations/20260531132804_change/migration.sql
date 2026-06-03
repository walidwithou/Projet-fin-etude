-- CreateEnum
CREATE TYPE "GenrePref" AS ENUM ('FEMME', 'HOMME', 'PEU_IMPORTE');

-- CreateEnum
CREATE TYPE "SensibilitePatient" AS ENUM ('OUI_IMPORTANT', 'NON_NECESSAIRE', 'NE_SAIS_PAS');

-- CreateEnum
CREATE TYPE "ExperiencePassee" AS ENUM ('OUI_POSITIVE', 'OUI_NON_SATISFAISANTE', 'NON_PREMIERE_FOIS', 'NE_SAIS_PAS');

-- CreateEnum
CREATE TYPE "AttentesTherapie" AS ENUM ('ECOUTE_ACTIVE', 'EXERCICES_OUTILS', 'COMPRENDRE_PASSE', 'NE_SAIS_PAS');

-- CreateEnum
CREATE TYPE "SensibiliteTherapeute" AS ENUM ('INTEGRE_DEMANDE', 'LAIQUE_NEUTRE', 'AUTRE');

-- CreateEnum
CREATE TYPE "ApprocheTherapeute" AS ENUM ('TCC', 'PSYCHANALYSE', 'HUMANISTE_GESTALT', 'INTEGRATIVE');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_mode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "consultation_mode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_slot" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "time_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathology" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "pathology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_type" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "public_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "wilaya" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "preferredLanguage" TEXT DEFAULT 'ar',
    "matchedTherapistId" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "genrePref" "GenrePref",
    "sensibilitePatient" "SensibilitePatient",
    "experiencePassee" "ExperiencePassee",
    "attentesTherapie" "AttentesTherapie",
    "questionnaire_data_raw" JSONB,

    CONSTRAINT "patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "licenseVerified" BOOLEAN NOT NULL DEFAULT false,
    "yearsOfExperience" INTEGER,
    "education" TEXT,
    "bio" TEXT,
    "profilePhotoUrl" TEXT,
    "hourlyRate" DECIMAL(10,2),
    "currency" TEXT DEFAULT 'DZD',
    "availability" JSONB,
    "acceptingNewPatients" BOOLEAN NOT NULL DEFAULT true,
    "rating" DECIMAL(3,2),
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sensibiliteTherapeute" "SensibiliteTherapeute",
    "approcheTherapeute" "ApprocheTherapeute",

    CONSTRAINT "therapist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_consultation_mode" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultationModeId" TEXT NOT NULL,

    CONSTRAINT "patient_consultation_mode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapist_consultation_mode" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "consultationModeId" TEXT NOT NULL,

    CONSTRAINT "therapist_consultation_mode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_time_slot" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "timeSlotId" TEXT NOT NULL,

    CONSTRAINT "patient_time_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapist_time_slot" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "timeSlotId" TEXT NOT NULL,

    CONSTRAINT "therapist_time_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_language" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,

    CONSTRAINT "patient_language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapist_language" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,

    CONSTRAINT "therapist_language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_pathology" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "pathologyId" TEXT NOT NULL,

    CONSTRAINT "patient_pathology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapist_pathology" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "pathologyId" TEXT NOT NULL,

    CONSTRAINT "therapist_pathology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapist_public_type" (
    "id" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "publicTypeId" TEXT NOT NULL,

    CONSTRAINT "therapist_public_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "type" TEXT NOT NULL DEFAULT 'video',
    "meetingUrl" TEXT,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_report" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "presentingIssues" TEXT,
    "sessionNotes" TEXT,
    "interventionsUsed" TEXT[],
    "progressAssessment" TEXT,
    "moodRating" INTEGER,
    "homeworkAssigned" TEXT,
    "nextSessionGoals" TEXT,
    "riskAssessment" TEXT,
    "isConfidential" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "actionUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_mode_code_key" ON "consultation_mode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "time_slot_code_key" ON "time_slot"("code");

-- CreateIndex
CREATE UNIQUE INDEX "language_code_key" ON "language"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pathology_code_key" ON "pathology"("code");

-- CreateIndex
CREATE UNIQUE INDEX "public_type_code_key" ON "public_type"("code");

-- CreateIndex
CREATE UNIQUE INDEX "patient_consultation_mode_patientId_consultationModeId_key" ON "patient_consultation_mode"("patientId", "consultationModeId");

-- CreateIndex
CREATE UNIQUE INDEX "therapist_consultation_mode_therapistId_consultationModeId_key" ON "therapist_consultation_mode"("therapistId", "consultationModeId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_time_slot_patientId_timeSlotId_key" ON "patient_time_slot"("patientId", "timeSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "therapist_time_slot_therapistId_timeSlotId_key" ON "therapist_time_slot"("therapistId", "timeSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_language_patientId_languageId_key" ON "patient_language"("patientId", "languageId");

-- CreateIndex
CREATE UNIQUE INDEX "therapist_language_therapistId_languageId_key" ON "therapist_language"("therapistId", "languageId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_pathology_patientId_pathologyId_key" ON "patient_pathology"("patientId", "pathologyId");

-- CreateIndex
CREATE UNIQUE INDEX "therapist_pathology_therapistId_pathologyId_key" ON "therapist_pathology"("therapistId", "pathologyId");

-- CreateIndex
CREATE UNIQUE INDEX "therapist_public_type_therapistId_publicTypeId_key" ON "therapist_public_type"("therapistId", "publicTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "session_report_appointmentId_key" ON "session_report"("appointmentId");

-- CreateIndex
CREATE INDEX "message_conversationId_idx" ON "message"("conversationId");

-- CreateIndex
CREATE INDEX "message_senderId_idx" ON "message"("senderId");

-- CreateIndex
CREATE INDEX "message_receiverId_idx" ON "message"("receiverId");

-- CreateIndex
CREATE INDEX "notification_userId_idx" ON "notification"("userId");

-- CreateIndex
CREATE INDEX "audit_log_actorId_idx" ON "audit_log"("actorId");

-- CreateIndex
CREATE INDEX "audit_log_resourceType_idx" ON "audit_log"("resourceType");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consultation_mode" ADD CONSTRAINT "patient_consultation_mode_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consultation_mode" ADD CONSTRAINT "patient_consultation_mode_consultationModeId_fkey" FOREIGN KEY ("consultationModeId") REFERENCES "consultation_mode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_consultation_mode" ADD CONSTRAINT "therapist_consultation_mode_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_consultation_mode" ADD CONSTRAINT "therapist_consultation_mode_consultationModeId_fkey" FOREIGN KEY ("consultationModeId") REFERENCES "consultation_mode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_time_slot" ADD CONSTRAINT "patient_time_slot_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_time_slot" ADD CONSTRAINT "patient_time_slot_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_time_slot" ADD CONSTRAINT "therapist_time_slot_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_time_slot" ADD CONSTRAINT "therapist_time_slot_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_language" ADD CONSTRAINT "patient_language_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_language" ADD CONSTRAINT "patient_language_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "language"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_language" ADD CONSTRAINT "therapist_language_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_language" ADD CONSTRAINT "therapist_language_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "language"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_pathology" ADD CONSTRAINT "patient_pathology_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_pathology" ADD CONSTRAINT "patient_pathology_pathologyId_fkey" FOREIGN KEY ("pathologyId") REFERENCES "pathology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_pathology" ADD CONSTRAINT "therapist_pathology_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_pathology" ADD CONSTRAINT "therapist_pathology_pathologyId_fkey" FOREIGN KEY ("pathologyId") REFERENCES "pathology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_public_type" ADD CONSTRAINT "therapist_public_type_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_public_type" ADD CONSTRAINT "therapist_public_type_publicTypeId_fkey" FOREIGN KEY ("publicTypeId") REFERENCES "public_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "therapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_report" ADD CONSTRAINT "session_report_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_report" ADD CONSTRAINT "session_report_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "therapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_report" ADD CONSTRAINT "session_report_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_patient_fkey" FOREIGN KEY ("senderId") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_therapist_fkey" FOREIGN KEY ("receiverId") REFERENCES "therapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "therapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
