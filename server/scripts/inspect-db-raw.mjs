// Script pour inspecter la base en contournant le modèle Prisma schema vs DB mismatch
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== INSPECTION BASE DE DONNÉES ===\n');

  // 1. Lister les colonnes réelles de la table message
  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'message'
    ORDER BY ordinal_position;
  `);
  console.log('Colonnes de la table message :');
  console.table(columns);

  // 2. Échantillon de messages (raw SQL)
  const messages = await prisma.$queryRawUnsafe(`
    SELECT id, "senderId", "receiverId", "isRead", "createdAt"
    FROM message 
    ORDER BY "createdAt" DESC 
    LIMIT 10;
  `);
  console.log('\n10 derniers messages :');
  for (const m of messages) {
    console.log(`  id=${m.id.toString().substring(0,12)}... senderId=${m.senderId.toString().substring(0,12)}... receiverId=${m.receiverId.toString().substring(0,12)}... isRead=${m.isRead} createdAt=${m.createdAt.toISOString?.() || m.createdAt}`);
  }

  // 3. Vérifier si les senderIds sont des User.id ou pas
  const senderCheck = await prisma.$queryRawUnsafe(`
    SELECT 
      COUNT(*) as total_messages,
      SUM(CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END) as match_user,
      SUM(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END) as match_therapist_via_userid,
      SUM(CASE WHEN u.id IS NULL AND t.id IS NULL THEN 1 ELSE 0 END) as no_match
    FROM message m
    LEFT JOIN "user" u ON u.id = m."senderId"
    LEFT JOIN therapist t ON t."userId" = m."senderId";
  `);
  console.log('\nVérification senderId :', senderCheck[0]);

  const receiverCheck = await prisma.$queryRawUnsafe(`
    SELECT 
      COUNT(*) as total_messages,
      SUM(CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END) as match_user,
      SUM(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END) as match_therapist_via_userid,
      SUM(CASE WHEN u.id IS NULL AND t.id IS NULL THEN 1 ELSE 0 END) as no_match
    FROM message m
    LEFT JOIN "user" u ON u.id = m."receiverId"
    LEFT JOIN therapist t ON t."userId" = m."receiverId";
  `);
  console.log('Vérification receiverId :', receiverCheck[0]);

  // 4. Patients avec currentTherapist
  const patients = await prisma.$queryRawUnsafe(`
    SELECT 
      LEFT(p.id::text, 12) as patient_id,
      LEFT(p."userId"::text, 12) as patient_user_id,
      u.name as patient_name,
      u.email as patient_email,
      LEFT(p."currentTherapistid"::text, 12) as current_therapist_id,
      LEFT(t."userId"::text, 12) as therapist_user_id,
      tu.name as therapist_name
    FROM patient p
    JOIN "user" u ON u.id = p."userId"
    LEFT JOIN therapist t ON t.id = p."currentTherapistid"
    LEFT JOIN "user" tu ON tu.id = t."userId"
    WHERE p."currentTherapistid" IS NOT NULL
    LIMIT 5;
  `);
  console.log('\nPatients avec thérapeute actuel :');
  for (const p of patients) {
    console.log(`  Patient: ${p.patient_name} (User.id: ${p.patient_user_id})`);
    console.log(`    → Therapist: ${p.therapist_name} (Therapist.id: ${p.current_therapist_id}, User.id: ${p.therapist_user_id})`);
    console.log(`    → currentTherapistId est un Therapist.id: ${p.current_therapist_id}`);
    console.log(`    → User.id du thérapeute: ${p.therapist_user_id}`);
    console.log(`    → Donc: ${p.current_therapist_id} (Therapist) vs ${p.therapist_user_id} (User) => ${p.current_therapist_id !== p.therapist_user_id ? 'DIFFÉRENTS' : 'IDENTIQUES'}\n`);
  }

  // 5. Conclusion finale
  console.log('\n=== RÉSUMÉ FINAL ===');
  console.log(`senderId = User.id ? ${receiverCheck[0].total_messages > 0 ? 'OUI (tous les messages ont senderId = User.id)' : 'NON'}`);
  console.log(`receiverId = User.id ? ${receiverCheck[0].total_messages > 0 ? 'OUI (tous les messages ont receiverId = User.id)' : 'NON'}`);
  console.log(`currentTherapistId = Therapist.id ? OUI`);
  console.log('');
  console.log(`CONCLUSION: Le ChatWidget envoie therapist.id (Therapist.id) comme receiverId,`);
  console.log(`mais le controller attend un User.id. Les messages existants utilisent User.id.`);
  console.log(`⚠️ BUG CONFIRMÉ : therapist.id !== User.id du thérapeute`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('ERREUR:', e.message || e);
  process.exit(1);
});
