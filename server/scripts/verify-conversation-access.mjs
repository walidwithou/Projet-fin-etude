import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Get latest message
  const msg = await prisma.message.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { conversationId: true, senderId: true, receiverId: true }
  });

  // 2. Get patient ID from message
  const patientId = msg?.senderId.startsWith('c') ? msg.senderId : msg?.receiverId;
  
  // 3. Get therapist ID from message
  const therapistId = msg?.senderId.startsWith('2') ? msg.senderId : msg?.receiverId;

  // 4. Simulate patient request
  const patientConvId = `conv_${patientId}_${therapistId}`;
  
  // 5. Simulate therapist request
  const therapistConvId = `conv_${therapistId}_${patientId}`;

  console.log('=== COMPARAISON CONVERSATION ID ===');
  console.log('Base de données:', msg?.conversationId);
  console.log('Patient devrait demander:', patientConvId);
  console.log('Thérapeute devrait demander:', therapistConvId);
  console.log('Match patient:', patientConvId === msg?.conversationId);
  console.log('Match thérapeute:', therapistConvId === msg?.conversationId);
}

main().catch(console.error);