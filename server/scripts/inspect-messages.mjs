// Script temporaire pour inspecter les données réelles des messages
// Vérifie ce qui est stocké dans senderId / receiverId
// Usage : node scripts/inspect-messages.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== INSPECTION DES MESSAGES ===\n');

  // 1. Échantillon de messages (sans include pour éviter les confusions de relations)
  const messages = await prisma.message.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  console.log('--- 10 DERNIERS MESSAGES (données brutes) ---');
  for (const msg of messages) {
    // Vérifier quel type d'ID : si c'est un cuid (commence par 'c') ou uuid
    const senderType = msg.senderId.startsWith('c') ? 'cuid' : 'uuid';
    const receiverType = msg.receiverId.startsWith('c') ? 'cuid' : 'uuid';
    
    console.log(JSON.stringify({
      id: msg.id.substring(0, 12) + '...',
      senderId: msg.senderId.substring(0, 12) + '...',
      receiverId: msg.receiverId.substring(0, 12) + '...',
      isRead: msg.isRead,
      createdAt: msg.createdAt.toISOString(),
    }));
  }

  // 2. Vérifier si les senderId/receiverId existent dans User ou Therapist
  console.log('\n--- VÉRIFICATION DES IDs DANS LES TABLES ---');
  
  const allMsgIds = await prisma.message.findMany({
    select: { senderId: true, receiverId: true },
  });

  const uniqueSenderIds = [...new Set(allMsgIds.map(m => m.senderId))];
  const uniqueReceiverIds = [...new Set(allMsgIds.map(m => m.receiverId))];

  console.log(`Nombre total de messages : ${allMsgIds.length}`);
  console.log(`SenderId uniques : ${uniqueSenderIds.length}`);
  console.log(`ReceiverId uniques : ${uniqueReceiverIds.length}`);

  // Test : est-ce que senderId = User.id ?
  let senderUserMatch = 0;
  let senderTherapistMatch = 0;
  
  for (const sid of uniqueSenderIds.slice(0, 10)) {
    const user = await prisma.user.findUnique({ where: { id: sid }, select: { id: true, role: true, name: true } });
    const therapist = await prisma.therapist.findFirst({ where: { userId: sid }, select: { id: true, userId: true } });
    
    if (user) {
      senderUserMatch++;
      console.log(`[sender] ${sid.substring(0, 12)}... → User(${user.role}) ${user.name}`);
    } else if (therapist) {
      senderTherapistMatch++;
      console.log(`[sender] ${sid.substring(0, 12)}... → Therapist(userId match)`);
    } else {
      console.log(`[sender] ${sid.substring(0, 12)}... → INCONNU`);
    }
  }

  let receiverUserMatch = 0;
  let receiverTherapistMatch = 0;
  
  for (const rid of uniqueReceiverIds.slice(0, 10)) {
    const user = await prisma.user.findUnique({ where: { id: rid }, select: { id: true, role: true, name: true } });
    const therapist = await prisma.therapist.findFirst({ where: { userId: rid }, select: { id: true, userId: true } });
    
    if (user) {
      receiverUserMatch++;
      console.log(`[receiver] ${rid.substring(0, 12)}... → User(${user.role}) ${user.name}`);
    } else if (therapist) {
      receiverTherapistMatch++;
      console.log(`[receiver] ${rid.substring(0, 12)}... → Therapist(userId match)`);
    } else {
      console.log(`[receiver] ${rid.substring(0, 12)}... → INCONNU`);
    }
  }

  // 3. Vérifier le lien Patient.currentTherapist
  console.log('\n--- PATIENTS AVEC CURRENT THERAPIST ---');
  const patients = await prisma.patient.findMany({
    where: { currentTherapistid: { not: null } },
    take: 3,
    include: {
      user: { select: { id: true, name: true, email: true } },
      currentTherapist: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  for (const p of patients) {
    console.log(`\nPatient: ${p.user.name}`);
    console.log(`  Patient.user.id (User): ${p.user.id}`);
    console.log(`  Patient.id (Patient)  : ${p.id}`);
    if (p.currentTherapist) {
      console.log(`  currentTherapist.id (Therapist): ${p.currentTherapist.id}`);
      console.log(`  currentTherapist.userId (User) : ${p.currentTherapist.userId}`);
      console.log(`  Patient.currentTherapistid     : ${p.currentTherapistid}`);
      // Vérifier : currentTherapistid === Therapist.id ?
      console.log(`  currentTherapistid === Therapist.id? ${p.currentTherapistid === p.currentTherapist.id}`);
    }
  }

  // 4. Vérifier le ChatWidget : quel therapist.id reçoit-il ?
  console.log('\n--- VÉRIFICATION DU FLUX CHATWIDGET ---');
  
  // Récupérer un patient avec son thérapeute pour voir les IDs
  const samplePatient = await prisma.patient.findFirst({
    where: { currentTherapistid: { not: null } },
    include: {
      user: { select: { id: true, name: true } },
      currentTherapist: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  
  if (samplePatient && samplePatient.currentTherapist) {
    console.log('\nFlux ChatWidget (patient → thérapeute) :');
    console.log(`  ChatWidget reçoit therapist = {`);
    console.log(`    id: "${samplePatient.currentTherapist.id}",`);
    console.log(`    userId: "${samplePatient.currentTherapist.userId}",`);
    console.log(`    name: "${samplePatient.currentTherapist.user.name}"`);
    console.log(`  }`);
    console.log(`  `);
    console.log(`  Appel REST actuel : POST /messages { receiverId: therapist.id }`);
    console.log(`  → receiverId = "${samplePatient.currentTherapist.id}" (Therapist.id)`);
    console.log(`  `);
    console.log(`  Ce que le controller attend : receiverId = User.id`);
    console.log(`  → req.user.id = "${samplePatient.user.id}" (User.id du patient)`);
    console.log(`  `);
    console.log(`  ⚠️ INCOHÉRENCE : therapist.id (Therapist) !== User.id du thérapeute`);
    console.log(`  ⚠️ ${samplePatient.currentTherapist.id} !== ${samplePatient.currentTherapist.userId}`);
    
    // Regarder dans la table Message si des messages existent
    const existingMsgs = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: samplePatient.user.id },
          { receiverId: samplePatient.user.id },
        ],
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
    
    if (existingMsgs.length > 0) {
      console.log(`\n  Messages existants pour ce patient (sender/receiver = User.id) :`);
      for (const m of existingMsgs) {
        console.log(`    senderId: ${m.senderId.substring(0, 12)}... → receiverId: ${m.receiverId.substring(0, 12)}...`);
      }
    } else {
      console.log(`\n  Aucun message existant pour ce patient.`);
    }
  }

  // 5. BONUS : vérifier si le ChatWidget utilise therapist.id ou therapist.userId
  console.log('\n=== RÉSUMÉ FINAL ===');
  console.log('senderId = User.id ?', senderUserMatch > 0 ? 'OUI' : 'NON');
  console.log('receiverId = User.id ?', receiverUserMatch > 0 ? 'OUI' : 'NON');
  console.log('currentTherapistId = Therapist.id ? OUI (attendu)');
  console.log(
    'Problème potentiel : ChatWidget utilise therapist.id (=Therapist.id) comme receiverId,\n' +
    'mais le controller attend un User.id.'
  );

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});