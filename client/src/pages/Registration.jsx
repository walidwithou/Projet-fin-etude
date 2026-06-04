import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Brain, 
  Shield, 
  Languages, 
  Video, 
  Clock, 
  UserCheck, 
  Stethoscope, 
  History, 
  Target, 
  Users 
} from 'lucide-react';

import Header from '../components/Header';
import Footer from '../components/Footer';
import Landing from '../components/Landing';
import Questionnaire from '../components/Questionnaire';
import Upload from '../components/Upload';
import Success from '../components/Success';
import Results from '../components/Results';
import TherapistProfile from '../components/TherapistProfile';

import { WILAYAS_ALG, PATHOLOGIES, LANGUES, TEMPS_PREF } from '../constants';
import { auth, setToken, apiCall } from '../services/api';
import { useAuth } from '../auth/AuthContext';

const PATHOLOGY_CODES = [
  'stress_anxiete',
  'depression',
  'problemes_relationnels',
  'deuil',
  'confiance_estime',
  'traumatisme',
  'troubles_alimentaires',
  'addictions',
  'troubles_sommeil',
  'autre',
];
const LANGUAGE_CODES = ['ar_darja', 'ar_fusha', 'tamazight', 'fr', 'en'];
const CONSULTATION_MODE_CODES = ['visio', 'audio', 'presentiel'];
const TIME_SLOT_CODES = ['matin', 'apres_midi', 'soiree', 'weekend'];
const PUBLIC_TYPE_CODES = ['enfants_adolescents', 'adultes', 'couples', 'personnes_agees', 'tous_publics'];
const PATIENT_GENDER_PREFERENCE_CODES = ['FEMME', 'HOMME', 'PEU_IMPORTE'];
const PATIENT_SENSITIVITY_CODES = ['OUI_IMPORTANT', 'NON_NECESSAIRE', 'NE_SAIS_PAS'];
const PATIENT_EXPERIENCE_CODES = ['OUI_POSITIVE', 'OUI_NON_SATISFAISANTE', 'NON_PREMIERE_FOIS', 'NE_SAIS_PAS'];
const PATIENT_EXPECTATION_CODES = ['ECOUTE_ACTIVE', 'EXERCICES_OUTILS', 'COMPRENDRE_PASSE', 'NE_SAIS_PAS'];
const THERAPIST_GENDER_CODES = ['FEMME', 'HOMME', 'AUTRE'];
const THERAPIST_SENSITIVITY_CODES = ['INTEGRE_DEMANDE', 'LAIQUE_NEUTRE', 'AUTRE'];
const THERAPIST_APPROACH_CODES = ['TCC', 'PSYCHANALYSE', 'HUMANISTE_GESTALT', 'INTEGRATIVE'];

export default function Registration({ onNavigateToLogin, onNavigateToPage, initialMode }) {
  // AuthContext.refresh() re-fetches /auth/me and updates the React
  // state (token + user). We need it right after registration so
  // that:
  //   1. the just-issued session token (already in localStorage) is
  //      also reflected in the React state, and
  //   2. the subsequent navigation to the protected PATIENT page
  //      does NOT bounce the user back to LOGIN because
  //      `isAuthenticated = Boolean(token && user)` was false.
  const { refresh: refreshAuth } = useAuth();

  const [role, setRole] = useState(initialMode === 'RESULTS' ? 'PATIENT' : null );
  const [mode, setMode] = useState(initialMode || 'LANDING');
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [matches, setMatches] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    motDePasse: '',
    wilaya: '',
    pathologies: [],
    sexPref: 'Peu importe',
    sensibiliteCulturelle: 'SANS_AVIS',
    langues: [],
    modeConsultation: [],
    disponibilites: [],
    publicCible: [],
    dateOfBirth: '',
    gender: 'HOMME',
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: ''
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const patientQuestions = [
    {
      id: 'localisation',
      title: 'Localisation',
      subtitle: 'Quelle est votre wilaya de résidence ?',
      type: 'select',
      field: 'wilaya',
      options: WILAYAS_ALG,
      icon: <MapPin className="w-5 h-5" />
    },
    {
      id: 'raison',
      title: 'Raison de la consultation',
      subtitle: 'Quelle est la principale raison qui vous amène à consulter aujourd\'hui ?',
      type: 'multiselect',
      field: 'pathologies',
      options: PATHOLOGIES,
      icon: <Brain className="w-5 h-5" />
    },
    {
      id: 'preferences',
      title: 'Préférences concernant le thérapeute',
      subtitle: 'Avez-vous une préférence pour le genre de votre thérapeute ?',
      type: 'radio',
      field: 'sexPref',
      options: ['Une femme', 'Un homme', 'Peu importe'],
      icon: <UserCheck className="w-5 h-5" />
    },
    {
      id: 'sensibilite',
      title: 'Sensibilité particulière',
      subtitle: 'Souhaitez-vous un thérapeute qui partage une sensibilité particulière (ex: religion, approche culturelle) ?',
      type: 'radio',
      field: 'sensibiliteCulturelle',
      options: ['Oui, c\'est important pour moi', 'Non, ce n\'est pas nécessaire', 'Je ne sais pas'],
      icon: <Shield className="w-5 h-5" />
    },
    {
      id: 'langues',
      title: 'Communication et Langues',
      subtitle: 'Dans quelle(s) langue(s) préférez-vous échanger durant vos séances ?',
      type: 'multiselect',
      field: 'langues',
      options: LANGUES,
      icon: <Languages className="w-5 h-5" />
    },
    {
      id: 'mode',
      title: 'Mode de consultation',
      subtitle: 'Quel mode de consultation privilégiez-vous ?',
      type: 'multiselect',
      field: 'modeConsultation',
      options: ['Visioconférence', 'Appel audio uniquement', 'Présentiel'],
      icon: <Video className="w-5 h-5" />
    },
    {
      id: 'experience',
      title: 'Expérience passée',
      subtitle: 'Avez-vous déjà suivi une thérapie par le passé ?',
      type: 'radio',
      field: 'experiencePassee',
      options: [
        'Oui, j\'ai eu une expérience positive',
        'Oui, mais l\'expérience n\'était pas satisfaisante',
        'Non, c\'est ma première fois',
        'Je ne sais pas'
      ],
      icon: <History className="w-5 h-5" />
    },
    {
      id: 'disponibilites',
      title: 'Disponibilités',
      subtitle: 'À quels moments de la journée êtes-vous généralement disponible ?',
      type: 'multiselect',
      field: 'disponibilites',
      options: TEMPS_PREF,
      icon: <Clock className="w-5 h-5" />
    },
    {
      id: 'attentes',
      title: 'Attentes vis-à-vis de la thérapie',
      subtitle: 'Que recherchez-vous principalement chez un thérapeute ?',
      type: 'radio',
      field: 'attentes',
      options: [
        'Quelqu\'un qui m\'écoute activement sans trop intervenir',
        'Quelqu\'un qui me donne des exercices et des outils concrets',
        'Quelqu\'un qui m\'aide à comprendre mon passé en profondeur',
        'Je ne sais pas encore'
      ],
      icon: <Target className="w-5 h-5" />
    },
    {
      id: 'profile',
      title: 'Informations Personnelles',
      subtitle: 'Afin de mieux personnaliser votre dossier',
      type: 'profile',
      field: 'profile',
      options: [],
      icon: <UserCheck className="w-5 h-5" />
    },
    {
      id: 'registration',
      title: 'Création de compte',
      subtitle: 'Dernière étape ! Créez vos identifiants pour sauvegarder votre profil.',
      type: 'registration',
      field: 'registration',
      options: [],
      icon: <UserCheck className="w-5 h-5" />
    }
  ];

  const therapistQuestions = [
    {
      id: 'localisation',
      title: 'Informations Géographiques',
      subtitle: 'Dans quelle wilaya êtes-vous basé(e) ?',
      type: 'select',
      field: 'wilaya',
      options: [...WILAYAS_ALG, 'Je consulte exclusivement en ligne'],
      icon: <MapPin className="w-5 h-5" />
    },
    {
      id: 'expertise',
      title: 'Domaines d\'Expertise',
      subtitle: 'Quelles sont vos principales spécialités cliniques ?',
      type: 'multiselect',
      field: 'pathologies',
      options: PATHOLOGIES,
      icon: <Brain className="w-5 h-5" />
    },
    {
      id: 'identite',
      title: 'Identité et Approche',
      subtitle: 'À quel genre vous identifiez-vous ?',
      type: 'radio',
      field: 'sexe',
      options: ['Femme', 'Homme', 'Autre'],
      icon: <UserCheck className="w-5 h-5" />
    },
    {
      id: 'sensibilite',
      title: 'Dimension Culturelle',
      subtitle: 'Comment gérez-vous la dimension culturelle ou religieuse ?',
      type: 'radio',
      field: 'sensibiliteCulturelle',
      options: [
        'J\'intègre explicitement ces dimensions à la demande',
        'Mon approche est strictement laïque et neutre',
        'Autre'
      ],
      icon: <Shield className="w-5 h-5" />
    },
    {
      id: 'langues',
      title: 'Langues de travail',
      subtitle: 'Dans quelle(s) langue(s) pouvez-vous mener une séance ?',
      type: 'multiselect',
      field: 'langues',
      options: LANGUES,
      icon: <Languages className="w-5 h-5" />
    },
    {
      id: 'modes',
      title: 'Modes de consultation',
      subtitle: 'Quels modes de consultation proposez-vous ?',
      type: 'multiselect',
      field: 'modeConsultation',
      options: ['Visioconférence', 'Appel audio uniquement', 'Présentiel'],
      icon: <Video className="w-5 h-5" />
    },
    {
      id: 'approche',
      title: 'Méthodologie',
      subtitle: 'Quelle est votre approche thérapeutique principale ?',
      type: 'radio',
      field: 'approchePrincipale',
      options: [
        'TCC (Exercices et outils concrets)',
        'Psychanalyse / Psychodynamique (Exploration du passé)',
        'Humaniste / Gestalt (Écoute active)',
        'Approche intégrative (Mélange)'
      ],
      icon: <Stethoscope className="w-5 h-5" />
    },
    {
      id: 'public',
      title: 'Public Cible',
      subtitle: 'Avec quels publics préférez-vous travailler ?',
      type: 'multiselect',
      field: 'publicCible',
      options: ['Enfants / Adolescents', 'Adultes', 'Couples', 'Personnes âgées', 'Tous publics'],
      icon: <Users className="w-5 h-5" />
    },
    {
      id: 'disponibilites',
      title: 'Créneaux horaires',
      subtitle: 'Quels sont vos créneaux habituels ?',
      type: 'multiselect',
      field: 'disponibilites',
      options: TEMPS_PREF,
      icon: <Clock className="w-5 h-5" />
    },
    {
      id: 'registration',
      title: 'Création de compte',
      subtitle: 'Dernière étape ! Identifiez-vous en tant que professionnel.',
      type: 'registration',
      field: 'registration',
      options: [],
      icon: <UserCheck className="w-5 h-5" />
    }
  ];

  const questions = role === 'PATIENT' ? patientQuestions : therapistQuestions;
  const getQuestionOptions = (field) => questions.find(question => question.field === field)?.options || [];
  const getSingleChoiceCode = (field, codes) => codes[getQuestionOptions(field).indexOf(formData[field])];
  const getMultipleChoiceCodes = (field, codes) => (
    formData[field].map(value => codes[getQuestionOptions(field).indexOf(value)]).filter(Boolean)
  );

  const nextStep = async () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      // Final step - register user
      await handleRegistration();
    }
  };

  const handleRegistration = async () => {
    setIsRegistering(true);
    setRegistrationError('');

    try {
      const account = {
        name: `${formData.prenom} ${formData.nom}`,
        email: formData.email,
        password: formData.motDePasse,
      };
      const commonMatching = {
        pathologies: getMultipleChoiceCodes('pathologies', PATHOLOGY_CODES),
        languages: getMultipleChoiceCodes('langues', LANGUAGE_CODES),
        consultationModes: getMultipleChoiceCodes('modeConsultation', CONSULTATION_MODE_CODES),
        timeSlots: getMultipleChoiceCodes('disponibilites', TIME_SLOT_CODES),
      };
      const registrationData = role === 'PATIENT'
        ? {
            role : 'PATIENT',
            account,
            profile: {
              dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString() : null,
              gender: formData.gender,
              phone: formData.phone,
              address: formData.address,
              wilaya: formData.wilaya,
              emergencyContact: formData.emergencyContact,
              emergencyPhone: formData.emergencyPhone
            },
            matching: {
              ...commonMatching,
              genrePref: getSingleChoiceCode('sexPref', PATIENT_GENDER_PREFERENCE_CODES),
              sensibilitePatient: getSingleChoiceCode('sensibiliteCulturelle', PATIENT_SENSITIVITY_CODES),
              experiencePassee: getSingleChoiceCode('experiencePassee', PATIENT_EXPERIENCE_CODES),
              attentesTherapie: getSingleChoiceCode('attentes', PATIENT_EXPECTATION_CODES),
            },
          }
        : {
            role : 'THERAPIST',
            account,
            profile: {
              gender: getSingleChoiceCode('sexe', THERAPIST_GENDER_CODES),
              documents: [],
            },
            matching: {
              ...commonMatching,
              sensibiliteTherapeute: getSingleChoiceCode('sensibiliteCulturelle', THERAPIST_SENSITIVITY_CODES),
              approcheTherapeute: getSingleChoiceCode('approchePrincipale', THERAPIST_APPROACH_CODES),
              publicTypes: getMultipleChoiceCodes('publicCible', PUBLIC_TYPE_CODES),
            },
          };

      const response = await auth.register(registrationData);
      setToken(response.data.token);

      // Refresh AuthContext so the React state (`user`, `isAuthenticated`)
      // matches the freshly-stored session token. Without this, the
      // very next navigation to a protected page (PATIENT) would see
      // `isAuthenticated = Boolean(token && user) === false` and bounce
      // the user back to LOGIN. We also catch the error so a transient
      // /auth/me failure (e.g. Neon cold start) does not block the
      // user from seeing the Success screen.
      try {
        await refreshAuth();
      } catch (refreshErr) {
        // eslint-disable-next-line no-console
        console.warn('[Registration] refreshAuth after register failed', {
          message: refreshErr?.message,
        });
      }

      if (role === 'THERAPIST') {
        setMode('UPLOAD');
      } else {
        setMode('SUCCESS');
      }
      setIsRegistering(false);
    } catch (err) {
      setRegistrationError(err.message || 'Erreur lors de l\'inscription');
      setIsRegistering(false);
    }
  };

  const handleFileUpload = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).map(f => ({
        name: f.name,
        type: f.type,
        file: f,
        size: f.size,
      }));
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      setMode('LANDING');
      setRole(null);
    }
  };

  const handleSelection = (val) => {
    const currentQuestion = questions[step];
    if (currentQuestion.type === 'multiselect') {
      const current = formData[currentQuestion.field];
      if (current.includes(val)) {
        setFormData({ ...formData, [currentQuestion.field]: current.filter(v => v !== val) });
      } else {
        setFormData({ ...formData, [currentQuestion.field]: [...current, val] });
      }
    } else {
      setFormData({ ...formData, [currentQuestion.field]: val });
    }
  };

  /**
   * Fetch matched therapists from the real backend API
   * Called when the user clicks "Voir mes correspondances"
   */
  const handleFetchMatches = useCallback(async () => {
    setResultsLoading(true);
    setResultsError('');
    
    try {
      const response = await apiCall('/patients/matched-therapists', {
        method: 'GET',
      });
      
      if (response.success && Array.isArray(response.data)) {
        setMatches(response.data);
      } else {
        setMatches([]);
      }
    } catch (err) {
      setResultsError(err.message || 'Erreur lors de la récupération des correspondances');
      setMatches([]);
    } finally {
      setResultsLoading(false);
    }
  }, []);

  /**
   * Confirm therapist selection - calls backend API
   * Uses currentTherapistId (the actual field name in the database)
   */
  const handleConfirmTherapist = useCallback(async (therapist) => {
    setConfirmLoading(true);
    setConfirmError('');
    setConfirmSuccess(false);

    try {
      const response = await apiCall('/patients/select-therapist', {
        method: 'POST',
        body: JSON.stringify({ therapistId: therapist.id }),
      });

      if (response.success) {
        setConfirmSuccess(true);
        // After successful confirmation, navigate to patient panel
        setTimeout(() => {
          onNavigateToPage('PATIENT', { 
            therapist: {
              ...therapist,
              name: therapist.name,
              speciality: therapist.approcheTherapeute,
            }
          });
        }, 1000);
      }
    } catch (err) {
      setConfirmError(err.message || 'Erreur lors de la confirmation');
    } finally {
      setConfirmLoading(false);
    }
  }, [onNavigateToPage]);

  return (
    <div className="min-h-screen bg-bg-main text-text-main font-sans selection:bg-primary-light">
      <Header 
        onLogin={onNavigateToLogin} 
        onAbout={() => onNavigateToPage('ABOUT')}
        onHome={() => onNavigateToPage('REGISTRATION')}
        onNavigateToPage={onNavigateToPage}
      />

      <main className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {mode === 'LANDING' && (
            <Landing 
              onSelectRole={(r) => { setRole(r); setMode('QUESTIONNAIRE'); setStep(0); }} 
            />
          )}

          {mode === 'QUESTIONNAIRE' && (
            <Questionnaire 
              questions={questions}
              step={step}
              formData={formData}
              onSelection={handleSelection}
              onPrev={prevStep}
              onNext={nextStep}
              onUpdateFormData={(updates) => setFormData({ ...formData, ...updates })}
              role={role}
              isLoading={isRegistering}
              error={registrationError}
            />
          )}

          {mode === 'UPLOAD' && (
            <Upload 
              uploadedFiles={uploadedFiles}
              onFileUpload={handleFileUpload}
              onRemoveFile={handleRemoveFile}
              onComplete={() => setMode('SUCCESS')}
            />
          )}

          {mode === 'SUCCESS' && (
            <Success 
              role={role}
              userName={formData.prenom}
              onNext={() => {
                setMode('RESULTS');
                handleFetchMatches();
              }}
              onHome={() => { setMode('LANDING'); setRole(null); }}
            />
          )}

          {mode === 'RESULTS' && (
            <Results 
              role={role}
              matches={matches}
              loading={resultsLoading}
              error={resultsError}
              onHome={() => { setMode('LANDING'); setRole(null); }}
              onSelectTherapist={(therapist) => {
                setSelectedTherapist(therapist);
                setMode('PROFILE');
              }}
            />
          )}

          {mode === 'PROFILE' && (
            <TherapistProfile 
              therapist={selectedTherapist}
              onBack={() => setMode('RESULTS')}
              onConfirm={handleConfirmTherapist}
              confirmLoading={confirmLoading}
              confirmError={confirmError}
              confirmSuccess={confirmSuccess}
            />
          )}
        </AnimatePresence>
      </main>

      <Footer onNavigate={onNavigateToPage} />
    </div>
  );
}