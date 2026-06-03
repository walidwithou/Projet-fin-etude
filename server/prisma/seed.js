/**
 * Tassarut — Database Seed Script
 * --------------------------------------------------------------------------
 * 1. Securely purges the relational tables in reverse-dependency order
 *    (inside a single prisma.$transaction) so that no foreign-key
 *    constraints are violated. Master reference tables (Pathology,
 *    Language, ConsultationMode, TimeSlot, PublicType) are NEVER deleted.
 * 2. Parses `seedUsers.json` and the matching `seedDocs/thdoc*.txt`
 *    certificate files.
 * 3. Pre-hashes every test user's password with bcryptjs (10 salt rounds)
 *    to stay compatible with the production auth middleware.
 * 4. Inserts 10 patients + 10 therapists with all polymorphic
 *    many-to-many relations + therapist verification documents.
 * 5. Asserts at the end that the DB contains exactly 10 of each.
 */

// ---------------------------------------------------------------------------
// ENV + service imports
// ---------------------------------------------------------------------------
// The storage service reads `process.env.FILEBASE_*` directly, so we must
// hydrate the .env BEFORE importing it.  This seed file is the only one we
// touch — controllers/routes/middlewares remain untouched (zero-regression).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Existing back-end upload service — re-used as-is, no modification.
//   uploadFile(buffer, objectKey, mimeType) → { objectKey, bucketName }
//   getSignedDownloadUrl(objectKey, opts)  → signed URL
import { uploadFile, getSignedDownloadUrl } from '../src/services/storage.service.js';

// ---------------------------------------------------------------------------
// Paths & constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// server/prisma/seed.js  →  repo root is one level up
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SEED_USERS_FILE = path.join(ROOT_DIR, 'seedUsers.json');
const SEED_DOCS_DIR = path.join(ROOT_DIR, 'seedDocs');

const BCRYPT_SALT_ROUNDS = 10;
const GENERIC_PASSWORD = 'TassarutSecure2026';

// The seed JSON mixes a few legacy/short codes that are not present in the
// production reference tables.  We normalise them here so the seed stays
// faithful to the DB master tables (which are immutable).
const TIMESLOT_CODE_MAP = {
  soiree: 'soiree',
  soirée: 'soiree',
  matin: 'matin',
  'apres_midi': 'apres_midi',
  'après_midi': 'apres_midi',
  apresmidi: 'apres_midi',
  weekend: 'weekend',
  'week-end': 'weekend',
};

const PUBLIC_TYPE_CODE_MAP = {
  enfants_adolescents: 'enfants_adolescents',
  enfants: 'enfants_adolescents',
  adolescents: 'enfants_adolescents',
  adultes: 'adultes',
  couples: 'couples',
  personnes_agees: 'personnes_agees',
  'personnes âgées': 'personnes_agees',
  tous_publics: 'tous_publics',
};

const PATHOLOGY_CODE_MAP = {
  stress_anxiete: 'stress_anxiete',
  depression: 'depression',
  burnout: 'burnout',
  phobie: 'phobie',
  deuil: 'deuil',
  addiction: 'addictions',
  addictions: 'addictions',
  trauma: 'traumatisme',
  traumatisme: 'traumatisme',
};

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const log = (msg) => console.log(msg);
const step = (n, msg) => log(`\n[${n}] ${msg}`);

const toId = () => crypto.randomUUID();

const parseDateOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date string: ${value}`);
  }
  return d;
};

const normalizeCode = (map, raw) => {
  if (raw === undefined || raw === null) return null;
  const key = String(raw).trim().toLowerCase();
  if (!map) return key; // no remap table → use the raw code as-is
  return map[key] ?? key; // fall back to the raw value so upsert can store it
};

const normalizeCodeArray = (map, arr) => {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((c) => normalizeCode(map, c)).filter(Boolean))];
};

/**
 * Resolve `seedDocs/thdoc{N}.txt` (or any case-variant) for a given
 * 0-based therapist index.  Throws if no matching file is found.
 */
const resolveDocFile = (index) => {
  if (!fs.existsSync(SEED_DOCS_DIR)) {
    throw new Error(`seedDocs directory not found at ${SEED_DOCS_DIR}`);
  }
  const entries = fs.readdirSync(SEED_DOCS_DIR);
  const re = new RegExp(`^thdoc${index + 1}\\.txt$`, 'i');
  const match = entries.find((name) => re.test(name));
  if (!match) {
    throw new Error(
      `Could not find thdoc${index + 1}.txt in ${SEED_DOCS_DIR} (found: ${entries.join(', ')})`,
    );
  }
  return path.join(SEED_DOCS_DIR, match);
};

// ---------------------------------------------------------------------------
// Teardown: reverse-dependency purge
// ---------------------------------------------------------------------------

const purgeTables = async () => {
  step(1, 'Purging relational tables in reverse-dependency order…');

  // The order matters: every child table is wiped BEFORE the parent it
  // points to.  Master reference tables are intentionally skipped.
  await prisma.$transaction(
    async (tx) => {
      // Polymorphic join tables
      await tx.patientConsultationMode.deleteMany();
      await tx.therapistConsultationMode.deleteMany();

      await tx.patientTimeSlot.deleteMany();
      await tx.therapistTimeSlot.deleteMany();
      await tx.therapistAvailableTimeSlot.deleteMany();

      await tx.patientLanguage.deleteMany();
      await tx.therapistLanguage.deleteMany();

      await tx.patientPathology.deleteMany();
      await tx.therapistPathology.deleteMany();

      await tx.therapistPublicType.deleteMany();
      await tx.document.deleteMany();

      // Operational tables
      await tx.appointmentOutcome.deleteMany();
      await tx.appointment.deleteMany();
      await tx.message.deleteMany();
      await tx.notification.deleteMany();

      // Profile tables (1-1 with User)
      await tx.patient.deleteMany();
      await tx.therapist.deleteMany();

      // Auth tables (depend on User)
      await tx.session.deleteMany();
      await tx.account.deleteMany();
      await tx.verification.deleteMany();

      // User last
      await tx.user.deleteMany();
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  log('   ✓ All relational tables purged (master references preserved)');
};

// ---------------------------------------------------------------------------
// Reference table backfill (additive only — never destructive)
// ---------------------------------------------------------------------------

/**
 * Upsert any pathology / publicType codes that appear in the seed but are
 * missing from the reference tables.  This keeps the existing master
 * data intact while ensuring the seed can be replayed safely.
 */
const backfillReferenceCodes = async (seed) => {
  step(2, 'Backfilling any missing reference codes (additive upsert)…');

  const requiredPathologies = new Set();
  const requiredPublicTypes = new Set();
  const requiredLanguages = new Set();

  for (const p of seed.patients ?? []) {
    (p.matching?.pathologies ?? []).forEach((c) =>
      requiredPathologies.add(normalizeCode(PATHOLOGY_CODE_MAP, c)),
    );
    (p.matching?.languages ?? []).forEach((c) => requiredLanguages.add(c));
  }
  for (const t of seed.therapists ?? []) {
    (t.matching?.pathologies ?? []).forEach((c) =>
      requiredPathologies.add(normalizeCode(PATHOLOGY_CODE_MAP, c)),
    );
    (t.matching?.publicTypes ?? []).forEach((c) =>
      requiredPublicTypes.add(normalizeCode(PUBLIC_TYPE_CODE_MAP, c)),
    );
    (t.matching?.languages ?? []).forEach((c) => requiredLanguages.add(c));
  }

  for (const code of requiredPathologies) {
    await prisma.pathology.upsert({
      where: { code },
      update: {},
      create: { code, label: code.replace(/_/g, ' ') },
    });
  }
  for (const code of requiredPublicTypes) {
    await prisma.publicType.upsert({
      where: { code },
      update: {},
      create: { code, label: code.replace(/_/g, ' ') },
    });
  }
  for (const code of requiredLanguages) {
    await prisma.language.upsert({
      where: { code },
      update: {},
      create: { code, label: code },
    });
  }

  log(
    `   ✓ Pathology (+${requiredPathologies.size}) PublicType (+${requiredPublicTypes.size}) Language (+${requiredLanguages.size}) upserted`,
  );
};

// ---------------------------------------------------------------------------
// Insertion: patients
// ---------------------------------------------------------------------------

const buildPatientCreate = (entry, passwordHash) => {
  const { user, profile, matching } = entry;

  return {
    id: toId(),
    name: user.name,
    email: user.email.toLowerCase(),
    emailVerified: true,
    role: 'PATIENT',
    accounts: {
      create: {
        id: toId(),
        accountId: '', // filled in after we know the userId
        providerId: 'credentials',
        password: passwordHash,
      },
    },
    patient: {
      create: {
        dateOfBirth: parseDateOrNull(profile.dateOfBirth),
        gender: profile.gender ?? null,
        phone: profile.phone ?? null,
        address: profile.address ?? null,
        wilaya: profile.wilaya ?? null,
        emergencyContact: profile.emergencyContact ?? null,
        emergencyPhone: profile.emergencyPhone ?? null,
        onboardingCompleted: true,
        questionnaireDataRaw: matching ?? {},
        genrePref: matching?.genrePref ?? null,
        sensibilitePatient: matching?.sensibilitePatient ?? null,
        experiencePassee: matching?.experiencePassee ?? null,
        attentesTherapie: matching?.attentesTherapie ?? null,
        preferredLanguage: 'ar',
        pathologies: {
          create: normalizeCodeArray(
            PATHOLOGY_CODE_MAP,
            matching?.pathologies,
          ).map((code) => ({ pathology: { connect: { code } } })),
        },
        languages: {
          create: normalizeCodeArray(null, matching?.languages).map(
            (code) => ({ language: { connect: { code } } }),
          ),
        },
        consultationModes: {
          create: normalizeCodeArray(null, matching?.consultationModes).map(
            (code) => ({ consultationMode: { connect: { code } } }),
          ),
        },
        timeSlots: {
          create: normalizeCodeArray(
            TIMESLOT_CODE_MAP,
            matching?.timeSlots,
          ).map((code) => ({ timeSlot: { connect: { code } } })),
        },
      },
    },
  };
};

const insertPatients = async (patients, passwordHash) => {
  step(3, `Inserting ${patients.length} patients…`);
  for (const [idx, entry] of patients.entries()) {
    const data = buildPatientCreate(entry, passwordHash);
    // `accountId` is the credentials-provider id (we mirror the user id);
    // `userId` is the FK and is auto-populated by Prisma from the parent
    // User row — do NOT set it here.
    const userId = data.id;
    data.accounts.create.accountId = userId;
    await prisma.user.create({ data });
    log(`   ✓ [patient ${String(idx + 1).padStart(2, '0')}] ${entry.user.email}`);
  }
};

// ---------------------------------------------------------------------------
// Insertion: therapists + documents
// ---------------------------------------------------------------------------

// Build the inner Therapist payload (the bit that goes inside
// `user.therapist.create`).  The polymorphic Document row is created
// in a separate step because Prisma does not allow nested writes for
// `Document` (its `ownerId` is a polymorphic scalar, not a typed FK).
const buildTherapistInner = (entry, matching) => ({
  gender: entry.profile?.gender ?? null,
  verificationStatus: 'verified', // ← pre-validated test profiles
  acceptingNewPatients: true,
  bio: `Profil de démonstration — ${entry.user.name}.`,
  hourlyRate: 3000,
  currency: 'DZD',
  sensibiliteTherapeute: matching?.sensibiliteTherapeute ?? null,
  approcheTherapeute: matching?.approcheTherapeute ?? null,
  pathologies: {
    create: normalizeCodeArray(PATHOLOGY_CODE_MAP, matching?.pathologies).map(
      (code) => ({ pathology: { connect: { code } } }),
    ),
  },
  languages: {
    create: normalizeCodeArray(null, matching?.languages).map((code) => ({
      language: { connect: { code } },
    })),
  },
  consultationModes: {
    create: normalizeCodeArray(null, matching?.consultationModes).map(
      (code) => ({ consultationMode: { connect: { code } } }),
    ),
  },
  publicTypes: {
    create: normalizeCodeArray(PUBLIC_TYPE_CODE_MAP, matching?.publicTypes).map(
      (code) => ({ publicType: { connect: { code } } }),
    ),
  },
  timeSlots: {
    create: normalizeCodeArray(TIMESLOT_CODE_MAP, matching?.timeSlots).map(
      (code) => ({ timeSlot: { connect: { code } } }),
    ),
  },
});

const buildTherapistUser = (entry, passwordHash) => {
  const { user, matching } = entry;
  const userId = toId();
  return {
    id: userId,
    name: user.name,
    email: user.email.toLowerCase(),
    emailVerified: true,
    role: 'THERAPIST',
    accounts: {
      create: {
        id: toId(),
        accountId: userId, // mirror the user id (credentials provider)
        providerId: 'credentials',
        password: passwordHash,
      },
    },
    therapist: {
      create: buildTherapistInner(entry, matching),
    },
  };
};

/**
 * Push the diploma file to Filebase via the existing back-end service,
 * then persist the returned metadata as a polymorphic `Document` row
 * attached to the therapist.  Returns the Document row + the signed URL
 * so the caller can log the upload.
 *
 * The flow mirrors `auth.controller.js#register`:
 *   1. fs.readFileSync the file as a Buffer.
 *   2. uploadFile(buffer, objectKey, mimeType) → { objectKey, bucketName }.
 *   3. prisma.document.create({ data: { …objectKey/bucketName… } }).
 */
const uploadTherapistDocument = async (therapist, docFile) => {
  const fileBuffer = fs.readFileSync(docFile);
  const originalName = path.basename(docFile);
  const fileSize = Buffer.byteLength(fileBuffer, 'utf8');
  const mimeType = 'text/plain';
  const objectKey = `seed/${therapist.userId}/${originalName}`;

  // 1) Real upload via the existing service (no monkey-patching, no copy).
  const uploaded = await uploadFile(fileBuffer, objectKey, mimeType);

  // 2) Build a signed URL for visibility (1 h expiry) — this proves the
  //    object is reachable from the Filebase endpoint and is the same
  //    call the front-end will use later to read the document.
  let signedUrl = null;
  try {
    signedUrl = await getSignedDownloadUrl(uploaded.objectKey, {
      bucket: uploaded.bucketName,
      filename: originalName,
      expiresIn: 3600,
    });
  } catch {
    // Signed URL is best-effort; the upload itself is what matters.
  }

  // 3) Persist the metadata.  Prisma does not allow nested writes for
  //    the polymorphic Document model, so we create the row directly.
  const document = await prisma.document.create({
    data: {
      ownerId: therapist.userId, // FK → therapist.userId (per schema)
      ownerRole: 'therapist',
      originalName,
      mimeType,
      fileSize,
      objectKey: uploaded.objectKey,
      bucketName: uploaded.bucketName,
      storageProvider: 'filebase', // ← real provider, not a stub
      documentType: 'diploma',
    },
  });

  return { document, signedUrl, objectKey: uploaded.objectKey, bucketName: uploaded.bucketName };
};

const insertTherapists = async (therapists, passwordHash) => {
  step(4, `Inserting ${therapists.length} therapists with their diploma documents…`);
  for (const [idx, entry] of therapists.entries()) {
    const docFile = resolveDocFile(idx);
    const data = buildTherapistUser(entry, passwordHash);

    await prisma.user.create({ data });
    // Re-fetch the therapist row to get its `userId` (which equals
    // data.id, but reading it back is safer than relying on the
    // in-memory copy).
    const therapist = await prisma.therapist.findFirst({
      where: { userId: data.id },
      select: { id: true, userId: true },
    });

    // Push the diploma to Filebase, then persist the Document row.
    const { signedUrl, objectKey, bucketName } = await uploadTherapistDocument(
      therapist,
      docFile,
    );

    log(
      `   ✓ [therapist ${String(idx + 1).padStart(2, '0')}] ${entry.user.email}  ←  ${path.basename(docFile)}\n` +
        `        bucket  : ${bucketName}\n` +
        `        key     : ${objectKey}\n` +
        `        signed  : ${signedUrl ?? '(signed-URL unavailable)'}`,
    );
  }
};

// ---------------------------------------------------------------------------
// Final assertion
// ---------------------------------------------------------------------------

const assertCounts = async () => {
  step(5, 'Verifying final database state…');
  const [patientCount, therapistCount, documentCount, userCount] =
    await Promise.all([
      prisma.patient.count(),
      prisma.therapist.count(),
      prisma.document.count(),
      prisma.user.count(),
    ]);

  log(`   • users       : ${userCount}`);
  log(`   • patients    : ${patientCount}`);
  log(`   • therapists  : ${therapistCount}`);
  log(`   • documents   : ${documentCount}`);

  if (patientCount !== 10 || therapistCount !== 10) {
    throw new Error(
      `Expected exactly 10 patients and 10 therapists, got ${patientCount} / ${therapistCount}.`,
    );
  }
  log('\n✅  Assertion passed: the database now holds 10 patients and 10 therapists.');
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  log('🌱  Tassarut — polymorphic seed starting…');

  if (!fs.existsSync(SEED_USERS_FILE)) {
    throw new Error(`seedUsers.json not found at ${SEED_USERS_FILE}`);
  }

  // 1. Hash a single generic password for every test account.
  log(`\n[0] Hashing generic password (bcryptjs, ${BCRYPT_SALT_ROUNDS} rounds)…`);
  const passwordHash = await bcrypt.hash(GENERIC_PASSWORD, BCRYPT_SALT_ROUNDS);
  log('   ✓ Password hashed');

  // 2. Read the seed JSON.
  const raw = fs.readFileSync(SEED_USERS_FILE, 'utf8');
  const seed = JSON.parse(raw);
  log(
    `   ✓ seedUsers.json parsed  (${seed.patients.length} patients, ${seed.therapists.length} therapists)`,
  );

  // 3. Purge, backfill, insert.
  await purgeTables();
  await backfillReferenceCodes(seed);
  await insertPatients(seed.patients, passwordHash);
  await insertTherapists(seed.therapists, passwordHash);

  // 4. Final verification.
  await assertCounts();
}

main()
  .then(() => {
    log('\n🎉  Seed completed successfully.');
  })
  .catch((err) => {
    console.error('\n❌  Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
