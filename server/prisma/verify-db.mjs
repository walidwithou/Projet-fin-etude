// Diagnostic script: test the Neon connection exactly as Prisma does.
// Run with: node verify-db.mjs
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL;
const safeUrl = url ? url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***REDACTED***$2') : '(unset)';
console.log('--- Neon connection diagnostic ---');
console.log('Node version :', process.version);
console.log('DATABASE_URL :', safeUrl);

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: { db: { url } },
});

const start = Date.now();
try {
  const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
  console.log('SUCCESS in', Date.now() - start, 'ms ->', rows);
} catch (err) {
  console.error('FAILED in', Date.now() - start, 'ms');
  console.error('  name   :', err.name);
  console.error('  code   :', err.code);
  console.error('  message:', err.message);
  if (err.cause) {
    console.error('  cause  :', err.cause.message);
    if (err.cause.code) console.error('  cause.code:', err.cause.code);
  }
} finally {
  await prisma.$disconnect();
}
