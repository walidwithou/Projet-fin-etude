/**
 * Database Seed Script
 * Populates lookup tables with questionnaire options
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with questionnaire options...');

  // Seed Consultation Modes
  const consultationModes = [
    { code: 'chat', label: 'Discussion par chat écrit' },
    { code: 'visio', label: 'Visioconférence' },
    { code: 'audio', label: 'Appel audio uniquement' },
    { code: 'presentiel', label: 'Présentiel' },
  ];

  for (const mode of consultationModes) {
    await prisma.consultationMode.upsert({
      where: { code: mode.code },
      update: { label: mode.label },
      create: mode,
    });
  }
  console.log('✓ Consultation modes seeded');

  // Seed Time Slots
  const timeSlots = [
    { code: 'matin', label: 'Matin (8h - 12h)' },
    { code: 'apres_midi', label: 'Après-midi (12h - 17h)' },
    { code: 'soiree', label: 'Soirée (après 17h)' },
    { code: 'weekend', label: 'Weekend (Vendredi / Samedi)' },
  ];

  for (const slot of timeSlots) {
    await prisma.timeSlot.upsert({
      where: { code: slot.code },
      update: { label: slot.label },
      create: slot,
    });
  }
  console.log('✓ Time slots seeded');

  // Seed Languages
  const languages = [
    { code: 'ar_darja', label: 'Arabe (Darja algérienne)' },
    { code: 'ar_fusha', label: 'Arabe classique (Fusha)' },
    { code: 'tamazight', label: 'Tamazight' },
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'Anglais' },
  ];

  for (const lang of languages) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: { label: lang.label },
      create: lang,
    });
  }
  console.log('✓ Languages seeded');

  // Seed Pathologies
  const pathologies = [
    { code: 'stress_anxiete', label: 'Stress ou anxiété' },
    { code: 'depression', label: 'Dépression ou manque de motivation' },
    { code: 'problemes_relationnels', label: 'Problèmes relationnels (famille, couple, amis)' },
    { code: 'deuil', label: 'Deuil ou perte d\'un proche' },
    { code: 'confiance_estime', label: 'Confiance en soi et estime de soi' },
    { code: 'traumatisme', label: 'Traumatisme ou évènement passé difficile' },
    { code: 'troubles_alimentaires', label: 'Troubles alimentaires' },
    { code: 'addictions', label: 'Addictions' },
    { code: 'troubles_sommeil', label: 'Troubles du sommeil' },
    { code: 'autre', label: 'Autre' },
  ];

  for (const path of pathologies) {
    await prisma.pathology.upsert({
      where: { code: path.code },
      update: { label: path.label },
      create: path,
    });
  }
  console.log('✓ Pathologies seeded');

  // Seed Public Types (target audiences for therapists)
  const publicTypes = [
    { code: 'enfants_adolescents', label: 'Enfants / Adolescents' },
    { code: 'adultes', label: 'Adultes' },
    { code: 'couples', label: 'Couples' },
    { code: 'personnes_agees', label: 'Personnes âgées' },
    { code: 'tous_publics', label: 'Tous publics' },
  ];

  for (const pub of publicTypes) {
    await prisma.publicType.upsert({
      where: { code: pub.code },
      update: { label: pub.label },
      create: pub,
    });
  }
  console.log('✓ Public types seeded');

  console.log('\n✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
