/**
 * Migration Script: JSON to Relational Questionnaire Data
 * 
 * This script migrates existing JSON questionnaire data stored in patients
 * and therapists to the new normalized relational structure.
 * 
 * Run after applying the Prisma migration and seeding lookup tables.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mapping from JSON values to enum values
const GENRE_PREF_MAP = {
  'Une femme': 'FEMME',
  'femme': 'FEMME',
  'Un homme': 'HOMME',
  'homme': 'HOMME',
  'Peu importe': 'PEU_IMPORTE',
  'peu_importe': 'PEU_IMPORTE',
};

const SENSIBILITE_PATIENT_MAP = {
  'Oui, c\'est important pour moi': 'OUI_IMPORTANT',
  'oui_important': 'OUI_IMPORTANT',
  'Non, ce n\'est pas nécessaire': 'NON_NECESSAIRE',
  'non_necessaire': 'NON_NECESSAIRE',
  'Je ne sais pas': 'NE_SAIS_PAS',
  'ne_sais_pas': 'NE_SAIS_PAS',
};

const EXPERIENCE_PASSEE_MAP = {
  'Oui, j\'ai eu une expérience positive': 'OUI_POSITIVE',
  'oui_positive': 'OUI_POSITIVE',
  'Oui, mais l\'expérience n\'était pas satisfaisante': 'OUI_NON_SATISFAISANTE',
  'oui_non_satisfaisante': 'OUI_NON_SATISFAISANTE',
  'Non, c\'est ma première fois': 'NON_PREMIERE_FOIS',
  'non_premiere_fois': 'NON_PREMIERE_FOIS',
  'Je ne sais pas': 'NE_SAIS_PAS',
  'ne_sais_pas': 'NE_SAIS_PAS',
};

const ATTENTES_THERAPIE_MAP = {
  'Quelqu\'un qui m\'écoute activement sans trop intervenir': 'ECOUTE_ACTIVE',
  'ecoute_active': 'ECOUTE_ACTIVE',
  'Quelqu\'un qui me donne des exercices et des outils concrets': 'EXERCICES_OUTILS',
  'exercices_outils': 'EXERCICES_OUTILS',
  'Quelqu\'un qui m\'aide à comprendre mon passé en profondeur': 'COMPRENDRE_PASSE',
  'comprendre_passe': 'COMPRENDRE_PASSE',
  'Je ne sais pas encore': 'NE_SAIS_PAS',
  'ne_sais_pas': 'NE_SAIS_PAS',
};

const SENSIBILITE_THERAPEUTE_MAP = {
  'J\'intègre explicitement ces dimensions à la demande': 'INTEGRE_DEMANDE',
  'integre_demande': 'INTEGRE_DEMANDE',
  'Mon approche est strictement laïque et neutre': 'LAIQUE_NEUTRE',
  'laique_neutre': 'LAIQUE_NEUTRE',
  'Autre': 'AUTRE',
  'autre': 'AUTRE',
};

const APPROCHE_THERAPEUTE_MAP = {
  'TCC (Exercices et outils concrets)': 'TCC',
  'tcc': 'TCC',
  'Psychanalyse / Psychodynamique (Exploration du passé)': 'PSYCHANALYSE',
  'psychanalyse': 'PSYCHANALYSE',
  'Humaniste / Gestalt (Écoute active)': 'HUMANISTE_GESTALT',
  'humaniste_gestalt': 'HUMANISTE_GESTALT',
  'Approche intégrative (Mélange)': 'INTEGRATIVE',
  'integrative': 'INTEGRATIVE',
};

// Code mappings for multi-select options
const CONSULTATION_MODE_MAP = {
  'Visioconférence': 'visio',
  'visio': 'visio',
  'Appel audio uniquement': 'audio',
  'audio': 'audio',
  'Présentiel': 'presentiel',
  'presentiel': 'presentiel',
};

const TIME_SLOT_MAP = {
  'Matin (8h - 12h)': 'matin',
  'matin': 'matin',
  'Après-midi (12h - 17h)': 'apres_midi',
  'apres_midi': 'apres_midi',
  'Soirée (après 17h)': 'soiree',
  'soiree': 'soiree',
  'Weekend (Vendredi / Samedi)': 'weekend',
  'weekend': 'weekend',
};

const LANGUAGE_MAP = {
  'Arabe (Darja algérienne)': 'ar_darja',
  'ar_darja': 'ar_darja',
  'ar': 'ar_darja',
  'Arabe classique (Fusha)': 'ar_fusha',
  'ar_fusha': 'ar_fusha',
  'Tamazight': 'tamazight',
  'tamazight': 'tamazight',
  'ber': 'tamazight',
  'Français': 'fr',
  'fr': 'fr',
  'Anglais': 'en',
  'en': 'en',
};

const PATHOLOGY_MAP = {
  'Stress ou anxiété': 'stress_anxiete',
  'stress_anxiete': 'stress_anxiete',
  'anxiety': 'stress_anxiete',
  'stress': 'stress_anxiete',
  'Dépression ou manque de motivation': 'depression',
  'depression': 'depression',
  'Problèmes relationnels (famille, couple, amis)': 'problemes_relationnels',
  'problemes_relationnels': 'problemes_relationnels',
  'relationships': 'problemes_relationnels',
  'Deuil ou perte d\'un proche': 'deuil',
  'deuil': 'deuil',
  'grief': 'deuil',
  'Confiance en soi et estime de soi': 'confiance_estime',
  'confiance_estime': 'confiance_estime',
  'self_esteem': 'confiance_estime',
  'Traumatisme ou évènement passé difficile': 'traumatisme',
  'traumatisme': 'traumatisme',
  'trauma': 'traumatisme',
  'Troubles alimentaires': 'troubles_alimentaires',
  'troubles_alimentaires': 'troubles_alimentaires',
  'eating_disorders': 'troubles_alimentaires',
  'Addictions': 'addictions',
  'addictions': 'addictions',
  'addiction': 'addictions',
  'Troubles du sommeil': 'troubles_sommeil',
  'troubles_sommeil': 'troubles_sommeil',
  'sleep': 'troubles_sommeil',
  'Autre': 'autre',
  'autre': 'autre',
  'other': 'autre',
};

const PUBLIC_TYPE_MAP = {
  'Enfants / Adolescents': 'enfants_adolescents',
  'enfants_adolescents': 'enfants_adolescents',
  'children': 'enfants_adolescents',
  'Adultes': 'adultes',
  'adultes': 'adultes',
  'adults': 'adultes',
  'Couples': 'couples',
  'couples': 'couples',
  'Personnes âgées': 'personnes_agees',
  'personnes_agees': 'personnes_agees',
  'elderly': 'personnes_agees',
  'Tous publics': 'tous_publics',
  'tous_publics': 'tous_publics',
  'all': 'tous_publics',
};

async function migratePatientQuestionnaires() {
  console.log('\n📋 Migrating patient questionnaires...');

  // Get all lookup table IDs
  const consultationModes = await prisma.consultationMode.findMany();
  const timeSlots = await prisma.timeSlot.findMany();
  const languages = await prisma.language.findMany();
  const pathologies = await prisma.pathology.findMany();

  const modeMap = Object.fromEntries(consultationModes.map(m => [m.code, m.id]));
  const slotMap = Object.fromEntries(timeSlots.map(s => [s.code, s.id]));
  const langMap = Object.fromEntries(languages.map(l => [l.code, l.id]));
  const pathMap = Object.fromEntries(pathologies.map(p => [p.code, p.id]));

  // Find patients with JSON questionnaire data
  const patients = await prisma.patient.findMany({
    where: {
      NOT: { questionnaireDataRaw: null },
    },
  });

  console.log(`Found ${patients.length} patients with questionnaire data`);

  for (const patient of patients) {
    try {
      const data = patient.questionnaireDataRaw;
      if (!data || typeof data !== 'object') continue;

      // Prepare single-choice updates
      const singleChoiceUpdates = {};

      if (data.genrePref) {
        const mapped = GENRE_PREF_MAP[data.genrePref];
        if (mapped) singleChoiceUpdates.genrePref = mapped;
      }

      if (data.sensibilitePatient || data.sensibilite) {
        const val = data.sensibilitePatient || data.sensibilite;
        const mapped = SENSIBILITE_PATIENT_MAP[val];
        if (mapped) singleChoiceUpdates.sensibilitePatient = mapped;
      }

      if (data.experiencePassee || data.experience) {
        const val = data.experiencePassee || data.experience;
        const mapped = EXPERIENCE_PASSEE_MAP[val];
        if (mapped) singleChoiceUpdates.experiencePassee = mapped;
      }

      if (data.attentesTherapie || data.attentes) {
        const val = data.attentesTherapie || data.attentes;
        const mapped = ATTENTES_THERAPIE_MAP[val];
        if (mapped) singleChoiceUpdates.attentesTherapie = mapped;
      }

      // Update single-choice fields
      if (Object.keys(singleChoiceUpdates).length > 0) {
        await prisma.patient.update({
          where: { id: patient.id },
          data: singleChoiceUpdates,
        });
      }

      // Handle multi-select: consultation modes
      const modes = data.modesConsultation || data.consultationModes || [];
      for (const mode of (Array.isArray(modes) ? modes : [modes])) {
        const code = CONSULTATION_MODE_MAP[mode];
        if (code && modeMap[code]) {
          await prisma.patientConsultationMode.upsert({
            where: {
              patientId_consultationModeId: {
                patientId: patient.id,
                consultationModeId: modeMap[code],
              },
            },
            update: {},
            create: {
              patientId: patient.id,
              consultationModeId: modeMap[code],
            },
          });
        }
      }

      // Handle multi-select: time slots
      const slots = data.tempsPref || data.timeSlots || [];
      for (const slot of (Array.isArray(slots) ? slots : [slots])) {
        const code = TIME_SLOT_MAP[slot];
        if (code && slotMap[code]) {
          await prisma.patientTimeSlot.upsert({
            where: {
              patientId_timeSlotId: {
                patientId: patient.id,
                timeSlotId: slotMap[code],
              },
            },
            update: {},
            create: {
              patientId: patient.id,
              timeSlotId: slotMap[code],
            },
          });
        }
      }

      // Handle multi-select: languages
      const langs = data.langues || data.languages || [];
      for (const lang of (Array.isArray(langs) ? langs : [langs])) {
        const code = LANGUAGE_MAP[lang];
        if (code && langMap[code]) {
          await prisma.patientLanguage.upsert({
            where: {
              patientId_languageId: {
                patientId: patient.id,
                languageId: langMap[code],
              },
            },
            update: {},
            create: {
              patientId: patient.id,
              languageId: langMap[code],
            },
          });
        }
      }

      // Handle multi-select: pathologies
      const paths = data.pathologies || data.issues || [];
      for (const path of (Array.isArray(paths) ? paths : [paths])) {
        const code = PATHOLOGY_MAP[path];
        if (code && pathMap[code]) {
          await prisma.patientPathology.upsert({
            where: {
              patientId_pathologyId: {
                patientId: patient.id,
                pathologyId: pathMap[code],
              },
            },
            update: {},
            create: {
              patientId: patient.id,
              pathologyId: pathMap[code],
            },
          });
        }
      }

      console.log(`  ✓ Migrated patient ${patient.id}`);
    } catch (error) {
      console.error(`  ✗ Error migrating patient ${patient.id}:`, error.message);
    }
  }
}

async function migrateTherapistQuestionnaires() {
  console.log('\n👨‍⚕️ Migrating therapist questionnaires...');

  // Get all lookup table IDs
  const consultationModes = await prisma.consultationMode.findMany();
  const timeSlots = await prisma.timeSlot.findMany();
  const languages = await prisma.language.findMany();
  const pathologies = await prisma.pathology.findMany();
  const publicTypes = await prisma.publicType.findMany();

  const modeMap = Object.fromEntries(consultationModes.map(m => [m.code, m.id]));
  const slotMap = Object.fromEntries(timeSlots.map(s => [s.code, s.id]));
  const langMap = Object.fromEntries(languages.map(l => [l.code, l.id]));
  const pathMap = Object.fromEntries(pathologies.map(p => [p.code, p.id]));
  const pubMap = Object.fromEntries(publicTypes.map(p => [p.code, p.id]));

  // Find all therapists (they may have data in languages/specializations arrays)
  const therapists = await prisma.therapist.findMany();

  console.log(`Found ${therapists.length} therapists to process`);

  for (const therapist of therapists) {
    try {
      // Note: Therapists might not have JSON questionnaire data
      // They have languages[] and availability JSON fields

      // Migrate languages array to relational structure
      if (therapist.languages && Array.isArray(therapist.languages)) {
        for (const lang of therapist.languages) {
          const code = LANGUAGE_MAP[lang];
          if (code && langMap[code]) {
            await prisma.therapistLanguage.upsert({
              where: {
                therapistId_languageId: {
                  therapistId: therapist.id,
                  languageId: langMap[code],
                },
              },
              update: {},
              create: {
                therapistId: therapist.id,
                languageId: langMap[code],
              },
            });
          }
        }
      }

      // If there's questionnaire data in availability or elsewhere, migrate it
      const data = therapist.availability;
      if (data && typeof data === 'object') {
        // Check if availability contains questionnaire data
        if (data.sensibiliteTherapeute) {
          const mapped = SENSIBILITE_THERAPEUTE_MAP[data.sensibiliteTherapeute];
          if (mapped) {
            await prisma.therapist.update({
              where: { id: therapist.id },
              data: { sensibiliteTherapeute: mapped },
            });
          }
        }

        if (data.approcheTherapeute) {
          const mapped = APPROCHE_THERAPEUTE_MAP[data.approcheTherapeute];
          if (mapped) {
            await prisma.therapist.update({
              where: { id: therapist.id },
              data: { approcheTherapeute: mapped },
            });
          }
        }

        // Handle multi-select: consultation modes
        const modes = data.modesConsultation || [];
        for (const mode of (Array.isArray(modes) ? modes : [modes])) {
          const code = CONSULTATION_MODE_MAP[mode];
          if (code && modeMap[code]) {
            await prisma.therapistConsultationMode.upsert({
              where: {
                therapistId_consultationModeId: {
                  therapistId: therapist.id,
                  consultationModeId: modeMap[code],
                },
              },
              update: {},
              create: {
                therapistId: therapist.id,
                consultationModeId: modeMap[code],
              },
            });
          }
        }

        // Handle multi-select: time slots
        const slots = data.tempsPref || [];
        for (const slot of (Array.isArray(slots) ? slots : [slots])) {
          const code = TIME_SLOT_MAP[slot];
          if (code && slotMap[code]) {
            await prisma.therapistTimeSlot.upsert({
              where: {
                therapistId_timeSlotId: {
                  therapistId: therapist.id,
                  timeSlotId: slotMap[code],
                },
              },
              update: {},
              create: {
                therapistId: therapist.id,
                timeSlotId: slotMap[code],
              },
            });
          }
        }

        // Handle multi-select: public types
        const publics = data.publiquePref || [];
        for (const pub of (Array.isArray(publics) ? publics : [publics])) {
          const code = PUBLIC_TYPE_MAP[pub];
          if (code && pubMap[code]) {
            await prisma.therapistPublicType.upsert({
              where: {
                therapistId_publicTypeId: {
                  therapistId: therapist.id,
                  publicTypeId: pubMap[code],
                },
              },
              update: {},
              create: {
                therapistId: therapist.id,
                publicTypeId: pubMap[code],
              },
            });
          }
        }

        // Handle multi-select: pathologies from specializations
        const specs = data.pathologies || [];
        for (const spec of (Array.isArray(specs) ? specs : [specs])) {
          const code = PATHOLOGY_MAP[spec];
          if (code && pathMap[code]) {
            await prisma.therapistPathology.upsert({
              where: {
                therapistId_pathologyId: {
                  therapistId: therapist.id,
                  pathologyId: pathMap[code],
                },
              },
              update: {},
              create: {
                therapistId: therapist.id,
                pathologyId: pathMap[code],
              },
            });
          }
        }
      }

      console.log(`  ✓ Processed therapist ${therapist.id}`);
    } catch (error) {
      console.error(`  ✗ Error processing therapist ${therapist.id}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 Starting questionnaire data migration...\n');
  console.log('This script migrates JSON questionnaire data to relational tables.');
  console.log('Make sure you have run the seed script first to populate lookup tables.\n');

  await migratePatientQuestionnaires();
  await migrateTherapistQuestionnaires();

  console.log('\n✅ Migration completed!');
  console.log('\nNext steps:');
  console.log('1. Verify the migrated data in the database');
  console.log('2. Update frontend to use new questionnaire API endpoints');
  console.log('3. Test the matching algorithm with relational queries');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
