import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Prisma client singleton
// ---------------------------------------------------------------------------
// In development, Next.js-style hot-reload (or `nodemon` restarts) creates
// a new PrismaClient on every reload, which leaks Postgres connections
// and eventually exhausts Neon's connection cap. Stash the client on
// `globalThis` so subsequent reloads reuse the same instance.

const globalForPrisma = globalThis;

const isDev = process.env.NODE_ENV !== 'production';

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ['error', 'warn'] : ['error'],
  });

if (isDev) {
  globalForPrisma.prisma = prisma;
}

// ---------------------------------------------------------------------------
// Startup connectivity probe
// ---------------------------------------------------------------------------
// Neon free-tier computes auto-suspend after ~5min of inactivity. The
// first connection after a suspend can take 5-30s. Without this probe
// the server would happily `listen()` on port 5000 and then return 500
// for the first login request that happens to land during a wake-up.
//
// We retry with a short backoff so a transient Neon wake-up doesn't
// crash the server at boot. If the database is genuinely unreachable
// (bad URL, suspended project, DNS outage, ...) we surface a clear
// error message instead of a PrismaClientInitializationError stack
// trace.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ping the database with `SELECT 1`. Returns the round-trip time in
 * milliseconds, or throws if the probe fails.
 */
export const pingDatabase = async () => {
  const start = Date.now();
  await prisma.$queryRaw`SELECT 1 AS ok`;
  return Date.now() - start;
};

/**
 * Probe the database with a few retries. Used at server boot so a
 * Neon cold-start doesn't prevent the app from starting.
 *
 *   startupDbProbe({ retries: 5, delayMs: 2000 })
 *
 * Total worst-case wait: ~5 * (connect_timeout + delay) ≈ 5 * 32s.
 * In practice the first attempt usually succeeds; we retry only to
 * absorb a cold start that is racing with the boot.
 */
export const startupDbProbe = async ({
  retries = 5,
  delayMs = 2000,
  label = 'startup',
} = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const ms = await pingDatabase();
      // eslint-disable-next-line no-console
      console.log(
        `[db] ${label} probe OK (attempt ${attempt}/${retries}, ${ms}ms)`,
      );
      return { ok: true, ms, attempts: attempt };
    } catch (err) {
      lastError = err;
      // eslint-disable-next-line no-console
      console.warn(
        `[db] ${label} probe failed (attempt ${attempt}/${retries}): ${err.message}`,
      );
      if (attempt < retries) await wait(delayMs);
    }
  }
  return { ok: false, error: lastError, attempts: retries };
};

/**
 * Translate a Prisma error into a short, user-facing message suitable
 * for a 500/503 response body. Keeps raw Prisma codes out of the API
 * surface (they leak schema details) and gives the frontend something
 * it can show the user ("database is starting up, try again").
 */
export const describeDbError = (err) => {
  if (!err) return 'Database error';
  const msg = String(err.message || err);

  // The exact wording Prisma uses for the "neon auto-suspend" symptom.
  if (/Can'?t reach database server/i.test(msg)) {
    return 'Database is temporarily unreachable. Please try again in a few seconds.';
  }
  if (/Timed out fetching a new connection/i.test(msg)) {
    return 'Database is under heavy load. Please try again in a few seconds.';
  }
  if (/P1001/i.test(msg) || /connection.*refused/i.test(msg)) {
    return 'Database connection was refused. Please try again in a few seconds.';
  }
  if (/P1002/i.test(msg) || /database.*timeout/i.test(msg)) {
    return 'Database timed out. Please try again in a few seconds.';
  }
  return 'Database error';
};

export { prisma };
