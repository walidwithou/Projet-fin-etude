const { prisma } = require('../db/prisma');

/**
 * Get patient profile
 */
const getProfile = async (req, res, next) => {
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

    res.json({
      success: true,
      data: patient,
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
 * Submit onboarding questionnaire
 */
const submitQuestionnaire = async (req, res, next) => {
  try {
    const { questionnaireData } = req.body;

    if (!questionnaireData) {
      return res.status(400).json({
        success: false,
        message: 'Questionnaire data is required',
      });
    }

    const patient = await prisma.patient.updateMany({
      where: { userId: req.user.id },
      data: {
        questionnaireData,
        onboardingCompleted: true,
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
 * Get matched therapists based on questionnaire
 */
const getMatchedTherapists = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    });

    if (!patient || !patient.questionnaireData) {
      return res.status(400).json({
        success: false,
        message: 'Please complete the questionnaire first',
      });
    }

    // Get verified therapists accepting new patients
    const therapists = await prisma.therapist.findMany({
      where: {
        verificationStatus: 'verified',
        acceptingNewPatients: true,
      },
      orderBy: [
        { rating: 'desc' },
        { totalReviews: 'desc' },
      ],
    });

    // Simple matching algorithm based on questionnaire preferences
    const questionnaireData = patient.questionnaireData;
    const matchedTherapists = therapists.map((therapist) => {
      let matchScore = 0;

      // Match based on language preference
      if (therapist.languages && patient.preferredLanguage) {
        if (therapist.languages.includes(patient.preferredLanguage)) {
          matchScore += 20;
        }
      }

      // Match based on specializations (if questionnaire contains issues)
      if (questionnaireData.issues && therapist.specializations) {
        const matchingSpecializations = therapist.specializations.filter(
          (spec) => questionnaireData.issues.includes(spec)
        );
        matchScore += matchingSpecializations.length * 15;
      }

      // Boost for higher ratings
      if (therapist.rating) {
        matchScore += parseFloat(therapist.rating) * 5;
      }

      return {
        ...therapist,
        matchScore,
      };
    });

    // Sort by match score
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
        isConfidential: false, // Only show non-confidential reports to patients
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
  getMatchedTherapists,
  selectTherapist,
  getAppointments,
  getSessionReports,
  getAllPatients,
  getPatientById,
};
