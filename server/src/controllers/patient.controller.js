const { prisma } = require('../db/prisma');

/**
 * Get patient profile with questionnaire data
 */
const getProfile = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
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

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    // Transform the data to a cleaner format
    const transformedPatient = {
      ...patient,
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

    // Calculate match scores using relational data
    const matchedTherapists = therapists.map((therapist) => {
      let matchScore = 0;
      const matchReasons = [];

      // Match consultation modes (15 points each)
      const therapistModeIds = new Set(therapist.consultationModes.map(cm => cm.consultationModeId));
      const matchingModes = [...patientModeIds].filter(id => therapistModeIds.has(id));
      if (matchingModes.length > 0) {
        matchScore += matchingModes.length * 15;
        matchReasons.push(`${matchingModes.length} mode(s) de consultation en commun`);
      }

      // Match time slots (10 points each)
      const therapistSlotIds = new Set(therapist.timeSlots.map(ts => ts.timeSlotId));
      const matchingSlots = [...patientSlotIds].filter(id => therapistSlotIds.has(id));
      if (matchingSlots.length > 0) {
        matchScore += matchingSlots.length * 10;
        matchReasons.push(`${matchingSlots.length} créneau(x) horaire(s) en commun`);
      }

      // Match languages (20 points each)
      const therapistLangIds = new Set(therapist.languages.map(l => l.languageId));
      const matchingLangs = [...patientLangIds].filter(id => therapistLangIds.has(id));
      if (matchingLangs.length > 0) {
        matchScore += matchingLangs.length * 20;
        matchReasons.push(`${matchingLangs.length} langue(s) en commun`);
      }

      // Match pathologies/expertise (25 points each)
      const therapistPathIds = new Set(therapist.pathologies.map(p => p.pathologyId));
      const matchingPaths = [...patientPathIds].filter(id => therapistPathIds.has(id));
      if (matchingPaths.length > 0) {
        matchScore += matchingPaths.length * 25;
        matchReasons.push(`${matchingPaths.length} domaine(s) d'expertise correspondant(s)`);
      }

      // Match therapeutic approach with patient expectations (30 points)
      if (patient.attentesTherapie && therapist.approcheTherapeute) {
        const approachMatch = {
          'ECOUTE_ACTIVE': 'HUMANISTE_GESTALT',
          'EXERCICES_OUTILS': 'TCC',
          'COMPRENDRE_PASSE': 'PSYCHANALYSE',
        };
        if (approachMatch[patient.attentesTherapie] === therapist.approcheTherapeute) {
          matchScore += 30;
          matchReasons.push('Approche thérapeutique correspondante');
        } else if (therapist.approcheTherapeute === 'INTEGRATIVE') {
          matchScore += 15; // Integrative approach partially matches all
          matchReasons.push('Approche intégrative');
        }
      }

      // Match sensitivity preference (15 points)
      if (patient.sensibilitePatient === 'OUI_IMPORTANT' && 
          therapist.sensibiliteTherapeute === 'INTEGRE_DEMANDE') {
        matchScore += 15;
        matchReasons.push('Sensibilité culturelle/spirituelle');
      }

      // Match gender preference (10 points) - would need therapist gender field
      // Skipped for now as therapist gender is not in the current schema

      // Boost for higher ratings (up to 25 points)
      if (therapist.rating) {
        matchScore += parseFloat(therapist.rating) * 5;
      }

      // Boost for experience (up to 10 points)
      if (therapist.yearsOfExperience) {
        matchScore += Math.min(therapist.yearsOfExperience, 10);
      }

      return {
        id: therapist.id,
        userId: therapist.userId,
        bio: therapist.bio,
        education: therapist.education,
        yearsOfExperience: therapist.yearsOfExperience,
        profilePhotoUrl: therapist.profilePhotoUrl,
        hourlyRate: therapist.hourlyRate,
        currency: therapist.currency,
        rating: therapist.rating,
        totalReviews: therapist.totalReviews,
        approcheTherapeute: therapist.approcheTherapeute,
        sensibiliteTherapeute: therapist.sensibiliteTherapeute,
        matchScore,
        matchReasons,
        compatibility: Math.min(Math.round((matchScore / 150) * 100), 100), // Percentage
      };
    });

    // Sort by match score descending
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
 * Select a therapist
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

    await prisma.patient.updateMany({
      where: { userId: req.user.id },
      data: {
        matchedTherapistId: therapistId,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Therapist selected successfully',
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
        therapist: true,
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
 * Get patient's session reports
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

    const reports = await prisma.sessionReport.findMany({
      where: {
        patientId: patient.id,
        isConfidential: false,
      },
      include: {
        appointment: true,
        therapist: true,
      },
      orderBy: { sessionDate: 'desc' },
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

    // If therapist, verify they are the matched therapist
    if (req.user.role === 'therapist' && patient.matchedTherapistId !== req.user.therapistId) {
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

module.exports = {
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
};
