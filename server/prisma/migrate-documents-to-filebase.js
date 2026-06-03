/**
 * One-time migration script: Migrate legacy therapist.documents array
 * entries to the new Document model backed by Filebase storage.
 *
 * Usage: node prisma/migrate-documents-to-filebase.js
 *
 * This script is IDEMPOTENT — safe to run multiple times.
 * It skips Document records that already exist for a given objectKey.
 *
 * Prerequisites:
 * - FILEBASE_* environment variables must be set in .env
 * - The Document model must exist in the Prisma schema (run db push first)
 * - Source files must exist in server/uploads/
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// ─── Helpers ────────────────────────────────────────────────────────────

function detectMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const mimeMap = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * Extract original filename from a Multer stored filename.
 * Multer pattern: "fieldname-timestamp-random-originalname.ext"
 * e.g. "documents-1780409767367-748659692-4-BOUFATIS-Juba.pdf"
 * The original name starts after the 3rd dash-separated token.
 */
function extractOriginalName(multerFilename) {
  const parts = multerFilename.split('-');
  if (parts.length >= 4) {
    return parts.slice(3).join('-');
  }
  return multerFilename; // fallback
}

// ─── Main Migration Logic ───────────────────────────────────────────────

async function migrate() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Document Migration: Local Files → Filebase         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  // Lazy-import the storage service (needs env vars to be loaded)
  const { uploadFile } = await import('../src/services/storage.service.js');

  // 1. Find all therapists with legacy document paths
  const therapists = await prisma.therapist.findMany({
    where: {
      documents: { isEmpty: false },
    },
    select: {
      id: true,
      userId: true,
      documents: true,
    },
  });

  if (therapists.length === 0) {
    console.log('✓ No therapists with legacy documents found. Nothing to migrate.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${therapists.length} therapist(s) with legacy document entries.\n`);

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalMissing = 0;
  let totalErrors = 0;

  for (const therapist of therapists) {
    console.log(`── Therapist ${therapist.userId} ──`);

    for (const docPath of therapist.documents) {
      const filename = path.basename(docPath);
      const filePath = path.join(UPLOADS_DIR, filename);

      // Build the Filebase object key
      const objectKey = `documents/${therapist.userId}/${filename}`;

      // Check idempotency: skip if Document record already exists for this key
      const existing = await prisma.document.findFirst({
        where: { objectKey },
      });

      if (existing) {
        console.log(`  ⏭ SKIP  ${filename} (already migrated)`);
        totalSkipped++;
        continue;
      }

      // Check if the actual file exists on disk
      if (!fs.existsSync(filePath)) {
        console.log(`  ⚠ MISS  ${filename} (file not found on disk, creating placeholder record)`);

        await prisma.document.create({
          data: {
            ownerId: therapist.userId,
            ownerRole: 'therapist',
            originalName: extractOriginalName(filename),
            mimeType: detectMimeType(filename),
            fileSize: 0,
            objectKey,
            bucketName: process.env.FILEBASE_BUCKET || 'tassarutdocuments',
            storageProvider: 'filebase_missing',
            documentType: 'diploma',
            createdAt: new Date(),
          },
        });
        totalMissing++;
        continue;
      }

      // File exists — upload to Filebase and create Document record
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);
        const fileSizeKB = (stats.size / 1024).toFixed(1);

        console.log(`  ⬆ UPLD  ${filename} (${fileSizeKB} KB)`);

        await uploadFile(fileBuffer, objectKey, detectMimeType(filename));

        await prisma.document.create({
          data: {
            ownerId: therapist.userId,
            ownerRole: 'therapist',
            originalName: extractOriginalName(filename),
            mimeType: detectMimeType(filename),
            fileSize: stats.size,
            objectKey,
            bucketName: process.env.FILEBASE_BUCKET || 'tassarutdocuments',
            storageProvider: 'filebase',
            documentType: 'diploma',
            createdAt: stats.mtime || new Date(),
          },
        });

        console.log(`  ✅ DONE  ${filename}`);
        totalMigrated++;
      } catch (error) {
        console.error(`  ❌ ERROR  ${filename}: ${error.message}`);
        totalErrors++;
      }
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────
  console.log();
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                    Migration Summary                    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Successfully migrated: ${String(totalMigrated).padStart(4)}                    ║`);
  console.log(`║  ⏭ Skipped (already existed): ${String(totalSkipped).padStart(4)}               ║`);
  console.log(`║  ⚠ Missing source files: ${String(totalMissing).padStart(4)}                  ║`);
  console.log(`║  ❌ Errors: ${String(totalErrors).padStart(4)}                           ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log('NOTE: The legacy therapist.documents array has NOT been modified.');
  console.log('After verifying the migration, you can remove the @ignore field');
  console.log('from the schema.prisma Therapist model.');
}

migrate()
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());