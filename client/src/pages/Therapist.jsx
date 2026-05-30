import { useState, useEffect, useMemo, Component, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  MessageSquare, 
  Check, 
  X, 
  Settings, 
  LogOut, 
  Search,
  Bell,
  Clock,
  ChevronRight,
  Shield,
  Star,
  Menu,
  ArrowLeft,
  Video,
  Phone,
  MapPin,
  Mail,
  User,
  Trash2,
  Plus,
  History,
  FileText,
  Filter,
  ArrowUpDown,
  Camera
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ChatWidget from '../components/ChatWidget';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Therapist component crash caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-main flex items-center justify-center p-6 text-center">
          <div className="bg-card-bg border border-border-color p-8 rounded-3xl max-w-md shadow-xl text-left">
            <h2 className="text-xl font-bold text-text-main mb-2">Une erreur est survenue</h2>
            <p className="text-sm text-text-muted mb-6">
              L'interface du praticien a rencontré un problème inattendu.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary text-white text-xs font-extrabold uppercase tracking-wider rounded-xl hover:scale-105 transition-all shadow-md shadow-primary/20 cursor-pointer"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Therapist(props) {
  return (
    <ErrorBoundary>
      <TherapistContent {...props} />
    </ErrorBoundary>
  );
}

function TherapistContent({ onNavigateToPage }) {
  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'appointments', 'history', 'settings'
  const [selectedClient, setSelectedClient] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // States and hooks for Profile Picture
  const [avatarUrl, setAvatarUrl] = useState(() => {
    return localStorage.getItem('therapist_avatar') || '';
  });
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [tempFile, setTempFile] = useState(null);
  const [tempPreview, setTempPreview] = useState(null);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAvatarError('');

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setAvatarError("Fichier invalide. Veuillez sélectionner une image au format JPG, PNG ou WEBP.");
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setAvatarError("Image trop volumineuse. La taille maximale autorisée est de 5 Mo.");
      return;
    }

    setTempFile(file);
    const objectUrl = URL.createObjectURL(file);
    setTempPreview(objectUrl);
  };

  const handleSaveAvatar = () => {
    if (!tempFile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setAvatarUrl(base64String);
      localStorage.setItem('therapist_avatar', base64String);
      
      setTempFile(null);
      if (tempPreview) {
        URL.revokeObjectURL(tempPreview);
        setTempPreview(null);
      }
      setIsAvatarModalOpen(false);
    };
    reader.readAsDataURL(tempFile);
  };

  const handleDeleteAvatar = () => {
    setAvatarUrl('');
    localStorage.removeItem('therapist_avatar');
    setTempFile(null);
    if (tempPreview) {
      URL.revokeObjectURL(tempPreview);
      setTempPreview(null);
    }
    setAvatarError('');
    setIsAvatarModalOpen(false);
  };

  useEffect(() => {
    return () => {
      if (tempPreview) {
        URL.revokeObjectURL(tempPreview);
      }
    };
  }, [tempPreview]);

  // Dynamic state for session history
  const [sessions, setSessions] = useState(() => {
    const stored = localStorage.getItem('app_sessions');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    }
    const defaultSessions = [
      { 
        id: 1, 
        patientName: 'Walid Ben.',
        therapistName: 'Dr. Amine B.',
        date: '28 Avril 2024', 
        duration: '45 min', 
        rating: 5, 
        rated: true,
        note: 'Excellente séance, très apaisante.',
        status: 'Terminée',
        report: {
          summary: "Discussion approfondie sur les déclenchurs d'anxiété professionnelle. Le patient a identifié des schémas de pensée automatiques liés à la performance.",
          homework: "Pratiquer l'exercice de respiration 4-7-8 avant les réunions importantes.",
          nextGoals: ["Gestion des limites", "Techniques d'ancrage"]
        }
      },
      { 
        id: 2, 
        patientName: 'Walid Ben.',
        therapistName: 'Dr. Amine B.',
        date: '21 Avril 2024', 
        duration: '50 min', 
        rating: 4, 
        rated: true,
        note: 'Bon échange sur la gestion du stress.',
        status: 'Terminée',
        report: {
          summary: "Introduction aux concepts de pleine conscience. Analyse des épisodes de stress de la semaine passée.",
          homework: "Journalisation des émotions quotidiennes.",
          nextGoals: ["Identification des besoins", "Auto-compassion"]
        }
      },
      { 
        id: 3, 
        patientName: 'Walid Ben.',
        therapistName: 'Dr. Amine B.',
        date: '14 Avril 2024', 
        duration: '45 min', 
        rating: 5, 
        rated: true,
        note: 'Première séance très prometteuse.',
        status: 'Terminée',
        report: {
          summary: "Établissement de l'alliance thérapeutique. Définition des objectifs à court et long terme.",
          homework: "Réflexion sur les attentes vis-à-vis de la thérapie.",
          nextGoals: ["Anamnèse", "Planification"]
        }
      },
      {
        id: 4,
        patientName: 'Walid Ben.',
        therapistName: 'Dr. Amine B.',
        date: '15 Mai 2024',
        duration: '45 min',
        rating: 0,
        rated: false,
        note: '',
        status: 'Terminée',
        report: {
          summary: "Travail approfondi sur la restructuration cognitive. Exercices pratiques de relaxation et gestion des émotions.",
          homework: "Prendre 5 minutes de pause toutes les 2 heures.",
          nextGoals: ["Amélioration du sommeil", "Routine bien-être"]
        }
      }
    ];
    localStorage.setItem('app_sessions', JSON.stringify(defaultSessions));
    return defaultSessions;
  });

  // Listener to keep sessions up-to-date in real-time when switching tabs
  useEffect(() => {
    const handleSync = () => {
      const stored = localStorage.getItem('app_sessions');
      if (stored) {
        try {
          setSessions(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    };
    window.addEventListener('storage', handleSync);
    // Sync immediately on focus/active changes
    handleSync();
    return () => window.removeEventListener('storage', handleSync);
  }, [activeTab]);

  // Therapist Historique search, filter and sorting states
  const [sessionSearch, setSessionSearch] = useState('');
  const [selectedPatientFilter, setSelectedPatientFilter] = useState('ALL');
  const [sessionSort, setSessionSort] = useState('date-desc'); // 'date-desc', 'date-asc', 'patient-asc', 'rating-desc'
  const [selectedSessionDetails, setSelectedSessionDetails] = useState(null);

  // Create session report modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSessionData, setNewSessionData] = useState({
    patientName: 'Walid Ben.',
    date: '',
    duration: '45 min',
    summary: '',
    homework: '',
    nextGoals: ['', '', ''],
  });

  // Calculate overall dynamic rating
  const therapistStats = useMemo(() => {
    // Collect all rated sessions across all patients
    const rated = sessions.filter(s => s.rated && s.rating > 0);
    const count = rated.length;
    const totalStars = rated.reduce((acc, s) => acc + s.rating, 0);
    // Baseline if empty is 4.9 from 1240 sessions
    const baselineReviewsCount = 45;
    const baselineStarsTotal = 45 * 4.9;
    
    const combinedCount = count + baselineReviewsCount;
    const combinedStars = totalStars + baselineStarsTotal;
    const average = (combinedStars / combinedCount).toFixed(1);
    
    return {
      averageRating: parseFloat(average),
      totalRatings: combinedCount,
      liveReviewsOnly: rated
    };
  }, [sessions]);

  // Close sidebar by default on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const mockClients = [
    { id: 1, name: "Walid Ben.", lastMsg: "Je me sens un peu anxieux...", time: "10:05", unread: 2, status: "online" },
    { id: 2, name: "Amine K.", lastMsg: "Merci pour la séance d'hier.", time: "Hier", unread: 0, status: "offline" },
    { id: 3, name: "Sonia M.", lastMsg: "À quelle heure pour demain ?", time: "Hier", unread: 0, status: "online" },
    { id: 4, name: "Yacine R.", lastMsg: "C'est difficile en ce moment.", time: "Lun", unread: 5, status: "offline" },
  ];

  const [requests, setRequests] = useState([
    { 
      id: 1, 
      name: "Karima L.", 
      type: "Nouvelle Consultation", 
      time: "Aujourd'hui, 14:30", 
      avatar: "KL",
      consultationType: "Appel vidéo",
      motif: "Bonjour Docteur, je traverse une période de stress intense liée à mon travail et j'aimerais commencer un accompagnement pour apprendre à gérer mon anxiété au quotidien.",
      email: "karima.l@example.com",
      phone: "0554 23 89 01"
    },
    { 
      id: 2, 
      name: "Omar D.", 
      type: "Suivi mensuel", 
      time: "Demain, 10:00", 
      avatar: "OD",
      consultationType: "Cabinet",
      motif: "Faire le point mensuel sur mon traitement et sur les exercices de méditation recommandée. Les attaques de panique ont diminué.",
      email: "omar.d@example.com",
      phone: "0661 12 34 56"
    },
  ]);

  const [selectedRequest, setSelectedRequest] = useState(null);

  // Month-Year Navigation State
  const [currentMonth, setCurrentMonth] = useState(4); // 4 = Mai (0-indexed)
  const [currentYear, setCurrentYear] = useState(2026);

  const monthNamesFr = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  // Calendar scheduler state (now date-based YYYY-MM-DD)
  const [calendarAppointments, setCalendarAppointments] = useState([
    { id: 101, date: "2026-05-08", time: "10:00", patient: "Walid", colorBg: "bg-primary text-white" },
    { id: 102, date: "2026-05-11", time: "14:30", patient: "Sonia", colorBg: "bg-indigo-500 text-white" },
    { id: 103, date: "2026-05-18", time: "16:00", patient: "Amine", colorBg: "bg-pink-500 text-white" },
  ]);
  const [selectedDateStr, setSelectedDateStr] = useState(null);
  const [selectedViewAppointment, setSelectedViewAppointment] = useState(null);
  
  // Custom slots & availability state mapped by "YYYY-MM-DD"
  const [dayAvailabilities, setDayAvailabilities] = useState({
    "2026-05-08": { available: true, slots: [{ from: "09:00", to: "12:00" }, { from: "14:00", to: "18:00" }] },
    "2026-05-11": { available: true, slots: [{ from: "09:00", to: "12:00" }, { from: "14:00", to: "18:00" }] },
    "2026-05-18": { available: true, slots: [{ from: "14:00", to: "17:00" }] },
    "2026-05-13": { available: false, slots: [] },
  });

  const [newAppointmentPatient, setNewAppointmentPatient] = useState('');
  const [newAppointmentTime, setNewAppointmentTime] = useState('10:00');
  const [newAppointmentColor, setNewAppointmentColor] = useState('bg-primary text-white');

  // Input states for adding new slots
  const [newSlotFrom, setNewSlotFrom] = useState('09:00');
  const [newSlotTo, setNewSlotTo] = useState('12:00');
  const [slotError, setSlotError] = useState('');

  // Helper helper to get day availability (falls back to weekday defaults if empty)
  const getDayAvailability = (dateStr) => {
    if (dayAvailabilities[dateStr]) {
      return dayAvailabilities[dateStr];
    }
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    return {
      available: !isWeekend,
      slots: isWeekend ? [] : [
        { from: "09:00", to: "12:00" },
        { from: "14:00", to: "18:00" }
      ]
    };
  };

  const handleToggleAvailability = (dateStr) => {
    const currentAvail = getDayAvailability(dateStr);
    setDayAvailabilities(prev => ({
      ...prev,
      [dateStr]: {
        ...currentAvail,
        available: !currentAvail.available
      }
    }));
  };

  const handleAddSlot = (dateStr, from, to) => {
    if (!from || !to) return;
    if (from >= to) {
      setSlotError("L'heure de début doit être antérieure à l'heure de fin.");
      return;
    }
    setSlotError('');
    const currentAvail = getDayAvailability(dateStr);
    const updatedSlots = [...currentAvail.slots, { from, to }].sort((a, b) => a.from.localeCompare(b.from));
    
    setDayAvailabilities(prev => ({
      ...prev,
      [dateStr]: {
        ...currentAvail,
        slots: updatedSlots
      }
    }));
  };

  const handleDeleteSlot = (dateStr, index) => {
    const currentAvail = getDayAvailability(dateStr);
    const updatedSlots = currentAvail.slots.filter((_, idx) => idx !== index);
    
    setDayAvailabilities(prev => ({
      ...prev,
      [dateStr]: {
        ...currentAvail,
        slots: updatedSlots
      }
    }));
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => {
      if (prev === 0) {
        setCurrentYear(y => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      if (prev === 11) {
        setCurrentYear(y => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleAddAppointment = (e) => {
    if (e) e.preventDefault();
    if (!newAppointmentPatient.trim() || !newAppointmentTime || !selectedDateStr) return;

    const newApp = {
      id: Date.now(),
      date: selectedDateStr,
      time: newAppointmentTime,
      patient: newAppointmentPatient.trim(),
      colorBg: newAppointmentColor
    };

    setCalendarAppointments(prev => [...prev, newApp]);
    setNewAppointmentPatient('');
  };

  const handleDeleteAppointment = (id) => {
    setCalendarAppointments(prev => prev.filter(app => app.id !== id));
    setSelectedViewAppointment(null);
  };

  // Handle escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedRequest(null);
        setSelectedDateStr(null);
        setSelectedViewAppointment(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAcceptByRequestIndex = (id, e) => {
    if (e) e.stopPropagation();
    setRequests(prev => prev.filter(req => req.id !== id));
    if (selectedRequest?.id === id) {
      setSelectedRequest(null);
    }
  };

  const handleRejectByRequestIndex = (id, e) => {
    if (e) e.stopPropagation();
    setRequests(prev => prev.filter(req => req.id !== id));
    if (selectedRequest?.id === id) {
      setSelectedRequest(null);
    }
  };

  const therapistData = {
    name: "Dr. Meriem",
    speciality: "Psychologue Clinicienne",
    rating: therapistStats.averageRating,
    sessions: therapistStats.totalRatings,
    online: true,
    avatarUrl: avatarUrl
  };

  const handleLogout = () => {
    onNavigateToPage('LANDING');
  };

  return (
    <div className="min-h-screen bg-bg-main flex flex-col transition-colors overflow-hidden h-screen">
      <Header 
        onHome={() => onNavigateToPage('LANDING')}
        onNavigateToPage={onNavigateToPage}
        onLogout={handleLogout}
        user={therapistData}
      />

      <div className="flex-1 flex pt-16 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-40
          bg-card-bg border-r border-border-color flex flex-col transition-all duration-300 ease-in-out h-full
          ${isSidebarOpen ? 'translate-x-0 w-80 shadow-2xl md:shadow-none' : '-translate-x-full md:translate-x-0 md:w-20'}
        `}>
          <div className={`p-4 border-b border-border-color flex items-center transition-all duration-300 ${isSidebarOpen ? 'justify-between py-5' : 'md:justify-center md:py-4'}`}>
            <h2 className={`font-bold text-lg transition-all duration-300 ${isSidebarOpen ? 'opacity-100 scale-100 w-auto' : 'opacity-0 scale-90 md:w-0 md:h-0 md:overflow-hidden md:p-0'}`}>Tableau de bord</h2>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-bg-main rounded-xl text-text-muted transition-colors cursor-pointer"
            >
              <Menu size={20} />
            </button>
          </div>
          
          <div className={`transition-all duration-300 border-b border-border-color overflow-hidden ${isSidebarOpen ? 'p-4 h-auto opacity-100' : 'md:h-0 md:p-0 md:opacity-0 md:border-b-0 md:pointer-events-none'}`}>
            <div className={`relative transition-all duration-300 ${!isSidebarOpen && 'md:opacity-0 md:scale-90'}`}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input 
                type="text" 
                placeholder="Rechercher..."
                className="w-full pl-10 pr-4 py-2 bg-bg-main border border-border-color rounded-xl text-xs outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
             <div className={`transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'mb-2 px-3 py-2 h-auto opacity-100' : 'md:h-0 md:p-0 md:mb-0 md:opacity-0 md:pointer-events-none'}`}>
                <span className={`text-[10px] font-black uppercase text-text-muted tracking-widest transition-opacity duration-300 ${!isSidebarOpen && 'md:opacity-0'}`}>Navigation</span>
             </div>
             
             <button 
                onClick={() => setActiveTab('chats')}
                className={`w-full flex items-center rounded-xl font-bold text-sm transition-all group overflow-hidden ${activeTab === 'chats' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:bg-bg-main'} ${isSidebarOpen ? 'p-3 gap-3' : 'p-3 md:justify-center md:gap-0'}`}
              >
                <div className="shrink-0"><MessageSquare size={20} /></div>
                <span className={`transition-all duration-300 whitespace-nowrap ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 md:w-0 md:h-0 md:overflow-hidden md:ml-0'}`}>Consultations</span>
              </button>
              
              <button 
                 onClick={() => setActiveTab('appointments')}
                 className={`w-full flex items-center rounded-xl font-bold text-sm transition-all group overflow-hidden ${activeTab === 'appointments' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:bg-bg-main'} ${isSidebarOpen ? 'p-3 gap-3' : 'p-3 md:justify-center md:gap-0'}`}
              >
                <div className="shrink-0"><Calendar size={20} /></div>
                <span className={`transition-all duration-300 whitespace-nowrap ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 md:w-0 md:h-0 md:overflow-hidden md:ml-0'}`}>Rendez-vous</span>
              </button>
              
              <button 
                 onClick={() => setActiveTab('history')}
                 className={`w-full flex items-center rounded-xl font-bold text-sm transition-all group overflow-hidden ${activeTab === 'history' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:bg-bg-main'} ${isSidebarOpen ? 'p-3 gap-3' : 'p-3 md:justify-center md:gap-0'}`}
              >
                <div className="shrink-0"><History size={20} /></div>
                <span className={`transition-all duration-300 whitespace-nowrap ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 md:w-0 md:h-0 md:overflow-hidden md:ml-0'}`}>Historique</span>
              </button>

              <button 
                 onClick={() => setActiveTab('settings')}
                 className={`w-full flex items-center rounded-xl font-bold text-sm transition-all group overflow-hidden ${activeTab === 'settings' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:bg-bg-main'} ${isSidebarOpen ? 'p-3 gap-3' : 'p-3 md:justify-center md:gap-0'}`}
              >
                <div className="shrink-0"><Settings size={20} /></div>
                <span className={`transition-all duration-300 whitespace-nowrap ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 md:w-0 md:h-0 md:overflow-hidden md:ml-0'}`}>Mon Profil</span>
              </button>

             <div className={`transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'mt-6 mb-2 px-3 py-2 h-auto opacity-100' : 'md:h-0 md:p-0 md:mt-0 md:mb-0 md:opacity-0 md:pointer-events-none'}`}>
                <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">Clients Actifs</span>
             </div>
             
            {mockClients.map(client => (
              <button
                key={client.id}
                onClick={() => {
                  setSelectedClient(client);
                  setActiveTab('chats');
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center rounded-xl transition-all cursor-pointer group
                  ${selectedClient?.id === client.id && activeTab === 'chats' ? 'bg-primary-light text-primary border border-primary/20' : 'hover:bg-bg-main border border-transparent'}
                  ${isSidebarOpen ? 'p-3 gap-3' : 'p-3 md:justify-center md:gap-0'}
                `}
              >
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs bg-card-bg border border-border-color shadow-sm">
                    {client.name.split(' ')[0][0]}{client.name.split(' ')[1][0]}
                  </div>
                  {client.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card-bg rounded-full"></div>
                  )}
                </div>
                
                <div className={`flex-1 text-left min-w-0 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 md:w-0 md:h-0 md:overflow-hidden'}`}>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold text-sm truncate">{client.name}</span>
                    <span className="text-[9px] text-text-muted">{client.time}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs truncate text-text-muted">{client.lastMsg}</p>
                    {client.unread > 0 && (
                      <span className="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        {client.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 h-full overflow-hidden flex flex-col bg-bg-main/30">
          {/* Top Mobile Bar */}
          {(!selectedClient || activeTab !== 'chats') && (
            <div className="md:hidden p-3 bg-card-bg border-b border-border-color flex items-center justify-between sticky top-0 z-20">
               <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-bg-main rounded-xl">
                 <Menu size={20} />
               </button>
               <span className="font-bold text-sm">Tableau de bord</span>
               <button className="p-2 hover:bg-bg-main rounded-xl text-primary">
                  <Bell size={20} />
               </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden relative h-full">
             <AnimatePresence mode="wait">
               {activeTab === 'chats' && (
                 <motion.div 
                   key="chats-view"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="h-full flex flex-col p-0 md:p-4"
                 >
                   {selectedClient ? (
                     <ChatWidget 
                       onBack={() => setSelectedClient(null)}
                       therapist={{ name: selectedClient.name }} 
                       initialMessages={[
                         { id: 1, text: "Bonjour Walid, comment s'est passée votre semaine ?", sender: 'therapist', time: '10:00' },
                         { id: 2, text: selectedClient.lastMsg, sender: 'patient', time: selectedClient.time }
                       ]}
                     />
                   ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-center p-12 h-full">
                       <div className="w-24 h-24 bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center mb-6 shadow-inner">
                         <MessageSquare size={48} />
                       </div>
                       <h3 className="text-3xl font-black mb-3">Vos consultations</h3>
                       <p className="text-text-muted max-w-sm leading-relaxed font-medium">Sélectionnez un client dans la liste pour reprendre vos échanges en cours.</p>
                     </div>
                   )}
                 </motion.div>
               )}

               {activeTab === 'appointments' && (
                 <motion.div 
                   key="appointments-view"
                   initial={{ opacity: 0, scale: 0.98 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.98 }}
                   className="p-4 md:p-12 overflow-y-auto h-full"
                 >
                   <div className="max-w-4xl mx-auto space-y-10">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                       <div>
                         <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1 text-text-main">Demandes de session</h2>
                         <p className="text-text-muted font-medium text-sm">Vous avez {requests.length} nouvelles invitations aujourd'hui.</p>
                       </div>
                       <div className="flex gap-2">
                         <button className="p-3 bg-card-bg border border-border-color rounded-xl text-primary hover:bg-primary-light transition-all flex items-center gap-2 font-bold text-sm shadow-sm group">
                           <Bell size={18} className="group-hover:rotate-12 transition-transform" />
                         </button>
                         <button className="p-3 bg-primary text-white rounded-xl hover:scale-105 transition-all flex items-center gap-2 font-bold text-sm shadow-xl shadow-primary/20">
                            Historique
                         </button>
                       </div>
                     </div>

                     <div className="grid gap-4">
                       {requests.length === 0 && (
                          <div className="p-10 text-center bg-card-bg border border-dashed border-border-color rounded-3xl flex flex-col items-center justify-center w-full shadow-inner bg-gradient-to-b from-primary/5 to-transparent">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                              <Check className="text-primary" size={24} />
                            </div>
                            <p className="text-xs font-extrabold text-text-main">Toutes les demandes de session ont été traitées !</p>
                            <p className="text-[10px] font-bold text-text-muted mt-1 uppercase tracking-wider">Vous êtes à jour dans vos suivis.</p>
                          </div>
                        )}
                        {requests.map(req => (
                         <div key={req.id} onClick={() => setSelectedRequest(req)} className="t-card flex flex-col sm:flex-row items-center justify-between gap-6 p-6 group hover:border-primary/40 transition-all border-dashed cursor-pointer bg-card-bg hover:shadow-md">
                           <div className="flex items-center gap-5 w-full sm:w-auto">
                             <div className="w-16 h-16 bg-primary-light text-primary rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-inner border border-primary/10">
                               {req.avatar}
                             </div>
                             <div>
                               <div className="flex items-center gap-2">
                                  <h4 className="font-extrabold text-xl">{req.name}</h4>
                                  <span className="text-[9px] font-black tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase shrink-0">
                                    {req.consultationType}
                                  </span>
                                </div>
                               <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-text-muted mt-2">
                                  <span className="flex items-center gap-1.5 text-primary bg-primary/10 px-2 py-1 rounded-lg">
                                    <Clock size={12} /> {req.time}
                                  </span>
                                  <span className="hidden sm:inline opacity-30">|</span>
                                  <span className="bg-bg-main px-2 py-1 rounded-lg border border-border-color">{req.type}</span>
                               </div>
                             </div>
                           </div>
                           <div className="flex items-center gap-3 w-full sm:w-auto">
                             <button onClick={(e) => handleAcceptByRequestIndex(req.id, e)} className="flex-1 sm:flex-none p-4 px-8 bg-green-500/10 text-green-600 rounded-2xl font-bold hover:bg-green-500 hover:text-white transition-all flex items-center justify-center gap-2 text-sm cursor-pointer">
                               <Check size={20} /> Accepter
                             </button>
                             <button onClick={(e) => handleRejectByRequestIndex(req.id, e)} className="flex-1 sm:flex-none p-4 px-8 bg-bg-main text-text-muted hover:text-red-600 rounded-2xl font-bold hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 text-sm border border-border-color cursor-pointer">
                               <X size={20} />
                             </button>
                           </div>
                         </div>
                       ))}
                     </div>

                     <div className="pt-10">
                        <div className="flex items-center justify-between mb-8">
                           <h3 className="text-2xl font-black tracking-tight">Planning & Disponibilités</h3>
                           <div className="flex gap-2">
                              <h4 className="text-base font-black text-primary px-4 py-2 bg-primary/10 rounded-2xl min-w-[150px] text-center border border-primary/20 mr-2 whitespace-nowrap">
                                 {monthNamesFr[currentMonth]} {currentYear}
                               </h4>
                               <div className="flex gap-1 border border-border-color rounded-xl p-1 bg-card-bg shadow-sm shrink-0">
                                  <button onClick={handlePrevMonth} className="p-2 hover:bg-bg-main border border-border-color rounded-lg text-text-muted hover:text-primary transition-all cursor-pointer" title="Mois précédent"><ChevronRight size={16} className="rotate-180" /></button>
                                  <button onClick={handleNextMonth} className="p-2 hover:bg-bg-main border border-border-color rounded-lg text-text-muted hover:text-primary transition-all cursor-pointer" title="Mois suivant"><ChevronRight size={16} /></button>
                               </div>
                           </div>
                        </div>
                       <div className="t-card p-0 overflow-hidden border-2 shadow-2xl">
                          <div className="grid grid-cols-7 border-b border-border-color bg-bg-main/50">
                             {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                               <div key={day} className="p-5 text-center text-[10px] font-black uppercase tracking-widest text-primary border-r border-border-color last:border-0">{day}</div>
                             ))}
                          </div>
                          <div className="grid grid-cols-7 bg-card-bg min-h-[30rem] h-auto">
                            {(() => {
                              const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                              const getStartDayIndex = (year, month) => {
                                const day = new Date(year, month, 1).getDay();
                                return day === 0 ? 6 : day - 1;
                              };
                              const startDayIndex = getStartDayIndex(currentYear, currentMonth);
                              const totalCells = startDayIndex + daysInCurrentMonth > 35 ? 42 : 35;

                              return Array.from({ length: totalCells }).map((_, i) => {
                              const isValidDay = (i - startDayIndex + 1) > 0 && (i - startDayIndex + 1) <= daysInCurrentMonth;
                              const dayNumber = isValidDay ? i - startDayIndex + 1 : null;
                              const cellDateStr = isValidDay ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}` : null;
                              const availability = isValidDay ? getDayAvailability(cellDateStr) : { available: false, slots: [] };
                              const dayAppointments = isValidDay ? calendarAppointments.filter(app => app.date === cellDateStr) : [];
                              return (
                                <div 
                                  key={i} 
                                  onClick={() => {
                                    if (isValidDay) {
                                      setSelectedDateStr(cellDateStr);
                                      setNewAppointmentPatient('');
                                      setNewAppointmentTime('10:00');
                                      setNewAppointmentColor('bg-primary text-white');
                                    }
                                  }}
                                  className={`p-2 border-r border-b border-border-color last:border-r-0 flex flex-col justify-between group transition-all relative select-none min-h-[7.5rem] ${
                                    isValidDay 
                                      ? availability.available
                                        ? 'cursor-pointer hover:bg-primary/[0.03] bg-card-bg' 
                                        : 'cursor-pointer bg-bg-main/40 text-text-muted/50 hover:bg-red-500/[0.01]' 
                                      : 'bg-bg-main/5 text-text-muted/15 pointer-events-none'
                                  }`}
                                >
                                  {isValidDay && !availability.available && (
                                    <div className="absolute inset-0 bg-red-500/[0.02] bg-[linear-gradient(45deg,rgba(0,0,0,0.015)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.015)_50%,rgba(0,0,0,0.015)_75%,transparent_75%,transparent)] bg-[length:12px_12px] pointer-events-none" />
                                  )}
                                  <div className="flex justify-between items-center w-full mb-1">
                                    <span className={`text-[10px] font-black ${
                                       isValidDay 
                                         ? availability.available 
                                           ? 'text-text-muted/60 group-hover:text-primary transition-colors' 
                                           : 'text-text-muted/30'
                                         : 'text-text-muted/15'
                                     }`}>
                                      {isValidDay ? dayNumber : ''}
                                    </span>
                                    {isValidDay && (
                                      <span className={`text-[8px] font-black tracking-wider opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded-md shrink-0 border uppercase ${
                                         availability.available 
                                           ? 'text-primary bg-primary/10 border-primary/20' 
                                           : 'text-amber-600 bg-amber-50 border-amber-200'
                                       }`}>
                                        {availability.available ? 'Gérer' : 'Activer'}
                                      </span>
                                    )}
                                  </div>

                                                                     {/* Slots display if active */}
                                   {isValidDay && availability.available && availability.slots.length > 0 && (
                                     <div className="flex flex-wrap gap-1 mb-1 opacity-90 justify-start max-h-[24px] overflow-hidden">
                                       {availability.slots.slice(0, 3).map((sl, index) => (
                                         <span key={index} className="text-[7px] font-black text-primary bg-primary/5 px-1 py-0.2 rounded border border-primary/15 whitespace-nowrap">
                                           {sl.from}
                                         </span>
                                       ))}
                                       {availability.slots.length > 3 && (
                                         <span className="text-[7px] font-black text-text-muted bg-bg-main px-1 py-0.2 rounded border border-border-color">
                                           +{availability.slots.length - 3}
                                         </span>
                                       )}
                                     </div>
                                   )}

                                   {/* Muted unavailable note if inactive */}
                                   {isValidDay && !availability.available && (
                                     <span className="text-[8px] font-black text-red-500/60 uppercase tracking-wider text-right block py-1">Indisponible</span>
                                   )}

                                   <div className="flex-1 flex flex-col gap-1 w-full overflow-y-auto scrollbar-none justify-end md:max-h-[70px]">
                                    {dayAppointments.map(app => (
                                      <div 
                                        key={app.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedViewAppointment(app);
                                        }}
                                        className={`w-full p-1 text-[9px] font-bold rounded-lg truncate shadow-sm flex items-center justify-between group/pill hover:scale-[1.02] active:scale-95 transition-all text-left ${app.colorBg}`}
                                        title={`${app.time} - ${app.patient} (Cliquer pour gérer)`}
                                      >
                                        <span className="truncate">{app.time} - {app.patient}</span>
                                        <span className="opacity-0 group-hover/pill:opacity-100 font-bold ml-1 hover:text-red-200 transition-opacity shrink-0">×</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                              });
                            })()}
                          </div>
                       </div>
                     </div>
                   </div>
                 </motion.div>
               )}

               {activeTab === 'history' && (
                 <motion.div 
                   key="history-view"
                   initial={{ opacity: 0, scale: 0.98 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.98 }}
                   className="flex-1 p-4 md:p-12 overflow-y-auto h-full text-left"
                 >
                   {!selectedSessionDetails ? (
                     <div className="max-w-5xl mx-auto space-y-8">
                       
                       {/* Title Section */}
                       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                         <div>
                           <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1 text-text-main">Historique des séances</h2>
                           <p className="text-text-muted font-medium text-sm">Suivez les dossiers de vos patients et gérez vos comptes-rendus.</p>
                         </div>
                         <button
                           onClick={() => setIsCreateModalOpen(true)}
                           className="p-4 px-6 bg-primary text-white font-extrabold text-xs tracking-wider uppercase rounded-2xl hover:scale-105 transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-primary/20 cursor-pointer text-left shrink-0"
                         >
                           <Plus size={18} /> Rédiger un compte rendu
                         </button>
                       </div>

                       {/* Global Therapist Rating Statistics Banner */}
                       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6 bg-gradient-to-br from-amber-500/5 via-amber-500/10 to-transparent rounded-[2rem] border border-amber-500/15 shadow-sm">
                         <div className="flex items-center gap-4">
                           <div className="p-3.5 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
                             <Star size={26} className="fill-current" />
                           </div>
                           <div>
                             <h3 className="text-lg font-bold text-text-main text-left font-bold">Statistiques & Évaluations globales</h3>
                             <p className="text-xs text-text-muted mt-0.5 font-semibold text-left">Toutes les notes de vos séances s'y répercutent automatiquement.</p>
                           </div>
                         </div>
                         <div className="flex items-baseline gap-2">
                           <span className="text-4xl font-extrabold text-amber-500 tracking-tight">{therapistStats.averageRating}</span>
                           <span className="text-xs font-black text-text-muted uppercase tracking-wider">/ 5 • ({therapistStats.totalRatings} évaluations reçues)</span>
                         </div>
                       </div>

                       {/* Search & Filtering Controls */}
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-card-bg border border-border-color rounded-2xl shadow-sm">
                         <div className="relative">
                           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                           <input 
                             type="text" 
                             placeholder="Rechercher par patient..."
                             value={sessionSearch}
                             onChange={(e) => setSessionSearch(e.target.value)}
                             className="w-full pl-10 pr-4 py-3 bg-bg-main border-2 border-border-color focus:border-primary rounded-xl text-xs font-bold outline-none text-text-main transition-colors"
                           />
                         </div>

                         <div className="flex items-center gap-2">
                           <Filter size={16} className="text-text-muted shrink-0 ml-1" />
                           <select 
                             value={selectedPatientFilter}
                             onChange={(e) => setSelectedPatientFilter(e.target.value)}
                             className="w-full p-3 bg-bg-main border-2 border-border-color focus:border-primary rounded-xl text-xs font-bold outline-none text-text-main transition-colors cursor-pointer"
                           >
                             <option value="ALL">Tous les patients</option>
                             <option value="Walid Ben.">Walid Ben.</option>
                             <option value="Amine K.">Amine K.</option>
                             <option value="Sonia M.">Sonia M.</option>
                             <option value="Yacine R.">Yacine R.</option>
                           </select>
                         </div>

                         <div className="flex items-center gap-2">
                           <ArrowUpDown size={16} className="text-text-muted shrink-0 ml-1" />
                           <select 
                             value={sessionSort}
                             onChange={(e) => setSessionSort(e.target.value)}
                             className="w-full p-3 bg-bg-main border-2 border-border-color focus:border-primary rounded-xl text-xs font-bold outline-none text-text-main transition-colors cursor-pointer"
                           >
                             <option value="date-desc">Plus récentes en premier</option>
                             <option value="date-asc">Plus anciennes</option>
                             <option value="patient-asc">Nom du patient (A-Z)</option>
                             <option value="rating-desc">Meilleures évaluations</option>
                           </select>
                         </div>
                       </div>

                       {/* Sessions Grid */}
                       <div className="grid gap-4 text-left">
                         {(() => {
                           const filtered = sessions.filter(s => {
                             const matchSearch = s.patientName?.toLowerCase().includes(sessionSearch.toLowerCase());
                             const matchSelect = selectedPatientFilter === 'ALL' || s.patientName === selectedPatientFilter;
                             return matchSearch && matchSelect;
                           }).sort((a, b) => {
                             if (sessionSort === 'date-desc') return b.id - a.id;
                             if (sessionSort === 'date-asc') return a.id - b.id;
                             if (sessionSort === 'patient-asc') return a.patientName?.localeCompare(b.patientName);
                             if (sessionSort === 'rating-desc') return (b.rating || 0) - (a.rating || 0);
                             return 0;
                           });

                           if (filtered.length === 0) {
                             return (
                               <div className="p-16 text-center bg-card-bg border border-dashed border-border-color rounded-3xl flex flex-col items-center justify-center w-full bg-gradient-to-br from-primary/5 to-transparent">
                                 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                   <History className="text-primary" size={24} />
                                 </div>
                                 <p className="text-sm font-bold text-text-main">Aucune séance dans l'historique</p>
                                 <p className="text-xs text-text-muted mt-1 font-medium">Modifiez vos filtres ou rédigez un nouveau compte rendu pour commencer.</p>
                                </div>
                             );
                           }

                           return filtered.map((session) => (
                             <div 
                               key={session.id}
                               onClick={() => setSelectedSessionDetails(session)}
                               className="t-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 group hover:translate-x-1.5 border-l-4 border-l-primary hover:border-r-0 hover:border-y-0.5 hover:border-r-0.5 transition-all cursor-pointer bg-card-bg border border-border-color/60 hover:shadow-md text-left"
                             >
                               <div className="flex items-center gap-4 w-full md:w-auto text-left">
                                 <div className="w-12 h-12 bg-primary/10 text-primary font-extrabold text-xs rounded-xl flex items-center justify-center border border-primary/10 select-none uppercase shadow-sm">
                                   {session.patientName?.split(' ').map(n=>n[0]).join('') || 'PA'}
                                 </div>
                                 <div className="text-left">
                                   <div className="flex flex-wrap items-center gap-2">
                                     <h4 className="font-extrabold text-base text-text-main">{session.patientName}</h4>
                                     <span className="text-[9px] font-black tracking-wider text-text-muted bg-bg-main border border-border-color px-2 py-0.5 rounded-full uppercase">
                                       Terminé
                                     </span>
                                   </div>
                                   <div className="flex items-center gap-3 text-[11px] font-bold text-text-muted mt-1 text-left">
                                     <span>Date: <span className="text-primary font-semibold">{session.date}</span></span>
                                     <span className="opacity-40">•</span>
                                     <span>Durée: {session.duration}</span>
                                   </div>
                                 </div>
                               </div>

                               <div className="p-3 bg-bg-main/60 rounded-xl max-w-sm w-full md:w-80 text-xs text-text-muted italic border border-border-color/40 leading-relaxed truncate font-semibold text-left">
                                 "{session.report?.summary || 'Pas de résumé.'}"
                                </div>

                               <div className="flex flex-col items-end gap-2 justify-between shrink-0 w-full md:w-auto mt-2 md:mt-0">
                                 <div>
                                   {session.rated ? (
                                     <div className="flex flex-col items-end gap-1">
                                       <div className="flex gap-1 text-amber-500">
                                         {[...Array(5)].map((_, i) => (
                                           <Star key={i} size={14} className={i < session.rating ? 'fill-current' : 'opacity-20'} />
                                         ))}
                                       </div>
                                       {session.note && (
                                         <span className="text-[9px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Avis laissé</span>
                                       )}
                                     </div>
                                   ) : (
                                     <span className="text-[10px] uppercase tracking-[0.08em] font-black text-text-muted/60 bg-bg-main px-2.5 py-1 rounded-full border border-border-color">Non évalué</span>
                                   )}
                                 </div>
                                 <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
                                   Voir compte rendu <ChevronRight size={10} />
                                 </span>
                               </div>
                             </div>
                           ));
                         })()}
                       </div>
                     </div>
                   ) : (
                     /* Detail screen */
                     <motion.div 
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       className="max-w-4xl mx-auto space-y-6 text-left animate-none"
                     >
                       <button 
                         onClick={() => setSelectedSessionDetails(null)}
                         className="flex items-center gap-2 text-primary font-extrabold text-sm hover:underline mb-4"
                       >
                         <ChevronRight size={18} className="rotate-180" /> Retour à la liste
                       </button>

                       <div className="t-card space-y-8 p-8 md:p-10 border border-primary/10 text-left">
                         
                         <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-border-color/80 text-left">
                           <div className="text-left">
                             <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-text-main pb-1 text-left">Détails du compte-rendu</h3>
                             <p className="text-primary font-bold text-sm text-left">Session clinique réalisée avec <span className="font-extrabold text-primary-dark">{selectedSessionDetails.patientName}</span></p>
                             <div className="flex items-center gap-3 text-xs text-text-muted mt-2 font-semibold text-left animate-none">
                               <span className="bg-bg-main px-2.5 py-1 rounded-lg border border-border-color">{selectedSessionDetails.date}</span>
                               <span className="bg-bg-main px-2.5 py-1 rounded-lg border border-border-color">{selectedSessionDetails.duration}</span>
                             </div>
                           </div>
                           
                           <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                             {selectedSessionDetails.rated ? (
                               <>
                                 <div className="flex gap-1 text-amber-500">
                                   {[...Array(5)].map((_, i) => (
                                     <Star key={i} size={18} className={i < selectedSessionDetails.rating ? 'fill-current' : 'opacity-20'} />
                                   ))}
                                 </div>
                                 <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider mt-1">Avis du Patient • {selectedSessionDetails.rating}/5</span>
                               </>
                             ) : (
                               <span className="text-[10px] uppercase font-black text-text-muted py-1 bg-bg-main border border-border-color px-3 rounded-full tracking-wider mt-1">Évaluation en attente</span>
                             )}
                           </div>
                         </div>

                         {selectedSessionDetails.rated && selectedSessionDetails.note && (
                           <div className="p-5 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-transparent rounded-2xl border-2 border-amber-500/15 text-left">
                             <h5 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                               <MessageSquare size={12} className="text-amber-500 fill-amber-500 animate-pulse" /> Commentaire laissé par le patient
                             </h5>
                             <p className="text-xs text-text-main italic font-black leading-relaxed">"{selectedSessionDetails.note}"</p>
                           </div>
                         )}

                         <div className="space-y-8 pt-2 text-left">
                           <div>
                             <h4 className="text-[10px] font-black uppercase tracking-wider text-primary mb-3.5 flex items-center gap-2 text-left">
                               <FileText className="w-3.5 h-3.5" /> Résumé clinique de la séance
                             </h4>
                             <p className="p-5 bg-bg-main/60 rounded-2xl border border-border-color text-sm font-semibold text-text-main leading-relaxed text-left">
                               {selectedSessionDetails.report?.summary || "Aucun résumé rédigé pour cette séance."}
                             </p>
                           </div>

                           <div className="grid sm:grid-cols-2 gap-8 text-left">
                             <div>
                               <h4 className="text-[10px] font-black uppercase tracking-wider text-primary mb-3.5 flex items-center gap-2 text-left">
                                 <FileText className="w-3.5 h-3.5" /> Exercices prescrits & Recommandations
                               </h4>
                               <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl text-xs font-semibold text-primary italic leading-relaxed text-left">
                                 {selectedSessionDetails.report?.homework || "Aucun exercice spécifique assigné pour cette séance."}
                               </div>
                             </div>
                             <div>
                               <h4 className="text-[10px] font-black uppercase tracking-wider text-primary mb-3.5 flex items-center gap-2 text-left">
                                 <Users className="w-3.5 h-3.5" /> Prochains objectifs de suivi
                               </h4>
                               <ul className="space-y-3 p-1 text-left">
                                 {(selectedSessionDetails.report?.nextGoals || []).length > 0 ? (
                                   (selectedSessionDetails.report?.nextGoals || []).map((goal, i) => (
                                     <li key={i} className="flex items-center gap-3 text-xs font-black text-text-muted text-left">
                                       <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                                       <span>{goal}</span>
                                     </li>
                                   ))
                                 ) : (
                                   <li className="text-xs font-semibold italic text-text-muted/60 text-left">Aucun objectif futur spécifié.</li>
                                 )}
                                </ul>
                             </div>
                           </div>
                         </div>

                         <div className="pt-8 border-t border-border-color flex flex-col sm:flex-row justify-between items-center gap-4 text-left">
                           <span className="text-[10px] text-text-muted font-bold tracking-wide">Document médical crypté • Signé par {therapistData.name}</span>
                           <div className="flex gap-4">
                             <button className="text-xs font-black text-primary hover:underline flex items-center gap-1 cursor-pointer">
                               Télécharger en PDF
                             </button>
                           </div>
                         </div>
                       </div>
                     </motion.div>
                   )}

                   {/* New Session Report Modal Overlay */}
                   <AnimatePresence>
                     {isCreateModalOpen && (
                       <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
                         
                         {/* Colored Backdrop */}
                         <motion.div 
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                           onClick={() => setIsCreateModalOpen(false)}
                           className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                         />

                         {/* Modal Body Container */}
                         <motion.div 
                           initial={{ opacity: 0, scale: 0.95, y: 15 }}
                           animate={{ opacity: 1, scale: 1, y: 0 }}
                           exit={{ opacity: 0, scale: 0.95, y: 15 }}
                           className="bg-card-bg border border-border-color rounded-[2.5rem] shadow-2xl p-6 md:p-8 w-full max-w-2xl relative z-10 max-h-[90vh] overflow-y-auto text-left"
                         >
                           <button 
                             type="button"
                             onClick={() => setIsCreateModalOpen(false)}
                             className="absolute top-6 right-6 p-2 bg-text-muted/20 hover:bg-red-500 hover:text-white rounded-xl transition-all cursor-pointer shadow-sm border border-border-color"
                           >
                             <X size={18} />
                           </button>

                           <div className="mb-6 flex items-center gap-3 text-left">
                             <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                               <FileText size={22} className="text-primary" />
                             </div>
                             <div>
                               <h3 className="text-xl font-bold text-text-main font-extrabold text-left">Créer un nouveau compte-rendu</h3>
                               <p className="text-xs text-text-muted mt-0.5 text-left font-medium">Ce document de suivi sera disponible pour le patient en temps réel.</p>
                             </div>
                           </div>

                           <form onSubmit={(e) => {
                             e.preventDefault();
                             if (!newSessionData.date || !newSessionData.summary) {
                               alert("Veuillez renseigner la date et le résumé de la séance.");
                               return;
                             }
                             
                             const newId = sessions.length > 0 ? Math.max(...sessions.map(s => s.id)) + 1 : 1;
                             const sessionObj = {
                               id: newId,
                               patientName: newSessionData.patientName,
                               therapistName: 'Dr. Amine B.',
                               date: newSessionData.date, 
                               duration: newSessionData.duration,
                               rating: 0,
                               rated: false,
                               note: '',
                               status: 'Terminée',
                               report: {
                                 summary: newSessionData.summary,
                                 homework: newSessionData.homework,
                                 nextGoals: newSessionData.nextGoals.filter(g => g.trim() !== '')
                               }
                             };

                             const updated = [sessionObj, ...sessions];
                             setSessions(updated);
                             localStorage.setItem('app_sessions', JSON.stringify(updated));

                             // Reset Form
                             setNewSessionData({
                               patientName: 'Walid Ben.',
                               date: '',
                               duration: '45 min',
                               summary: '',
                               homework: '',
                               nextGoals: ['', '', ''],
                              });
                             setIsCreateModalOpen(false);
                           }} className="space-y-6 text-left">
                             <div className="grid md:grid-cols-2 gap-5 text-left">
                               <div>
                                 <label className="block text-[10px] font-black uppercase text-text-muted tracking-wider mb-2">Sélectionner le patient</label>
                                 <select
                                   value={newSessionData.patientName}
                                   onChange={(e) => setNewSessionData(v => ({ ...v, patientName: e.target.value }))}
                                   className="w-full p-4 bg-bg-main border-2 border-border-color focus:border-primary rounded-xl text-xs font-bold outline-none text-text-main cursor-pointer"
                                 >
                                   <option value="Walid Ben.">Walid Ben. (Patient Principal)</option>
                                   <option value="Amine K.">Amine K.</option>
                                   <option value="Sonia M.">Sonia M.</option>
                                   <option value="Yacine R.">Yacine R.</option>
                                 </select>
                               </div>

                               <div>
                                 <label className="block text-[10px] font-black uppercase text-text-muted tracking-wider mb-2 text-left">Date de la séance</label>
                                 <input 
                                   type="text"
                                   placeholder="Ex: 30 Mai 2026"
                                   value={newSessionData.date}
                                   onChange={(e) => setNewSessionData(v => ({ ...v, date: e.target.value }))}
                                   className="w-full p-4 bg-bg-main border-2 border-border-color focus:border-primary rounded-xl text-xs font-bold outline-none text-text-main"
                                   required
                                 />
                               </div>
                             </div>

                             <div className="grid md:grid-cols-2 gap-5 text-left">
                               <div>
                                 <label className="block text-[10px] font-black uppercase text-text-muted tracking-wider mb-2 text-left">Durée</label>
                                 <select
                                   value={newSessionData.duration}
                                   onChange={(e) => setNewSessionData(v => ({ ...v, duration: e.target.value }))}
                                   className="w-full p-4 bg-bg-main border-2 border-border-color focus:border-primary rounded-xl text-xs font-bold outline-none text-text-main cursor-pointer"
                                 >
                                   <option value="45 min">45 minutes</option>
                                   <option value="50 min">50 minutes</option>
                                   <option value="1 heure">1 heure</option>
                                   <option value="1h30">1 heure 30</option>
                                 </select>
                               </div>

                               <div>
                                 <label className="block text-[10px] font-black uppercase text-text-muted tracking-wider mb-2 text-left">Statut médical</label>
                                 <input 
                                   type="text" 
                                   value="Terminée et validée" 
                                   disabled
                                   className="w-full p-4 bg-bg-main/50 border-2 border-border-color rounded-xl text-xs font-bold text-text-muted/70 outline-none select-none"
                                 />
                               </div>
                             </div>

                             <div className="space-y-1.5 text-left">
                               <label className="block text-[10px] font-black uppercase text-text-muted tracking-wider text-left">Résumé de la séance (Conseils clinicien)</label>
                               <textarea
                                 placeholder="Détaillez le travail effectué, les émotions sondées et l'évolution globale de l'état psychologique..."
                                 value={newSessionData.summary}
                                 onChange={(e) => setNewSessionData(v => ({ ...v, summary: e.target.value }))}
                                 className="w-full text-xs font-bold p-4 bg-bg-main border-2 border-border-color rounded-2xl focus:border-primary outline-none leading-relaxed transition-all h-24 resize-none"
                                 required
                               />
                             </div>

                             <div className="space-y-1.5 text-left">
                               <label className="block text-[10px] font-black uppercase text-text-muted tracking-wider text-left">Exercices assignés (À faire à la maison)</label>
                               <textarea
                                 placeholder="Décrivez les exercices concrets (comme la respiration, la journalisation) à effectuer d'ici la séance prochaine..."
                                 value={newSessionData.homework}
                                 onChange={(e) => setNewSessionData(v => ({ ...v, homework: e.target.value }))}
                                 className="w-full text-xs font-bold p-4 bg-bg-main border-2 border-border-color rounded-2xl focus:border-primary outline-none leading-relaxed transition-all h-20 resize-none"
                               />
                             </div>

                             <div className="space-y-3 text-left">
                               <label className="block text-[10px] font-black uppercase text-text-muted tracking-wider font-extrabold text-left">Prochains Objectifs de Suivi</label>
                               <div className="space-y-2">
                                 {[0, 1, 2].map((idx) => (
                                   <input
                                     key={idx}
                                     type="text"
                                     placeholder={`Objectif ${idx + 1}`}
                                     value={newSessionData.nextGoals[idx]}
                                     onChange={(e) => {
                                       const updatedGoals = [...newSessionData.nextGoals];
                                       updatedGoals[idx] = e.target.value;
                                       setNewSessionData(v => ({ ...v, nextGoals: updatedGoals }));
                                     }}
                                     className="w-full p-3 bg-bg-main border-2 border-border-color focus:border-primary rounded-xl text-xs font-bold outline-none"
                                   />
                                 ))}
                               </div>
                             </div>

                             <div className="pt-2 flex gap-4 text-left">
                               <button
                                 type="button"
                                 onClick={() => setIsCreateModalOpen(false)}
                                 className="flex-1 py-4 bg-bg-main text-text-muted rounded-xl hover:bg-red-500/5 hover:text-red-500 transition-all text-xs font-extrabold tracking-wider uppercase border border-border-color cursor-pointer text-center"
                               >
                                 Annuler
                                </button>
                               <button
                                 type="submit"
                                 className="flex-1 py-4 bg-primary text-white rounded-xl hover:scale-105 transition-all text-xs font-extrabold tracking-wider uppercase shadow-xl shadow-primary/20 cursor-pointer text-center"
                               >
                                 Créer & Notifier le patient
                               </button>
                             </div>
                           </form>
                         </motion.div>
                       </div>
                     )}
                    </AnimatePresence>
                 </motion.div>
               )}

               {activeTab === 'settings' && (
                 <motion.div 
                   key="settings-view"
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: 20 }}
                   className="flex-1 p-4 md:p-8 overflow-y-auto h-full"
                 >
                   <div className="max-w-3xl mx-auto">
                      <div className="flex flex-col md:flex-row items-center gap-6 mb-8 p-6 bg-gradient-to-br from-primary/5 to-transparent rounded-[2rem] border border-primary/10">
                         <div className="relative">
                           <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md border-2 border-card-bg bg-primary-light flex items-center justify-center relative">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={therapistData.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                "M"
                              )}
                           </div>
                           <button 
                              onClick={() => setIsAvatarModalOpen(true)}
                              className="absolute -bottom-1 -right-1 p-2 bg-primary text-white rounded-xl shadow-md hover:scale-110 transition-transform cursor-pointer border-2 border-card-bg"
                              title="Changer de photo de profil"
                            >
                              <Camera size={14} />
                           </button>
                         </div>
                         <div className="text-center md:text-left">
                           <h2 className="text-2xl font-black mb-1 tracking-tight">{therapistData.name}</h2>
                           <p className="text-primary font-bold text-[10px] tracking-[0.15em] uppercase bg-primary/10 inline-block px-2.5 py-0.5 rounded-full">{therapistData.speciality}</p>
                           <div className="flex items-center justify-center md:justify-start gap-4 mt-3">
                              <div className="flex items-center gap-1.5 text-amber-500 font-bold text-sm">
                                <Star size={16} fill="currentColor" /> {therapistData.rating}
                              </div>
                              <div className="w-1.5 h-1.5 bg-text-muted/30 rounded-full" />
                              <div className="text-text-muted text-[10px] font-bold uppercase tracking-wider">{therapistData.sessions} sessions complétées</div>
                           </div>
                         </div>
                      </div>

                      <div className="grid gap-6">
                         <section className="t-card p-6 md:p-8">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2.5 tracking-tight">
                              <Users size={20} className="text-primary" /> Détails professionnels
                            </h3>
                            <div className="grid gap-6">
                               <div>
                                  <label className="block text-[10px] font-bold uppercase text-text-muted tracking-[0.12em] mb-1.5 ml-1">Biographie professionnelle</label>
                                  <textarea className="t-input h-28 resize-none p-4 leading-relaxed font-semibold text-xs rounded-xl" defaultValue="Spécialisée dans les troubles anxieux et la thérapie cognitive-comportementale depuis plus de 10 ans. J'accueille mes patients avec bienveillance et méthodologie pour un suivi personnalisé et efficace." />
                               </div>
                               <div className="grid md:grid-cols-2 gap-6">
                                  <div>
                                     <label className="block text-[10px] font-bold uppercase text-text-muted tracking-[0.12em] mb-1.5 ml-1">Tarif consultation (DA)</label>
                                     <input type="text" className="t-input text-base font-bold rounded-xl py-2.5" defaultValue="2500" />
                                  </div>
                                  <div>
                                     <label className="block text-[10px] font-bold uppercase text-text-muted tracking-[0.12em] mb-1.5 ml-1">Statut visibilité</label>
                                     <div className="flex items-center justify-between p-3 px-4 bg-bg-main rounded-xl border border-border-color group hover:border-primary/30 transition-colors">
                                        <div className="flex flex-col">
                                           <span className="text-xs font-bold">Mode Disponible</span>
                                           <span className="text-[9px] text-text-muted font-bold">Apparaître dans les résultats</span>
                                        </div>
                                        <div className="w-12 h-7 bg-primary rounded-full relative cursor-pointer shadow-inner">
                                           <div className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow-md" />
                                        </div>
                                     </div>
                                  </div>
                               </div>
                            </div>
                            <div className="mt-8 pt-6 border-t border-border-color flex flex-col md:flex-row gap-4 justify-between items-center">
                               <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest italic flex items-center gap-1.5">
                                 <Shield size={12} /> Vos données sont sécurisées
                               </p>
                               <button className="t-btn-primary px-8 py-3 rounded-xl shadow-lg shadow-primary/20 text-xs text-white">Mettre à jour le profil</button>
                            </div>
                         </section>
                      </div>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Detail Modal for Selected Session Request */}
      <AnimatePresence>
        {selectedRequest && (
          <>
            {/* Backdrop with overlay animations */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRequest(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
            >
              {/* Modal Card container with scale entrance */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.4 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card-bg w-full max-w-lg border border-border-color rounded-[2.5rem] shadow-2xl overflow-hidden relative cursor-default"
              >
                {/* Top Section / Header */}
                <div className="flex items-center justify-between p-6 border-b border-border-color/60 bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary-light text-primary rounded-2xl flex items-center justify-center font-black text-2xl border border-primary/10">
                      {selectedRequest.avatar}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-text-main leading-tight">{selectedRequest.name}</h3>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Détails de la demande</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="p-2.5 hover:bg-bg-main border border-border-color hover:border-text-muted rounded-xl text-text-muted transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Modal Body Info Container */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                  {/* Timing & Consultation type grids */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-bg-main border border-border-color/60 rounded-2xl space-y-1">
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Date & Heure proposées</p>
                      <p className="text-xs font-black text-text-main flex items-center gap-1.5 pt-0.5">
                        <Clock size={14} className="text-primary shrink-0" /> {selectedRequest.time}
                      </p>
                    </div>
                    <div className="p-4 bg-bg-main border border-border-color/60 rounded-2xl space-y-1">
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Mode de consultation</p>
                      <p className="text-xs font-black text-text-main flex items-center gap-1.5 pt-0.5">
                        {selectedRequest.consultationType === 'Appel vidéo' && <Video size={14} className="text-primary shrink-0" />}
                        {selectedRequest.consultationType === 'Cabinet' && <MapPin size={14} className="text-primary shrink-0" />}
                        {selectedRequest.consultationType === 'Appel vocal' && <Phone size={14} className="text-primary shrink-0" />}
                        {selectedRequest.consultationType}
                      </p>
                    </div>
                  </div>

                  {/* Patient Contact information */}
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-3">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Coordonnées du Patient</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-text-muted shrink-0" />
                        <span className="text-text-main truncate">{selectedRequest.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-text-muted shrink-0" />
                        <span className="text-text-main">{selectedRequest.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Message motif section */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">
                      Motif de Consultation / Message
                    </label>
                    <div className="p-5 bg-bg-main border border-border-color rounded-2xl text-xs font-semibold leading-relaxed text-text-main">
                      "{selectedRequest.motif}"
                    </div>
                  </div>

                  {/* Request original metadata info */}
                  <div className="flex justify-between items-center text-xs py-3 border-t border-b border-border-color/40">
                    <span className="text-text-muted font-bold">Catégorie de demande</span>
                    <span className="px-3 py-1 bg-bg-main rounded-lg border border-border-color font-extrabold text-primary uppercase tracking-wider text-[10px]">
                      {selectedRequest.type}
                    </span>
                  </div>
                </div>

                {/* Footer buttons section */}
                <div className="p-6 bg-bg-main border-t border-border-color flex items-center gap-3">
                  <button
                    onClick={(e) => handleRejectByRequestIndex(selectedRequest.id, e)}
                    className="flex-1 py-3.5 bg-card-bg hover:bg-red-500/15 hover:text-red-600 border border-border-color text-text-muted rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                  >
                    <X size={16} /> Refuser
                  </button>
                  <button
                    onClick={(e) => handleAcceptByRequestIndex(selectedRequest.id, e)}
                    className="flex-1 py-3.5 bg-primary text-white hover:scale-[1.02] active:scale-[0.98] rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-lg shadow-primary/25"
                  >
                    <Check size={16} /> Accepter
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal to Add New Appointment */}
      <AnimatePresence>
        {selectedDateStr !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDateStr(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card-bg w-full max-w-md border border-border-color rounded-[2rem] shadow-2xl overflow-hidden relative cursor-default flex flex-col max-h-[90vh]"
              >
                <div className="flex items-center justify-between p-6 border-b border-border-color/60 bg-gradient-to-r from-primary/5 to-transparent shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-xl">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-text-main leading-tight font-sans">Gestion de Journée</h3>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
                        {selectedDateStr ? new Date(selectedDateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDateStr(null)}
                    className="p-2 hover:bg-bg-main border border-border-color rounded-lg text-text-muted transition-all cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto flex-1 scrollbar-none">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-bg-main border border-border-color rounded-2xl shadow-sm">
                      <div>
                        <span className="block text-xs font-black text-text-main">Disponibilité du Jour</span>
                        <span className="block text-[10px] text-text-muted mt-0.5">Activer ou couper cette date</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(selectedDateStr)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 border cursor-pointer ${
                          getDayAvailability(selectedDateStr).available
                            ? 'bg-green-500/10 text-green-600 border-green-500/20 shadow-sm'
                            : 'bg-red-500/10 text-red-600 border-red-500/20 shadow-sm'
                        }`}
                      >
                        {getDayAvailability(selectedDateStr).available ? '● Disponible' : '● Indisponible'}
                      </button>
                    </div>
                    {getDayAvailability(selectedDateStr).available && (
                      <div className="p-4 border border-border-color rounded-2xl space-y-4 bg-card-bg shadow-sm">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Créneaux horaires</span>
                            <span className="text-[9px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/15">{getDayAvailability(selectedDateStr).slots.length} créneaux</span>
                         </div>
                         {getDayAvailability(selectedDateStr).slots.length === 0 ? (
                            <p className="text-[11px] font-semibold text-text-muted italic py-1">Aucun créneau configuré.</p>
                         ) : (
                            <div className="flex flex-wrap gap-1.5 py-1">
                              {getDayAvailability(selectedDateStr).slots.map((slot, sIdx) => (
                                <div key={sIdx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-main border border-border-color rounded-xl hover:border-primary/30 transition-all text-xs font-bold text-text-main group/slot">
                                   <span>{slot.from} - {slot.to}</span>
                                   <button 
                                     onClick={() => handleDeleteSlot(selectedDateStr, sIdx)}
                                     type="button"
                                     className="text-text-muted hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer"
                                     title="Supprimer"
                                   >
                                      <Trash2 size={12} />
                                   </button>
                                </div>
                              ))}
                            </div>
                         )}
                         <div className="pt-3 border-t border-border-color/60">
                            <div className="flex items-center gap-2">
                               <div className="flex-1 flex gap-2">
                                  <div className="flex-1 space-y-0.5">
                                     <span className="text-[8px] font-extrabold uppercase text-text-muted tracking-wider block">Début</span>
                                     <input id="slot-from" type="time" defaultValue="09:00" className="w-full text-xs font-bold p-2 bg-bg-main border border-border-color rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all" />
                                  </div>
                                  <div className="flex-1 space-y-0.5">
                                     <span className="text-[8px] font-extrabold uppercase text-text-muted tracking-wider block">Fin</span>
                                     <input id="slot-to" type="time" defaultValue="10:00" className="w-full text-xs font-bold p-2 bg-bg-main border border-border-color rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all" />
                                  </div>
                               </div>
                               <div className="self-end pb-[1px]">
                                  <button
                                    onClick={() => {
                                      const fromVal = document.getElementById("slot-from")?.value || "09:00";
                                      const toVal = document.getElementById("slot-to")?.value || "10:00";
                                      handleAddSlot(selectedDateStr, fromVal, toVal);
                                    }}
                                    type="button"
                                    className="p-2 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 transition-all text-xs font-bold cursor-pointer shrink-0"
                                  >
                                     <Plus size={14} /> Ajouter
                                  </button>
                               </div>
                            </div>
                            {slotError && (
                              <p className="text-[10px] text-red-500 font-extrabold mt-2 leading-tight">⚠ {slotError}</p>
                            )}
                         </div>
                      </div>
                    )}
                  </div>
                  {getDayAvailability(selectedDateStr).available ? (
                    <div className="border-t border-border-color/60 pt-6 space-y-4">
                      <div>
                        <span className="block text-xs font-black text-text-main">Prendre un Rendez-vous</span>
                        <span className="block text-[10px] text-text-muted mt-0.5">Programmer une consultation</span>
                      </div>
                      <form onSubmit={handleAddAppointment} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-extrabold uppercase text-text-muted tracking-[0.12em] ml-1">
                            Nom du Patient
                          </label>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                            <input
                              type="text"
                              required
                              value={newAppointmentPatient}
                              onChange={(e) => setNewAppointmentPatient(e.target.value)}
                              placeholder="Ex: Walid, Sonia..."
                              className="w-full pl-10 pr-4 py-3 bg-bg-main border border-border-color rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-extrabold uppercase text-text-muted tracking-[0.12em] ml-1">
                            Heure de la consultation
                          </label>
                          {getDayAvailability(selectedDateStr).slots.length > 0 ? (
                            <div className="grid grid-cols-4 gap-1.5">
                              {getDayAvailability(selectedDateStr).slots.map((sl) => (
                                <button
                                  key={sl.from}
                                  type="button"
                                  onClick={() => setNewAppointmentTime(sl.from)}
                                  className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                    newAppointmentTime === sl.from
                                      ? 'bg-primary/10 text-primary border-primary font-black shadow-sm'
                                      : 'bg-bg-main text-text-muted border-border-color hover:border-text-muted/35'
                                  }`}
                                >
                                  {sl.from}
                                </button>
                              ))}
                              <div className="relative col-span-4 mt-1.5">
                                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                                <input
                                  type="time"
                                  value={newAppointmentTime}
                                  onChange={(e) => setNewAppointmentTime(e.target.value)}
                                  className="w-full pl-10 pr-4 py-2 bg-bg-main border border-border-color rounded-lg text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/15"
                                  title="Heure personnalisée"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="relative">
                              <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                              <input
                                type="time"
                                required
                                value={newAppointmentTime}
                                onChange={(e) => setNewAppointmentTime(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-bg-main border border-border-color rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                              />
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-extrabold uppercase text-text-muted tracking-[0.12em] ml-1">
                            Couleur de l'étiquette
                          </label>
                          <div className="flex gap-2.5">
                            {[
                              { bg: "bg-primary text-white", label: "Bleu", dotColor: "bg-primary" },
                              { bg: "bg-indigo-500 text-white", label: "Indigo", dotColor: "bg-indigo-500" },
                              { bg: "bg-pink-500 text-white", label: "Rose", dotColor: "bg-pink-500" },
                              { bg: "bg-emerald-500 text-white", label: "Vert", dotColor: "bg-emerald-500" },
                              { bg: "bg-amber-500 text-white", label: "Orange", dotColor: "bg-amber-500" }
                            ].map((opt) => (
                              <button
                                key={opt.bg}
                                type="button"
                                onClick={() => setNewAppointmentColor(opt.bg)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 shrink-0 ${opt.dotColor} ${
                                  newAppointmentColor === opt.bg ? 'ring-2 ring-offset-2 ring-primary scale-105' : 'opacity-70 hover:opacity-100'
                                }`}
                                title={opt.label}
                              >
                                {newAppointmentColor === opt.bg && (
                                  <Check size={12} className="text-white" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="w-full py-3.5 bg-primary text-white hover:scale-[1.01] active:scale-[0.99] rounded-[1.25rem] font-sans font-black text-xs transition-all cursor-pointer shadow-lg shadow-primary/25 text-center block"
                        >
                          Programmer la Séance
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="border-t border-border-color/60 pt-6 flex flex-col items-center justify-center p-6 bg-red-500/[0.02] border border-red-500/10 rounded-2xl text-center space-y-2">
                       <Shield size={22} className="text-red-500/50" />
                       <span className="block text-xs font-bold text-red-500/70 uppercase tracking-wide font-sans">Journée Indisponible</span>
                       <p className="text-[10px] text-text-muted font-bold leading-relaxed max-w-[240px]">Les prises de rendez-vous et séances sont désactivées pour cette date car vous l'avez marquée comme indisponible. Activez la disponibilité ci-dessus pour gérer.</p>
                    </div>
                  )}
                </div>
                <div className="p-6 bg-bg-main border-t border-border-color flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedDateStr(null)}
                    className="w-full py-3 bg-card-bg border border-border-color hover:bg-bg-main text-text-muted rounded-xl font-bold transition-all text-xs cursor-pointer text-center"
                  >
                    Fermer l'agenda
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal to View / Dismiss Existing Appointment */}
      <AnimatePresence>
        {selectedViewAppointment !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedViewAppointment(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card-bg w-full max-w-xs border border-border-color rounded-[2rem] shadow-2xl overflow-hidden relative cursor-default"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border-color/60 bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                      <Clock size={16} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-text-main leading-tight">Détails du RDV</h3>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
                        Séance plannifiée
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedViewAppointment(null)}
                    className="p-2 hover:bg-bg-main border border-border-color rounded-lg text-text-muted transition-all cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Body Details */}
                <div className="p-6 space-y-4">
                  <div className="p-4 bg-bg-main border border-border-color rounded-xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center shrink-0 text-sm">
                      {selectedViewAppointment.patient.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold text-text-muted uppercase tracking-wider">Patient</p>
                      <p className="text-xs font-black text-text-main">{selectedViewAppointment.patient}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-bg-main border border-border-color rounded-xl space-y-0.5">
                      <span className="text-[9px] font-extrabold text-text-muted uppercase tracking-wider">Heure</span>
                      <p className="text-xs font-black text-text-main">{selectedViewAppointment.time}</p>
                    </div>
                    <div className="p-3 bg-bg-main border border-border-color rounded-xl space-y-0.5">
                      <span className="text-[9px] font-extrabold text-text-muted uppercase tracking-wider">Jour</span>
                      <p className="text-xs font-black text-text-main">
                        {selectedViewAppointment.date 
                          ? new Date(selectedViewAppointment.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                          : `${selectedViewAppointment.dayIndex - 4} Mai`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action buttons footer */}
                <div className="p-6 bg-bg-main border-t border-border-color flex items-center gap-3">
                  <button
                    onClick={() => setSelectedViewAppointment(null)}
                    className="flex-1 py-2.5 bg-card-bg border border-border-color text-text-muted rounded-xl font-bold hover:bg-bg-main transition-all text-xs cursor-pointer text-center"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={() => handleDeleteAppointment(selectedViewAppointment.id)}
                    className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white rounded-xl font-bold transition-all text-xs cursor-pointer text-center"
                  >
                    Supprimer
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal to Change Profile Picture */}
      <AnimatePresence>
        {isAvatarModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAvatarModalOpen(false);
                setTempFile(null);
                if (tempPreview) {
                  URL.revokeObjectURL(tempPreview);
                  setTempPreview(null);
                }
                setAvatarError('');
              }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card-bg w-full max-w-md border border-border-color rounded-[2.5rem] shadow-2xl overflow-hidden relative cursor-default p-6 md:p-8 text-left"
              >
                <button 
                  type="button"
                  onClick={() => {
                    setIsAvatarModalOpen(false);
                    setTempFile(null);
                    if (tempPreview) {
                      URL.revokeObjectURL(tempPreview);
                      setTempPreview(null);
                    }
                    setAvatarError('');
                  }}
                  className="absolute top-6 right-6 p-2 bg-text-muted/10 hover:bg-red-500 hover:text-white rounded-xl transition-all cursor-pointer shadow-sm border border-border-color"
                >
                  <X size={16} />
                </button>

                <div className="mb-6 flex items-center gap-3">
                  <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                    <Camera size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-main font-extrabold">Photo de profil</h3>
                    <p className="text-xs text-text-muted mt-0.5 font-medium">Personnalisez votre apparence sur la plateforme.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Current or Pending Preview */}
                  <div className="flex flex-col items-center justify-center py-4 bg-bg-main/40 border border-border-color rounded-2xl p-4">
                    <div className="w-28 h-28 rounded-[2rem] overflow-hidden shadow-inner border-2 border-primary/20 bg-primary-light flex items-center justify-center relative">
                      {tempPreview ? (
                        <img 
                          src={tempPreview} 
                          alt="Nouvel aperçu" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : avatarUrl ? (
                        <img 
                          src={avatarUrl} 
                          alt="Photo actuelle" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-4xl text-primary font-bold">M</span>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-black text-text-muted/60 mt-3">
                      {tempPreview ? "Aperçu de la nouvelle image" : "Image de profil actuelle"}
                    </span>
                  </div>

                  {/* Drag-and-drop / select control */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border-color/85 hover:border-primary/50 rounded-2xl p-6 text-center cursor-pointer hover:bg-primary/[0.02] transition-all space-y-2 group"
                  >
                    <div className="w-10 h-10 bg-bg-main border border-border-color rounded-xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                      <Camera size={18} className="text-text-muted group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-main">
                        Glissez-déposez ou <span className="text-primary hover:underline">parcourez</span>
                      </p>
                      <p className="text-[10px] text-text-muted mt-1 font-semibold">
                        Soutient : JPG, PNG, WEBP (Max. 5 Mo)
                      </p>
                    </div>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden" 
                    />
                  </div>

                  {/* Error Message */}
                  {avatarError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-xl leading-relaxed text-left">
                      {avatarError}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-4 pt-2">
                    {avatarUrl && !tempPreview && (
                      <button
                        type="button"
                        onClick={handleDeleteAvatar}
                        className="py-3 px-4 bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white rounded-xl transition-all text-xs font-extrabold tracking-wider uppercase cursor-pointer"
                      >
                        Supprimer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsAvatarModalOpen(false);
                        setTempFile(null);
                        if (tempPreview) {
                          URL.revokeObjectURL(tempPreview);
                          setTempPreview(null);
                        }
                        setAvatarError('');
                      }}
                      className="flex-1 py-3 bg-bg-main text-text-muted rounded-xl hover:bg-red-500/5 hover:text-red-500 transition-all text-xs font-extrabold tracking-wider uppercase border border-border-color cursor-pointer text-center"
                    >
                      {tempPreview ? "Annuler" : "Fermer"}
                    </button>
                    
                    {tempPreview && (
                      <button
                        type="button"
                        onClick={handleSaveAvatar}
                        className="flex-1 py-3 bg-primary text-white rounded-xl hover:scale-105 transition-all text-xs font-extrabold tracking-wider uppercase shadow-lg shadow-primary/25 cursor-pointer text-center"
                      >
                        Enregistrer
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Simplified Footer - optional for dashboard */}
      <div className="bg-card-bg border-t border-border-color px-6 py-3 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-text-muted shrink-0 z-20">
         <span>Version 1.0.4-dev</span>
         <div className="flex gap-4">
            <span className="text-primary">Support</span>
            <span>Conditions</span>
         </div>
      </div>
    </div>
  );
}
