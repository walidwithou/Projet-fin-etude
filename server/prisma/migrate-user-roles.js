// Data Migration: Backfill user roles for existing users
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting user role backfill migration...');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      patient: { select: { id: true } },
      therapist: { select: { id: true } },
    },
  });

  console.log('Found ' + users.length + ' users to check.');

  let therapistCount = 0;
  let adminCount = 0;
  let patientCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    let newRole = null;

    if (user.email.endsWith('@tassarut.dz') || user.email === 'admin@tassarut.dz') {
      newRole = 'ADMIN';
      adminCount++;
    } else if (user.therapist) {
      newRole = 'THERAPIST';
      therapistCount++;
    } else {
      newRole = 'PATIENT';
      patientCount++;
    }

    if (user.role !== newRole) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: newRole },
      });
      console.log('  Updated ' + user.email + ': ' + user.role + ' -> ' + newRole);
    } else {
      skippedCount++;
    }
  }

  console.log('Migration Summary:');
  console.log('  Therapists: ' + therapistCount);
  console.log('  Admins:     ' + adminCount);
  console.log('  Patients:   ' + patientCount);
  console.log('  Unchanged:  ' + skippedCount);
  console.log('User role backfill completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
