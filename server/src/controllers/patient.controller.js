import crypto from 'crypto';
import { prisma } from '../db/prisma.js';

/**
 * Get patient profile with questionnaire data
 */
const getProfile = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
      include: {
        // Include the assigned therapist so the patient dashboard
        // can display the real name without a second API call.
        currentTherapist: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        consultationModes: {
          include: { consultationMode: true },
        },
        timeSlots: {
          include: { timeSlot: true },
        },
        languages: {
          include: { language: true },
        },
        pathologies: {
          include: { pathology: true },
        },
      },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    // Transform the data to a cleaner format
    const transformedPatient = {
      ...patient,
      // Flatten the currentTherapist for the frontend.
      // The frontend reads `currentTherapistName` and the full
      // `currentTherapist` object directly.
      currentTherapist: patient.currentTherapist
        ? {
            id: patient.currentTherapist.id,
            userId: patient.currentTherapist.userId,
            name: patient.currentTherapist.user?.name || null,
            email: patient.currentTherapist.user?.email || null,
            approcheTherapeute: patient.currentTherapist.approcheTherapeute || null,
            profilePhotoUrl: patient.currentTherapist.profilePhotoUrl || null,
          }
        : null,
      questionnaire: {
        genrePref: patient.genrePref,
        sensibilitePatient: patient.sensibilitePatient,
        experiencePassee: patient.experiencePassee,
        attentesTherapie: patient.attentesTherapie,
        consultationModes: patient.consultationModes.map(cm => cm.consultationMode),
        timeSlots: patient.timeSlots.map(ts => ts.timeSlot),
        languages: patient.languages.map(l => l.language),
        pathologies: patient.pathologies.map(p => p.pathology),
      },
    };

    // Remove join table data from response
    delete transformedPatient.consultationModes;
    delete transformedPatient.timeSlots;
    delete transformedPatient.languages;
    delete transformedPatient.pathologies;

    res.json({
      success: true,
      data: transformedPatient,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update patient profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const {
      dateOfBirth,
      gender,
      phone,
      address,
      wilaya,
      emergencyContact,
      emergencyPhone,
      preferredLanguage,
    } = req.body;

    const patient = await prisma.patient.updateMany({
      where: { userId: req.user.id },
      data: {
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender,
        phone,
        address,
        wilaya,
        emergencyContact,
        emergencyPhone,
        preferredLanguage,
        updatedAt: new Date(),
      },
    });

    const updatedPatient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    });

    res.json({
      success: true,
      data: updatedPatient,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit onboarding questionnaire (relational storage)
 */
const submitQuestionnaire = async (req, res, next) => {
  try {
    const {
      // Single-choice questions
      genrePref,
      sensibilitePatient,
      experiencePassee,
      attentesTherapie,
      // Multi-select questions (arrays of codes)
      consultationModes,
      timeSlots,
      languages,
      pathologies,
    } = req.body;

    // Find patient
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    // Update single-choice fields
    await prisma.patient.update({
      where: { id: patient.id },
      data: {
        genrePref: genrePref || undefined,
        sensibilitePatient: sensibilitePatient || undefined,
        experiencePassee: experiencePassee || undefined,
        attentesTherapie: attentesTherapie || undefined,
        onboardingCompleted: true,
        updatedAt: new Date(),
        // Store raw data as backup
        questionnaireDataRaw: req.body,
      },
    });

    // Handle multi-select: consultation modes
    if (consultationModes && Array.isArray(consultationModes)) {
      // Clear existing
      await prisma.patientConsultationMode.deleteMany({
        where: { patientId: patient.id },
      });
      // Add new
      for (const code of consultationModes) {
        const mode = await prisma.consultationMode.findUnique({
          where: { code },
        });
        if (mode) {
          await prisma.patientConsultationMode.create({
            data: {
              patientId: patient.id,
              consultationModeId: mode.id,
            },
          });
        }
      }
    }

    // Handle multi-select: time slots
    if (timeSlots && Array.isArray(timeSlots)) {
      await prisma.patientTimeSlot.deleteMany({
        where: { patientId: patient.id },
      });
      for (const code of timeSlots) {
        const slot = await prisma.timeSlot.findUnique({
          where: { code },
        });
        if (slot) {
          await prisma.patientTimeSlot.create({
            data: {
              patientId: patient.id,
              timeSlotId: slot.id,
            },
          });
        }
      }
    }

    // Handle multi-select: languages
    if (languages && Array.isArray(languages)) {
      await prisma.patientLanguage.deleteMany({
        where: { patientId: patient.id },
      });
      for (const code of languages) {
        const lang = await prisma.language.findUnique({
          where: { code },
        });
        if (lang) {
          await prisma.patientLanguage.create({
            data: {
              patientId: patient.id,
              languageId: lang.id,
            },
          });
        }
      }
    }

    // Handle multi-select: pathologies
    if (pathologies && Array.isArray(pathologies)) {
      await prisma.patientPathology.deleteMany({
        where: { patientId: patient.id },
      });
      for (const code of pathologies) {
        const path = await prisma.pathology.findUnique({
          where: { code },
        });
        if (path) {
          await prisma.patientPathology.create({
            data: {
              patientId: patient.id,
              pathologyId: path.id,
            },
          });
        }
      }
    }

    // Fetch updated patient with relations
    const updatedPatient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
      include: {
        consultationModes: {
          include: { consultationMode: true },
        },
        timeSlots: {
          include: { timeSlot: true },
        },
        languages: {
          include: { language: true },
        },
        pathologies: {
          include: { pathology: true },
        },
      },
    });

    res.json({
      success: true,
      data: updatedPatient,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get questionnaire options (lookup tables)
 */
const getQuestionnaireOptions = async (req, res, next) => {
  try {
    const [consultationModes, timeSlots, languages, pathologies] = await Promise.all([
      prisma.consultationMode.findMany({ orderBy: { code: 'asc' } }),
      prisma.timeSlot.findMany({ orderBy: { code: 'asc' } }),
      prisma.language.findMany({ orderBy: { code: 'asc' } }),
      prisma.pathology.findMany({ orderBy: { code: 'asc' } }),
    ]);

    res.json({
      success: true,
      data: {
        // Single-choice enums
        genrePref: [
          { code: 'FEMME', label: 'Une femme' },
          { code: 'HOMME', label: 'Un homme' },
          { code: 'PEU_IMPORTE', label: 'Peu importe' },
        ],
        sensibilitePatient: [
          { code: 'OUI_IMPORTANT', label: 'Oui, c\'est important pour moi' },
          { code: 'NON_NECESSAIRE', label: 'Non, ce n\'est pas nécessaire' },
          { code: 'NE_SAIS_PAS', label: 'Je ne sais pas' },
        ],
        experiencePassee: [
          { code: 'OUI_POSITIVE', label: 'Oui, j\'ai eu une expérience positive' },
          { code: 'OUI_NON_SATISFAISANTE', label: 'Oui, mais l\'expérience n\'était pas satisfaisante' },
          { code: 'NON_PREMIERE_FOIS', label: 'Non, c\'est ma première fois' },
          { code: 'NE_SAIS_PAS', label: 'Je ne sais pas' },
        ],
        attentesTherapie: [
          { code: 'ECOUTE_ACTIVE', label: 'Quelqu\'un qui m\'écoute activement sans trop intervenir' },
          { code: 'EXERCICES_OUTILS', label: 'Quelqu\'un qui me donne des exercices et des outils concrets' },
          { code: 'COMPRENDRE_PASSE', label: 'Quelqu\'un qui m\'aide à comprendre mon passé en profondeur' },
          { code: 'NE_SAIS_PAS', label: 'Je ne sais pas encore' },
        ],
        // Multi-select from lookup tables
        consultationModes,
        timeSlots,
        languages,
        pathologies,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get matched therapists based on questionnaire (relational matching)
 *
 * Matching Score Formula:
 * =======================
 * Score is calculated as a weighted percentage (0-100).
 * Each criterion is normalized by the patient's total preferences,
 * ensuring the final score never exceeds 100 and is never negative.
 *
 * Weights:
 *   - Pathologies match: 25%
 *   - Languages match: 20%
 *   - Consultation modes match: 15%
 *   - Time slots match: 10%
 *   - Therapeutic approach match: 15%
 *   - Gender preference match: 10%
 *   - Sensitivity/cultural match: 5%
 *
 * Formula for each weighted category:
 *   categoryScore = (matchingItems / patientTotalItems) × weight
 *   finalScore = sum of all categoryScores (capped at 100)
 */
const getMatchedTherapists = async (req, res, next) => {
  try {
    // Get patient with all questionnaire relations
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
      include: {
        consultationModes: true,
        timeSlots: true,
        languages: true,
        pathologies: true,
      },
    });

    if (!patient || !patient.onboardingCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Please complete the questionnaire first',
      });
    }

    // Get verified therapists with their questionnaire data
    const therapists = await prisma.therapist.findMany({
      where: {
        verificationStatus: 'verified',
        acceptingNewPatients: true,
      },
      include: {
        consultationModes: true,
        timeSlots: true,
        languages: true,
        pathologies: true,
        publicTypes: true,
        user: {
          select: { name: true },
        },
      },
      orderBy: [
        { rating: 'desc' },
        { totalReviews: 'desc' },
      ],
    });

    // Extract patient preference IDs for comparison
    const patientModeIds = new Set(patient.consultationModes.map(cm => cm.consultationModeId));
    const patientSlotIds = new Set(patient.timeSlots.map(ts => ts.timeSlotId));
    const patientLangIds = new Set(patient.languages.map(l => l.languageId));
    const patientPathIds = new Set(patient.pathologies.map(p => p.pathologyId));

    // Define category weights (total = 100)
    const WEIGHTS = {
      pathologies: 25,
      languages: 20,
      consultationModes: 15,
      timeSlots: 10,
      therapeuticApproach: 15,
      genderPreference: 10,
      sensitivity: 5,
    };

    // Calculate match scores using relational data
    const matchedTherapists = therapists.map((therapist) => {
      let matchScore = 0;
      const matchReasons = [];

      // --- Pathologies match (25%) ---
      const therapistPathIds = new Set(therapist.pathologies.map(p => p.pathologyId));
      const matchingPaths = [...patientPathIds].filter(id => therapistPathIds.has(id));
      if (patientPathIds.size > 0) {
        const pathRatio = matchingPaths.length / patientPathIds.size;
        matchScore += pathRatio * WEIGHTS.pathologies;
        if (matchingPaths.length > 0) {
          matchReasons.push(`${matchingPaths.length} domaine(s) d'expertise correspondant(s)`);
        }
      }

      // --- Languages match (20%) ---
      const therapistLangIds = new Set(therapist.languages.map(l => l.languageId));
      const matchingLangs = [...patientLangIds].filter(id => therapistLangIds.has(id));
      if (patientLangIds.size > 0) {
        const langRatio = matchingLangs.length / patientLangIds.size;
        matchScore += langRatio * WEIGHTS.languages;
        if (matchingLangs.length > 0) {
          matchReasons.push(`${matchingLangs.length} langue(s) en commun`);
        }
      }

      // --- Consultation modes match (15%) ---
      const therapistModeIds = new Set(therapist.consultationModes.map(cm => cm.consultationModeId));
      const matchingModes = [...patientModeIds].filter(id => therapistModeIds.has(id));
      if (patientModeIds.size > 0) {
        const modeRatio = matchingModes.length / patientModeIds.size;
        matchScore += modeRatio * WEIGHTS.consultationModes;
        if (matchingModes.length > 0) {
          matchReasons.push(`${matchingModes.length} mode(s) de consultation en commun`);
        }
      }

      // --- Time slots match (10%) ---
      const therapistSlotIds = new Set(therapist.timeSlots.map(ts => ts.timeSlotId));
      const matchingSlots = [...patientSlotIds].filter(id => therapistSlotIds.has(id));
      if (patientSlotIds.size > 0) {
        const slotRatio = matchingSlots.length / patientSlotIds.size;
        matchScore += slotRatio * WEIGHTS.timeSlots;
        if (matchingSlots.length > 0) {
          matchReasons.push(`${matchingSlots.length} créneau(x) horaire(s) en commun`);
        }
      }

      // --- Therapeutic approach match (15%) ---
      if (patient.attentesTherapie && therapist.approcheTherapeute) {
        const approachMatch = {
          'ECOUTE_ACTIVE': 'HUMANISTE_GESTALT',
          'EXERCICES_OUTILS': 'TCC',
          'COMPRENDRE_PASSE': 'PSYCHANALYSE',
        };

        if (approachMatch[patient.attentesTherapie] === therapist.approcheTherapeute) {
          matchScore += WEIGHTS.therapeuticApproach;
          matchReasons.push('Approche thérapeutique parfaitement correspondante');
        } else if (therapist.approcheTherapeute === 'INTEGRATIVE') {
          // Integrative approach partially matches all expectations
          matchScore += WEIGHTS.therapeuticApproach * 0.5;
          matchReasons.push('Approche intégrative (compatible)');
        }
      }

      // --- Gender preference match (10%) ---
      if (patient.genrePref && therapist.gender) {
        if (patient.genrePref === 'HOMME' && therapist.gender.toUpperCase() === 'HOMME') {
          matchScore += WEIGHTS.genderPreference;
          matchReasons.push('Préférence de genre respectée');
        } else if (patient.genrePref === 'FEMME' && therapist.gender.toUpperCase() === 'FEMME') {
          matchScore += WEIGHTS.genderPreference;
          matchReasons.push('Préférence de genre respectée');
        }
        // genrePref = PEU_IMPORTE => no bonus (intentional)
      }

      // --- Sensitivity/cultural match (5%) ---
      if (patient.sensibilitePatient === 'OUI_IMPORTANT' && 
          therapist.sensibiliteTherapeute === 'INTEGRE_DEMANDE') {
        matchScore += WEIGHTS.sensitivity;
        matchReasons.push('Sensibilité culturelle/spirituelle respectée');
      }

      // Rating boost (up to 5% bonus, not exceeding 100 total)
      let ratingBoost = 0;
      if (therapist.rating) {
        ratingBoost = Math.min(parseFloat(therapist.rating), 5);
      }

      // Final score capped at 100
      const finalScore = Math.min(Math.round(matchScore + ratingBoost), 100);

      return {
        id: therapist.id,
        userId: therapist.userId,
        name: therapist.user?.name || 'Thérapeute',
        bio: therapist.bio,
        profilePhotoUrl: therapist.profilePhotoUrl,
        hourlyRate: therapist.hourlyRate ? parseFloat(therapist.hourlyRate) : null,
        currency: therapist.currency,
        rating: therapist.rating ? parseFloat(therapist.rating) : null,
        totalReviews: therapist.totalReviews,
        approcheTherapeute: therapist.approcheTherapeute,
        sensibiliteTherapeute: therapist.sensibiliteTherapeute,
        gender: therapist.gender,
        matchScore: finalScore,
        matchReasons,
        compatibility: finalScore, // Percentage (0-100)
      };
    });

    // Filter out therapists with 0% compatibility if no matches at all
    // and sort by match score descending
    matchedTherapists.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      data: matchedTherapists.slice(0, 10), // Return top 10 matches
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Select a therapist (set currentTherapistId)
 */
const selectTherapist = async (req, res, next) => {
  try {
    const { therapistId } = req.body;

    if (!therapistId) {
      return res.status(400).json({
        success: false,
        message: 'Therapist ID is required',
      });
    }

    // Verify therapist exists and is accepting patients
    const therapist = await prisma.therapist.findUnique({
      where: { id: therapistId },
    });

    if (!therapist || therapist.verificationStatus !== 'verified' || !therapist.acceptingNewPatients) {
      return res.status(400).json({
        success: false,
        message: 'Therapist is not available',
      });
    }

    // Find the patient
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    // Business rule: A patient can only have one active therapist at a time
    if (patient.currentTherapistid) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà un thérapeute actif. Veuillez d\'abord mettre fin à la relation actuelle.',
      });
    }

    // Use currentTherapistid (the actual field name in the database)
    await prisma.patient.update({
      where: { id: patient.id },
      data: {
        currentTherapistid: therapistId,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Thérapeute sélectionné avec succès',
      data: {
        currentTherapistId: therapistId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get patient's appointments
 */
const getAppointments = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    const appointments = await prisma.appointment.findMany({
      where: { patientId: patient.id },
      include: {
        therapist: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        // Surface the underlying TherapistAvailableTimeSlot so the
        // frontend can show the precise time the patient booked
        // (matches the slots rendered in the calendar).
        therapistAvailableTimeSlot: true,
        appointmentOutcome: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });

    res.json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get patient's session reports (visible to patient)
 */
const getSessionReports = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    const reports = await prisma.appointmentOutcome.findMany({
      where: {
        isConfidential: false,
        appointment: {
          patientId: patient.id,
        },
      },
      include: {
        appointment: {
          include: {
            therapist: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all patients (admin only)
 */
const getAllPatients = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? {
          OR: [
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          pathologies: {
            include: { pathology: true },
          },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    res.json({
      success: true,
      data: patients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get patient by ID (admin/therapist)
 */
const getPatientById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        consultationModes: {
          include: { consultationMode: true },
        },
        timeSlots: {
          include: { timeSlot: true },
        },
        languages: {
          include: { language: true },
        },
        pathologies: {
          include: { pathology: true },
        },
      },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    // If therapist, verify they are the matched therapist using currentTherapistid
    if (req.user.role === 'therapist' && patient.currentTherapistid !== req.user.therapistId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * STEP 1: Initiate change therapist — check for active appointments
 *
 * Business rules:
 *   - If the patient has a confirmed appointment → BLOCK
 *   - If the patient has a scheduled appointment → WARN, offer to cancel
 *   - If no active appointments → PROCEED
 */
const initiateChangeTherapist = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    const now = new Date();

    // Check for confirmed appointment → BLOCK
    const confirmedAppt = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        status: 'confirmed',
        scheduledAt: { gte: now },
      },
    });

    if (confirmedAppt) {
      return res.json({
        success: true,
        canProceed: false,
        reason: 'confirmed_appointment',
        message:
          'Vous avez un rendez-vous confirmé avec votre thérapeute actuel.\n\n' +
          'Vous ne pouvez pas changer de thérapeute tant que ce rendez-vous n\'est pas terminé ou annulé.',
      });
    }

    // Check for scheduled appointment → WARN
    const scheduledAppt = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        status: 'scheduled',
        scheduledAt: { gte: now },
      },
    });

    if (scheduledAppt) {
      return res.json({
        success: true,
        canProceed: true,
        requiresCancellation: true,
        appointmentId: scheduledAppt.id,
        message:
          'Vous avez une demande de rendez-vous en attente.\n\n' +
          'Changer de thérapeute annulera automatiquement cette demande.\n\n' +
          'Voulez-vous continuer ?',
      });
    }

    // No active appointments → proceed directly
    return res.json({
      success: true,
      canProceed: true,
      requiresCancellation: false,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * STEP 2: Cancel scheduled appointment (if any) AND return matched therapists
 *         excluding the current therapist.
 */
const cancelAndGetMatches = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;

    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    // If an appointmentId is provided, cancel it using the existing logic
    if (appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          therapistAvailableTimeSlot: true,
        },
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Rendez-vous introuvable.',
        });
      }

      // Verify ownership
      if (appointment.patientId !== patient.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      // Only cancel scheduled appointments (not confirmed ones)
      if (appointment.status !== 'scheduled') {
        return res.status(400).json({
          success: false,
          message: 'Ce rendez-vous ne peut pas être annulé dans ce contexte.',
        });
      }

      // Reuse the existing cancellation logic (same pattern as appointment.controller.js cancel())
      const slotId = appointment.therapistAvailableTimeSlotId;
      await prisma.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            status: 'cancelled',
            therapistAvailableTimeSlotId: null,
            cancelledAt: new Date(),
            cancelledBy: req.user.id,
            updatedAt: new Date(),
          },
        });

        if (slotId) {
          await tx.therapistAvailableTimeSlot.update({
            where: { id: slotId },
            data: { isBooked: false },
          });
        }
      });
    }

    // Now fetch matched therapists, EXCLUDING the current one
    // We reuse the existing logic but add exclusion of currentTherapistId
    const patientFull = await prisma.patient.findFirst({
      where: { userId: req.user.id },
      include: {
        consultationModes: true,
        timeSlots: true,
        languages: true,
        pathologies: true,
      },
    });

    if (!patientFull || !patientFull.onboardingCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Please complete the questionnaire first',
      });
    }

    const excludeTherapistId = patientFull.currentTherapistid;

    // Get verified therapists (excluding current if applicable)
    const therapistWhere = {
      verificationStatus: 'verified',
      acceptingNewPatients: true,
    };
    if (excludeTherapistId) {
      therapistWhere.id = { not: excludeTherapistId };
    }

    const therapists = await prisma.therapist.findMany({
      where: therapistWhere,
      include: {
        consultationModes: true,
        timeSlots: true,
        languages: true,
        pathologies: true,
        publicTypes: true,
        user: {
          select: { name: true },
        },
      },
      orderBy: [
        { rating: 'desc' },
        { totalReviews: 'desc' },
      ],
    });

    // If no therapists found after exclusion
    if (therapists.length === 0) {
      return res.json({
        success: true,
        data: [],
        noMatchesAvailable: true,
        message:
          'Aucun autre thérapeute compatible n\'est actuellement disponible.\n\n' +
          'Vous pouvez conserver votre thérapeute actuel ou réessayer plus tard.',
      });
    }

    // Extract patient preference IDs for comparison
    const patientModeIds = new Set(patientFull.consultationModes.map(cm => cm.consultationModeId));
    const patientSlotIds = new Set(patientFull.timeSlots.map(ts => ts.timeSlotId));
    const patientLangIds = new Set(patientFull.languages.map(l => l.languageId));
    const patientPathIds = new Set(patientFull.pathologies.map(p => p.pathologyId));

    // Define category weights (total = 100) — SAME as getMatchedTherapists
    const WEIGHTS = {
      pathologies: 25,
      languages: 20,
      consultationModes: 15,
      timeSlots: 10,
      therapeuticApproach: 15,
      genderPreference: 10,
      sensitivity: 5,
    };

    // Calculate match scores — SAME algorithm as getMatchedTherapists
    const matchedTherapists = therapists.map((therapist) => {
      let matchScore = 0;
      const matchReasons = [];

      // Pathologies match (25%)
      const therapistPathIds = new Set(therapist.pathologies.map(p => p.pathologyId));
      const matchingPaths = [...patientPathIds].filter(id => therapistPathIds.has(id));
      if (patientPathIds.size > 0) {
        const pathRatio = matchingPaths.length / patientPathIds.size;
        matchScore += pathRatio * WEIGHTS.pathologies;
        if (matchingPaths.length > 0) {
          matchReasons.push(`${matchingPaths.length} domaine(s) d'expertise correspondant(s)`);
        }
      }

      // Languages match (20%)
      const therapistLangIds = new Set(therapist.languages.map(l => l.languageId));
      const matchingLangs = [...patientLangIds].filter(id => therapistLangIds.has(id));
      if (patientLangIds.size > 0) {
        const langRatio = matchingLangs.length / patientLangIds.size;
        matchScore += langRatio * WEIGHTS.languages;
        if (matchingLangs.length > 0) {
          matchReasons.push(`${matchingLangs.length} langue(s) en commun`);
        }
      }

      // Consultation modes match (15%)
      const therapistModeIds = new Set(therapist.consultationModes.map(cm => cm.consultationModeId));
      const matchingModes = [...patientModeIds].filter(id => therapistModeIds.has(id));
      if (patientModeIds.size > 0) {
        const modeRatio = matchingModes.length / patientModeIds.size;
        matchScore += modeRatio * WEIGHTS.consultationModes;
        if (matchingModes.length > 0) {
          matchReasons.push(`${matchingModes.length} mode(s) de consultation en commun`);
        }
      }

      // Time slots match (10%)
      const therapistSlotIds = new Set(therapist.timeSlots.map(ts => ts.timeSlotId));
      const matchingSlots = [...patientSlotIds].filter(id => therapistSlotIds.has(id));
      if (patientSlotIds.size > 0) {
        const slotRatio = matchingSlots.length / patientSlotIds.size;
        matchScore += slotRatio * WEIGHTS.timeSlots;
        if (matchingSlots.length > 0) {
          matchReasons.push(`${matchingSlots.length} créneau(x) horaire(s) en commun`);
        }
      }

      // Therapeutic approach match (15%)
      if (patientFull.attentesTherapie && therapist.approcheTherapeute) {
        const approachMatch = {
          'ECOUTE_ACTIVE': 'HUMANISTE_GESTALT',
          'EXERCICES_OUTILS': 'TCC',
          'COMPRENDRE_PASSE': 'PSYCHANALYSE',
        };

        if (approachMatch[patientFull.attentesTherapie] === therapist.approcheTherapeute) {
          matchScore += WEIGHTS.therapeuticApproach;
          matchReasons.push('Approche thérapeutique parfaitement correspondante');
        } else if (therapist.approcheTherapeute === 'INTEGRATIVE') {
          matchScore += WEIGHTS.therapeuticApproach * 0.5;
          matchReasons.push('Approche intégrative (compatible)');
        }
      }

      // Gender preference match (10%)
      if (patientFull.genrePref && therapist.gender) {
        if (patientFull.genrePref === 'HOMME' && therapist.gender.toUpperCase() === 'HOMME') {
          matchScore += WEIGHTS.genderPreference;
          matchReasons.push('Préférence de genre respectée');
        } else if (patientFull.genrePref === 'FEMME' && therapist.gender.toUpperCase() === 'FEMME') {
          matchScore += WEIGHTS.genderPreference;
          matchReasons.push('Préférence de genre respectée');
        }
      }

      // Sensitivity/cultural match (5%)
      if (patientFull.sensibilitePatient === 'OUI_IMPORTANT' &&
          therapist.sensibiliteTherapeute === 'INTEGRE_DEMANDE') {
        matchScore += WEIGHTS.sensitivity;
        matchReasons.push('Sensibilité culturelle/spirituelle respectée');
      }

      // Rating boost (up to 5% bonus, not exceeding 100 total)
      let ratingBoost = 0;
      if (therapist.rating) {
        ratingBoost = Math.min(parseFloat(therapist.rating), 5);
      }

      const finalScore = Math.min(Math.round(matchScore + ratingBoost), 100);

      return {
        id: therapist.id,
        userId: therapist.userId,
        name: therapist.user?.name || 'Thérapeute',
        bio: therapist.bio,
        profilePhotoUrl: therapist.profilePhotoUrl,
        hourlyRate: therapist.hourlyRate ? parseFloat(therapist.hourlyRate) : null,
        currency: therapist.currency,
        rating: therapist.rating ? parseFloat(therapist.rating) : null,
        totalReviews: therapist.totalReviews,
        approcheTherapeute: therapist.approcheTherapeute,
        sensibiliteTherapeute: therapist.sensibiliteTherapeute,
        gender: therapist.gender,
        matchScore: finalScore,
        matchReasons,
        compatibility: finalScore,
      };
    });

    // Sort by match score descending
    matchedTherapists.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      data: matchedTherapists.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * STEP 3: Confirm the change — atomic transaction
 *
 * 1. Create TherapistHistory entry for the previous therapist (set unassignedAt)
 * 2. Create TherapistHistory entry for the new therapist (assignedAt = now)
 * 3. Update Patient.currentTherapistid
 * 4. Notify: patient, old therapist, new therapist
 * 5. Audit log
 *
 * If ANY step fails → rollback → no state change.
 */
const confirmChangeTherapist = async (req, res, next) => {
  try {
    const { newTherapistId } = req.body;

    if (!newTherapistId) {
      return res.status(400).json({
        success: false,
        message: 'newTherapistId is required',
      });
    }

    // Verify new therapist exists and is accepting patients
    const newTherapist = await prisma.therapist.findUnique({
      where: { id: newTherapistId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!newTherapist || newTherapist.verificationStatus !== 'verified' || !newTherapist.acceptingNewPatients) {
      return res.status(400).json({
        success: false,
        message: 'Le thérapeute sélectionné n\'est pas disponible.',
      });
    }

    // Get patient with current therapist info
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
      include: {
        currentTherapist: {
          include: { user: { select: { id: true, name: true } } },
        },
        user: { select: { name: true } },
      },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    const oldTherapistId = patient.currentTherapistid;
    const patientName = patient.user?.name || 'Un patient';

    // If the patient already has this therapist, bail out
    if (oldTherapistId === newTherapistId) {
      return res.status(400).json({
        success: false,
        message: 'Vous êtes déjà assigné à ce thérapeute.',
      });
    }

    // Atomic transaction
    await prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. Close previous therapist history entry (if exists)
      if (oldTherapistId) {
        // Find the most recent history entry for the old therapist that is still open
        const previousHistory = await tx.therapistHistory.findFirst({
          where: {
            patientId: patient.id,
            therapistId: oldTherapistId,
            unassignedAt: null,
          },
          orderBy: { assignedAt: 'desc' },
        });

        if (previousHistory) {
          await tx.therapistHistory.update({
            where: { id: previousHistory.id },
            data: { unassignedAt: now },
          });
        } else {
          // If no history entry exists (legacy data), create the closure entry
          await tx.therapistHistory.create({
            data: {
              patientId: patient.id,
              therapistId: oldTherapistId,
              assignedAt: patient.updatedAt, // approximate
              unassignedAt: now,
            },
          });
        }
      }

      // 2. Create new history entry for the new therapist
      await tx.therapistHistory.create({
        data: {
          patientId: patient.id,
          therapistId: newTherapistId,
          assignedAt: now,
        },
      });

      // 3. Update currentTherapistid
      await tx.patient.update({
        where: { id: patient.id },
        data: {
          currentTherapistid: newTherapistId,
          updatedAt: now,
        },
      });

      // 4. Notifications
      // Patient notification
      await tx.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: patient.userId,
          type: 'therapist_changed',
          title: 'Changement de thérapeute',
          message: 'Votre changement de thérapeute a été effectué avec succès.',
          actionUrl: '/patient',
          metadata: { oldTherapistId, newTherapistId },
          createdAt: now,
        },
      });

      // New therapist notification
      await tx.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: newTherapist.userId,
          type: 'patient_new_assignment',
          title: 'Nouveau patient attribué',
          message: `Un nouveau patient vous a été attribué.`,
          actionUrl: '/therapist',
          metadata: { patientId: patient.id, patientName },
          createdAt: now,
        },
      });

      // Old therapist notification (if exists)
      if (oldTherapistId && patient.currentTherapist?.user?.id) {
        await tx.notification.create({
          data: {
            id: crypto.randomUUID(),
            userId: patient.currentTherapist.user.id,
            type: 'patient_unassigned',
            title: 'Changement de thérapeute',
            message: `Le patient ${patientName} a choisi de poursuivre son suivi avec un autre thérapeute.`,
            actionUrl: '/therapist',
            metadata: { patientId: patient.id, patientName },
            createdAt: now,
          },
        });
      }

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          actorId: req.user.id,
          actorRole: 'patient',
          action: 'therapist.changed',
          resourceType: 'patient',
          resourceId: patient.id,
          previousValue: { currentTherapistId: oldTherapistId },
          newValue: { currentTherapistId: newTherapistId },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          createdAt: now,
        },
      });
    });

    // Fetch updated patient for response
    const updatedPatient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
      include: {
        currentTherapist: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const transformedPatient = updatedPatient
      ? {
          ...updatedPatient,
          currentTherapist: updatedPatient.currentTherapist
            ? {
                id: updatedPatient.currentTherapist.id,
                userId: updatedPatient.currentTherapist.userId,
                name: updatedPatient.currentTherapist.user?.name || null,
                email: updatedPatient.currentTherapist.user?.email || null,
                approcheTherapeute: updatedPatient.currentTherapist.approcheTherapeute || null,
                profilePhotoUrl: updatedPatient.currentTherapist.profilePhotoUrl || null,
              }
            : null,
        }
      : null;

    res.json({
      success: true,
      message: 'Changement de thérapeute effectué avec succès.',
      data: transformedPatient,
    });
  } catch (error) {
    next(error);
  }
};

export {
  getProfile,
  updateProfile,
  submitQuestionnaire,
  getQuestionnaireOptions,
  getMatchedTherapists,
  selectTherapist,
  getAppointments,
  getSessionReports,
  getAllPatients,
  getPatientById,
  initiateChangeTherapist,
  cancelAndGetMatches,
  confirmChangeTherapist,
};
