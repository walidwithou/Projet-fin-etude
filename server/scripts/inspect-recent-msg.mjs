// Script pour inspecter les messages récents (post-Socket.IO)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== COLONNES DE LA TABLE ===');
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'message' ORDER BY ordinal_position`
  );
  console.table(cols);

  console.log('\n=== 5 DERNIERS MESSAGES (TOUTES COLONNES) ===');
  const msgs = await prisma.$queryRawUnsafe(
    `SELECT id, "senderId", "receiverId", "roomId", content, "messageType", "isRead", "createdAt" FROM message ORDER BY "createdAt" DESC LIMIT 5`
  );
  for (const m of msgs) {
    console.log({
      id: m.id.substring(0,12),
      senderId: m.senderId.substring(0,12),
      receiverId: m.receiverId.substring(0,12),
      roomId: m.roomId || '(NULL)',
      content: (m.content || '').substring(0,50),
      messageType: m.messageType,
      isRead: m.isRead,
      createdAt: m.createdAt.toISOString?.() || m.createdAt,
    });
  }

  console.log('\n=== MESSAGES AVEC roomId NULL ===');
  const nullRoom = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as count FROM message WHERE "roomId" IS NULL`
  );
  console.log('Messages sans roomId:', nullRoom[0]?.count || 0);

  console.log('\n=== MESSAGES AVEC roomId NON NULL ===');
  const notNullRoom = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as count FROM message WHERE "roomId" IS NOT NULL`
  );
  console.log('Messages avec roomId:', notNullRoom[0]?.count || 0);

  console.log('\n=== ROOMID DES 3 DERNIERS ===');
  const recent = await prisma.$queryRawUnsafe(
    `SELECT id, "roomId", "senderId", "receiverId", "createdAt" FROM message ORDER BY "createdAt" DESC LIMIT 3`
  );
  for (const r of recent) {
    console.log(`id=${r.id.substring(0,12)} roomId="${r.roomId || 'NULL'}" sender=${r.senderId.substring(0,12)} receiver=${r.receiverId.substring(0,12)}`);
  }

  // Identifier les utilisateurs pour vérifier les conversations
  console.log('\n=== VÉRIFICATION DES CONVERSATIONS ===');
  const rooms = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT "roomId" FROM message WHERE "roomId" IS NOT NULL ORDER BY "roomId"`
  );
  console.log('Conversations distinctes (roomId):', rooms.length);
  for (const r of rooms) {
    const count = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM message WHERE "roomId" = $1`, [r.roomId]
    );
    console.log(`  ${r.roomId} → ${count[0]?.cnt || 0} messages`);
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message||e); process.exit(1); });