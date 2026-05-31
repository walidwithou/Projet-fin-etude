import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  jsonb,
  date,
} from "drizzle-orm/pg-core";

// ============================================================================
// BETTER AUTH TABLES (Required for authentication)
// ============================================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// ============================================================================
// TASSARUT PLATFORM TABLES
// ============================================================================

/**
 * Patient Profile
 * Extends user with patient-specific information including questionnaire data
 * and matching preferences for the onboarding/matching workflow.
 */
export const patient = pgTable("patient", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  dateOfBirth: date("dateOfBirth"),
  gender: text("gender"),
  phone: text("phone"),
  address: text("address"),
  wilaya: text("wilaya"), // Algerian province
  emergencyContact: text("emergencyContact"),
  emergencyPhone: text("emergencyPhone"),
  preferredLanguage: text("preferredLanguage").default("ar"),
  questionnaireData: jsonb("questionnaireData"), // Stores onboarding questionnaire responses
  matchedTherapistId: text("matchedTherapistId"),
  onboardingCompleted: boolean("onboardingCompleted").default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

/**
 * Therapist Profile
 * Stores therapist credentials, specializations, availability,
 * and verification status for the matching and booking workflows.
 */
export const therapist = pgTable("therapist", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  licenseNumber: text("licenseNumber"),
  licenseVerified: boolean("licenseVerified").default(false),
  specializations: text("specializations").array(), // e.g., ['anxiety', 'depression', 'trauma']
  yearsOfExperience: integer("yearsOfExperience"),
  education: text("education"),
  bio: text("bio"),
  profilePhotoUrl: text("profilePhotoUrl"),
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }),
  currency: text("currency").default("DZD"), // Algerian Dinar
  availability: jsonb("availability"), // Weekly schedule JSON
  languages: text("languages").array(), // e.g., ['ar', 'fr', 'en']
  acceptingNewPatients: boolean("acceptingNewPatients").default(true),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  totalReviews: integer("totalReviews").default(0),
  verificationStatus: text("verificationStatus").default("pending"), // pending, verified, rejected
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

/**
 * Appointment
 * Manages booking between patients and therapists with
 * scheduling, status tracking, and cancellation handling.
 */
export const appointment = pgTable("appointment", {
  id: text("id").primaryKey(),
  patientId: text("patientId").notNull(),
  therapistId: text("therapistId").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  durationMinutes: integer("durationMinutes").default(60),
  status: text("status").default("scheduled"), // scheduled, confirmed, in_progress, completed, cancelled, no_show
  type: text("type").default("video"), // video, audio, chat
  meetingUrl: text("meetingUrl"),
  notes: text("notes"),
  cancelledAt: timestamp("cancelledAt"),
  cancelledBy: text("cancelledBy"),
  cancellationReason: text("cancellationReason"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

/**
 * Session Report
 * Clinical documentation for therapy sessions including
 * notes, interventions, progress assessment, and risk evaluation.
 */
export const sessionReport = pgTable("session_report", {
  id: text("id").primaryKey(),
  appointmentId: text("appointmentId").notNull(),
  therapistId: text("therapistId").notNull(),
  patientId: text("patientId").notNull(),
  sessionDate: timestamp("sessionDate").notNull(),
  presentingIssues: text("presentingIssues"),
  sessionNotes: text("sessionNotes"),
  interventionsUsed: text("interventionsUsed").array(),
  progressAssessment: text("progressAssessment"),
  moodRating: integer("moodRating"), // 1-10 scale
  homeworkAssigned: text("homeworkAssigned"),
  nextSessionGoals: text("nextSessionGoals"),
  riskAssessment: text("riskAssessment"),
  isConfidential: boolean("isConfidential").default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

/**
 * Message
 * Stores chat messages between patients and therapists
 * for the secure messaging feature.
 */
export const message = pgTable("message", {
  id: text("id").primaryKey(),
  senderId: text("senderId").notNull(),
  receiverId: text("receiverId").notNull(),
  conversationId: text("conversationId").notNull(),
  content: text("content").notNull(),
  messageType: text("messageType").default("text"), // text, file, image
  isRead: boolean("isRead").default(false),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/**
 * Notification
 * User notifications for appointments, messages,
 * system alerts, and other events.
 */
export const notification = pgTable("notification", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  type: text("type").notNull(), // appointment_reminder, message, system, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false),
  readAt: timestamp("readAt"),
  actionUrl: text("actionUrl"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/**
 * Review
 * Patient reviews and ratings for therapists
 * with optional anonymity.
 */
export const review = pgTable("review", {
  id: text("id").primaryKey(),
  patientId: text("patientId").notNull(),
  therapistId: text("therapistId").notNull(),
  appointmentId: text("appointmentId"),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  isAnonymous: boolean("isAnonymous").default(false),
  isVisible: boolean("isVisible").default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

/**
 * Audit Log
 * Tracks administrative actions and system events
 * for compliance and security auditing.
 */
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actorId").notNull(),
  actorRole: text("actorRole").notNull(), // patient, therapist, admin
  action: text("action").notNull(), // e.g., 'user.created', 'appointment.cancelled'
  resourceType: text("resourceType").notNull(), // e.g., 'user', 'appointment'
  resourceId: text("resourceId"),
  previousValue: jsonb("previousValue"),
  newValue: jsonb("newValue"),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Patient = typeof patient.$inferSelect;
export type NewPatient = typeof patient.$inferInsert;

export type Therapist = typeof therapist.$inferSelect;
export type NewTherapist = typeof therapist.$inferInsert;

export type Appointment = typeof appointment.$inferSelect;
export type NewAppointment = typeof appointment.$inferInsert;

export type SessionReport = typeof sessionReport.$inferSelect;
export type NewSessionReport = typeof sessionReport.$inferInsert;

export type Message = typeof message.$inferSelect;
export type NewMessage = typeof message.$inferInsert;

export type Notification = typeof notification.$inferSelect;
export type NewNotification = typeof notification.$inferInsert;

export type Review = typeof review.$inferSelect;
export type NewReview = typeof review.$inferInsert;

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
