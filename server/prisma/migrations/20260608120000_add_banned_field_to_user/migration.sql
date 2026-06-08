-- ============================================================
-- Migration: Add banned field to User model
--
-- Why:
--   Admin can now ban/unban users (patients and therapists).
--   The `banned` boolean field defaults to false and is checked
--   at authentication time to block banned users from logging in.
-- ============================================================

-- Add banned column to the user table
ALTER TABLE "user" ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false;