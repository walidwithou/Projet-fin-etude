import { useState, useEffect, useMemo, Component, useRef, useCallback } from 'react';
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
  Camera,
  ChevronLeft,
  Loader2,
  AlertCircle
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ChatWidget from '../components/ChatWidget';
import { removeToken, therapistApi } from '../services/api';
import { useAuth } from '../auth/AuthContext';

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
              L'interface du praticien a rencontré un probléme inattendu.
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

// ---------------------------------------------------------------------------
// Timezone-safe date helpers
// ---------------------------------------------------------------------------
// The server stores all slot timestamps in UTC (via Date.UTC constructor),
// so the ISO strings received have the form "2026-06-05T13:00:00.000Z".
// We must use UTC getters to extract the original time as the user entered it.
const formatYmdLocal = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// A day is considered "past" if its date is strictly before today
// (midnight local time). Past days should not be activatable.
const isPastDate = (year, month, day) => {
  const d = new Date(year, month, day);
  const today = new Date();
  const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return d < todayReset;
};

// Format a time from an ISO string using UTC components,
// so 13:00 UTC renders as "13:00" regardless of the browser's timezone.
const formatTimeUtc = (isoStr) => {
  const d = new Date(isoStr);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};


// ---------------------------------------------------------------------------
// Slot status badge helper
// ---------------------------------------------------------------------------
// Le badge refl\u00e8te le statut r\u00e9el de l'Appointment li\u00e9 au cr\u00e9neau,
// et non plus uniquement le bool\u00e9en `slot.isBooked`.
//
//   scheduled  -> "EN ATTENTE"  (jaune)
//   confirmed  -> "CONFIRM\u00c9"   (vert)
//   no_show    -> "ABSENT"      (rouge doux)
//   cancelled  -> pas de badge, cr\u00e9neau consid\u00e9r\u00e9 libre
//   pas d'appointment li\u00e9 -> pas de badge (libre)
/**
 * Génère un conversationId déterministe basé sur deux User.id triés.
 * Identique à la logique backend dans message.controller.js
 * 
 * IMPORTANT: conversationId doit être construit uniquement avec des User.id.
 * Ne jamais utiliser Patient.id ou Therapist.id.
 * Le résultat doit être déterministe : [userId1, userId2].sort().
 * Backend et frontend doivent utiliser EXACTEMENT le même algorithme.
 */
const getConversationId = (userId1, userId2) => {
  if (!userId1 || !userId2) return undefined;
  const sorted = [userId1, userId2].sort();
  return `conv_${sorted[0]}_${sorted[1]}`;
};

const getSlotBadgeInfo = (slot) => {
  const status = slot?.appointment?.status ?? null;
  switch (status) {
    case 'scheduled':
      return {
        showBadge: true,
        label: 'EN ATTENTE',
        classes: 'text-amber-700 bg-amber-100 border-amber-200',
        isOccupied: true,
      };
    case 'confirmed':
      return {
        showBadge: true,
        label: 'CONFIRM\u00c9',
        classes: 'text-green-700 bg-green-100 border-green-200',
        isOccupied: true,
      };
    case 'no_show':
      return {
        showBadge: true,
        label: 'ABSENT',
        classes: 'text-red-600 bg-red-500/10 border-red-500/20',
        isOccupied: false,
      };
    case 'cancelled':
    case null:
    case undefined:
    default:
      return {
        showBadge: false,
        label: null,
        classes: '',
        // 'cancelled' est d\u00e9tach\u00e9 du slot par la FK ON DELETE SET NULL,
        // on ne devrait pas voir un appointment 'cancelled' ici, mais on le
        // traite comme libre par d\u00e9faut pour s\u00e9curit\u00e9.
        isOccupied: false,
      };
  }
};

function TherapistContent({ onNavigateToPage }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('chats');
  const [selectedClient, setSelectedClient] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real data from API
  const [therapistProfile, setTherapistProfile] = useState(null);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Avatar states
  const [avatarUrl, setAvatarUrl] = useState(() => {
    return localStorage.getItem('therapist_avatar') || '';
  });
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [tempFile, setTempFile] = useState(null);
  const [tempPreview, setTempPreview] = useState(null);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  // Slot management modal state
  const [manageSlotModal, setManageSlotModal] = useState({ open: false, dateStr: null });
  const [slotsForDate, setSlotsForDate] = useState([]);
  const [addSlotFrom, setAddSlotFrom] = useState('09:00');
  const [addSlotTo, setAddSlotTo] = useState('10:00');
  const [manageSlotError, setManageSlotError] = useState('');
  const [manageSlotLoading, setManageSlotLoading] = useState(false);
  const [deleteSlotId, setDeleteSlotId] = useState(null);
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [editSlotFrom, setEditSlotFrom] = useState('');
  const [editSlotTo, setEditSlotTo] = useState('');
  const [editSlotLoading, setEditSlotLoading] = useState(false);
  const refreshAvailabilityForModal = useCallback(
    async (dateStr) => {
      const res = await therapistApi.getAvailability();
      setAvailabilitySlots(res.data || []);
      const targetDate = dateStr || manageSlotModal.dateStr;
      if (targetDate) {
        const updated = (res.data || []).filter((slot) =>
          formatYmdLocal(new Date(slot.startAt)) === targetDate,
        );
        setSlotsForDate(updated);
      }
    },
    [manageSlotModal.dateStr],
  );

  // Load all therapist data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, patientsRes, appointmentsRes, statsRes, sessionsRes, slotsRes] = await Promise.all([
          therapistApi.getProfile(),
          therapistApi.getPatients(),
          therapistApi.getAppointments(),
          therapistApi.getStats(),
          therapistApi.getAppointments({ status: 'completed' }),
          therapistApi.getAvailability(),
        ]);

        setTherapistProfile(profileRes.data);
        setPatients(patientsRes.data || []);
        setAppointments(appointmentsRes.data || []);
        setStats(statsRes.data);
        setCompletedSessions(sessionsRes.data || []);
        setAvailabilitySlots(slotsRes.data || []);

        // Filter scheduled appointments as "requests"
        const scheduledApps = (appointmentsRes.data || []).filter(
          a => a.status === 'scheduled'
        );
        setRequests(scheduledApps);
      } catch (err) {
        setError(err.message || 'Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Refresh requests when appointments change
  useEffect(() => {
    const scheduledApps = appointments.filter(
      a => a.status === 'scheduled'
    );
    setRequests(scheduledApps);
  }, [appointments]);

  // Re-fetch appointments when requests are accepted/rejected
  const refreshAppointments = useCallback(async () => {
    try {
      const res = await therapistApi.getAppointments();
      setAppointments(res.data || []);
    } catch (e) {
      console.error('Failed to refresh appointments', e);
    }
  }, []);

  // Avatar handlers
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarError('');
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setAvatarError("Fichier invalide. Veuillez sélectionner une image au format JPG, PNG ou WEBP.");
      return;
    }
    const maxSize = 5 * 1024 * 1024;
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

  // Session history search/filter/sort
  const [sessionSearch, setSessionSearch] = useState('');
  const [selectedPatientFilter, setSelectedPatientFilter] = useState('ALL');
  const [sessionSort, setSessionSort] = useState('date-desc');
  const [selectedSessionDetails, setSelectedSessionDetails] = useState(null);

  // Create session report modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSessionData, setNewSessionData] = useState({
    patientName: '',
    date: '',
    duration: '45 min',
    summary: '',
    homework: '',
    nextGoals: ['', '', ''],
  });

  // Filter patients who have had sessions
  const patientNames = useMemo(() => {
    const names = new Set();
    completedSessions.forEach(s => {
      if (s.patient?.user?.name) names.add(s.patient.user.name);
    });
    return Array.from(names);
  }, [completedSessions]);

  // Therapist stats from API
  const therapistStats = useMemo(() => {
    return {
      averageRating: stats?.rating || 0,
      totalRatings: stats?.totalReviews || 0,
    };
  }, [stats]);

  // Close sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const monthNamesFr = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Aoét", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  // Calendar state
  const [selectedDateStr, setSelectedDateStr] = useState(null);
  const [selectedViewAppointment, setSelectedViewAppointment] = useState(null);

  // Calendar shows ONLY scheduled (pending) and confirmed appointments.
  const calendarAppointments = useMemo(() => {
    return appointments
      .filter(a => a.status === 'scheduled' || a.status === 'confirmed')
      .map(app => {
      const date = new Date(app.scheduledAt);
      const dateStr = formatYmdLocal(date);
      const time = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
      return {
        id: app.id,
        date: dateStr,
        time,
        patient: app.patient?.user?.name || 'Patient',
        colorBg: app.status === 'confirmed' ? 'bg-primary text-white' : 'bg-amber-500 text-white',
        status: app.status,
      };
    });
  }, [appointments]);

  // Build day availabilities from API data, keyed by LOCAL date.
  const dayAvailabilities = useMemo(() => {
    const avail = {};
    if (availabilitySlots && Array.isArray(availabilitySlots)) {
      availabilitySlots.forEach(slot => {
        const dateStr = formatYmdLocal(new Date(slot.startAt));
        if (!avail[dateStr]) {
          avail[dateStr] = { available: true, slots: [] };
        }
        const from = formatTimeUtc(slot.startAt);
        const to = formatTimeUtc(slot.endAt);
        avail[dateStr].slots.push({
          from,
          to,
          id: slot.id,
          isBooked: !!slot.isBooked,
          startAt: slot.startAt,
          endAt: slot.endAt,
          appointmentStatus: slot.appointment?.status ?? null,
        });
      });
    }
    return avail;
  }, [availabilitySlots]);

  const getDayAvailability = (dateStr) => {
    if (dayAvailabilities[dateStr]) {
      return dayAvailabilities[dateStr];
    }
    return {
      available: false,
      slots: []
    };
  };

  const openManageSlots = async (dateStr) => {
    setManageSlotModal({ open: true, dateStr });
    setManageSlotError('');
    setAddSlotFrom('09:00');
    setAddSlotTo('10:00');
    setDeleteSlotId(null);
    setEditingSlotId(null);
    const slots = availabilitySlots.filter((slot) =>
      formatYmdLocal(new Date(slot.startAt)) === dateStr,
    );
    setSlotsForDate(slots);
  };

  const handleAddSlotInModal = async () => {
    if (!manageSlotModal.dateStr) return;
    if (addSlotFrom >= addSlotTo) {
      setManageSlotError("L'heure de début doit étre antérieure é l'heure de fin.");
      return;
    }
    setManageSlotError('');
    setManageSlotLoading(true);
    try {
      await therapistApi.createTimeSlots([{
        date: manageSlotModal.dateStr,
        startTime: addSlotFrom,
        endTime: addSlotTo,
      }]);
      await refreshAvailabilityForModal(manageSlotModal.dateStr);
    } catch (err) {
      setManageSlotError(err.message || "Erreur lors de l'ajout");
    } finally {
      setManageSlotLoading(false);
    }
  };

  const handleDeleteSlotInModal = async (slotId) => {
    setDeleteSlotId(slotId);
    try {
      await therapistApi.deleteTimeSlot(slotId);
      await refreshAvailabilityForModal(manageSlotModal.dateStr);
      if (editingSlotId === slotId) setEditingSlotId(null);
    } catch (err) {
      setManageSlotError(err.message || 'Erreur lors de la suppression');
    } finally {
      setDeleteSlotId(null);
    }
  };

  const handleStartEditSlot = (slot) => {
    if (getSlotBadgeInfo(slot).isOccupied) {
      setManageSlotError(
        "Impossible de modifier un créneau avec un rendez-vous actif (en attente ou confirmé). Annulez d'abord le rendez-vous.",
      );
      return;
    }
    setManageSlotError('');
    setEditingSlotId(slot.id);
    setEditSlotFrom(formatTimeUtc(slot.startAt));
    setEditSlotTo(formatTimeUtc(slot.endAt));
  };

  const handleCancelEditSlot = () => {
    setEditingSlotId(null);
    setEditSlotFrom('');
    setEditSlotTo('');
  };

  const handleUpdateSlotInModal = async (slotId) => {
    if (!editSlotFrom || !editSlotTo) {
      setManageSlotError('Veuillez renseigner les deux heures.');
      return;
    }
    if (editSlotFrom >= editSlotTo) {
      setManageSlotError("L'heure de début doit étre antérieure é l'heure de fin.");
      return;
    }
    setEditSlotLoading(true);
    setManageSlotError('');
    try {
      await therapistApi.updateTimeSlot(slotId, {
        startTime: editSlotFrom,
        endTime: editSlotTo,
      });
      await refreshAvailabilityForModal(manageSlotModal.dateStr);
      setEditingSlotId(null);
    } catch (err) {
      setManageSlotError(err.message || 'Erreur lors de la modification');
    } finally {
      setEditSlotLoading(false);
    }
  };

  const handleToggleAvailability = async (dateStr) => {
    // Prevent activating past dates
    const [y, m, d] = dateStr.split('-').map(Number);
    if (isPastDate(y, m - 1, d)) return;
    if (!dayAvailabilities[dateStr]) {
      try {
        await therapistApi.createTimeSlots([{
          date: dateStr,
          startTime: '09:00',
          endTime: '12:00',
        }]);
        const res = await therapistApi.getAvailability();
        setAvailabilitySlots(res.data || []);
      } catch (err) {
        console.error('Failed to toggle availability', err);
      }
    }
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

  // BUG 2 FIX: Annuler un rendez-vous via la modale Détails
  // utilise updateAppointmentStatus(id, 'cancelled') puis rafraéchit.
  const handleDeleteAppointment = async (id) => {
    try {
      await therapistApi.updateAppointmentStatus(id, 'cancelled');
      await refreshAppointments();
      // Rafra\u00eechir \u00e9galement la liste des cr\u00e9neaux pour que le badge
      // refl\u00e8te imm\u00e9diatement le nouveau statut (cancelled -> pas de badge).
      await refreshAvailabilityForModal();
      setSelectedViewAppointment(null);
    } catch (err) {
      console.error('Failed to cancel appointment', err);
    }
  };

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedRequest(null);
        setSelectedDateStr(null);
        setSelectedViewAppointment(null);
        setManageSlotModal({ open: false, dateStr: null });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAcceptByRequestIndex = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await therapistApi.updateAppointmentStatus(id, 'confirmed');
      await refreshAppointments();
      await refreshAvailabilityForModal();
      if (selectedRequest?.id === id) {
        setSelectedRequest(null);
      }
    } catch (err) {
      console.error('Failed to accept request', err);
    }
  };

  const handleRejectByRequestIndex = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await therapistApi.updateAppointmentStatus(id, 'cancelled');
      await refreshAppointments();
      await refreshAvailabilityForModal();
      if (selectedRequest?.id === id) {
        setSelectedRequest(null);
      }
    } catch (err) {
      console.error('Failed to reject request', err);
    }
  };

  // Build therapist data from real API
  const therapistData = {
    name: user?.name || therapistProfile?.user?.name || (loading ? 'Chargement...' : 'Dr.'),
    speciality: therapistProfile?.approcheTherapeute || 'Psychologue',
    rating: therapistStats.averageRating,
    sessions: therapistStats.totalRatings,
    online: true,
    avatarUrl: avatarUrl,
  };

  const handleLogout = () => {
    removeToken();
    onNavigateToPage('LANDING');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main text-text-main font-sans flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-text-muted font-medium">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-bg-main text-text-main font-sans flex items-center justify-center p-6">
        <div className="bg-card-bg border border-border-color rounded-3xl p-8 max-w-md text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">Erreur de chargement</h3>
          <p className="text-text-muted text-sm mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-primary text-white rounded-xl font-bold">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

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
              <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">Patients</span>
            </div>

            {patients.length === 0 ? (
              <div className={`transition-all duration-300 ${isSidebarOpen ? 'px-3 py-4 text-center' : 'md:hidden'}`}>
                <p className="text-xs text-text-muted font-medium">Aucun patient actif</p>
              </div>
            ) : (
              patients.map(patient => (
                <button
                  key={patient.id}
                  onClick={() => {
                    setSelectedClient(patient);
                    setActiveTab('chats');
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center rounded-xl transition-all cursor-pointer group
                    ${selectedClient?.id === patient.id && activeTab === 'chats' ? 'bg-primary-light text-primary border border-primary/20' : 'hover:bg-bg-main border border-transparent'}
                    ${isSidebarOpen ? 'p-3 gap-3' : 'p-3 md:justify-center md:gap-0'}
                  `}
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs bg-card-bg border border-border-color shadow-sm">
                      {patient.user?.name ? patient.user.name.charAt(0).toUpperCase() : 'P'}
                    </div>
                  </div>

                  <div className={`flex-1 text-left min-w-0 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 md:w-0 md:h-0 md:overflow-hidden'}`}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-bold text-sm truncate">{patient.user?.name || 'Patient'}</span>
                    </div>
                    <p className="text-xs truncate text-text-muted">
                      {patient.wilaya || 'Wilaya non spécifiée'}
                    </p>
                  </div>
                </button>
              ))
            )}
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
                      therapist={{ 
                        userId: selectedClient.userId,
                        name: selectedClient.user?.name || 'Patient' 
                      }}
conversationId={getConversationId(therapistProfile?.userId, selectedClient.userId)}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 h-full">
                      <div className="w-24 h-24 bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center mb-6 shadow-inner">
                        <MessageSquare size={48} />
                      </div>
                      <h3 className="text-3xl font-black mb-3">Vos consultations</h3>
                      <p className="text-text-muted max-w-sm leading-relaxed font-medium">
                        {patients.length === 0
                          ? 'Aucune conversation pour le moment.'
                          : 'Sélectionnez un patient dans la liste pour reprendre vos échanges en cours.'}
                      </p>
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
                        <p className="text-text-muted font-medium text-sm">Vous avez {requests.length} demande(s) en attente.</p>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {requests.length === 0 ? (
                        <div className="p-10 text-center bg-card-bg border border-dashed border-border-color rounded-3xl flex flex-col items-center justify-center w-full shadow-inner bg-gradient-to-b from-primary/5 to-transparent">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                            <Check className="text-primary" size={24} />
                          </div>
                          <p className="text-xs font-extrabold text-text-main">Toutes les demandes de session ont été traitées !</p>
                          <p className="text-[10px] font-bold text-text-muted mt-1 uppercase tracking-wider">Vous étes é jour dans vos suivis.</p>
                        </div>
                      ) : (
                        requests.map(req => {
                          const apptDate = new Date(req.scheduledAt);
                          const dateStr = apptDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                          const timeStr = `${String(apptDate.getUTCHours()).padStart(2, '0')}:${String(apptDate.getUTCMinutes()).padStart(2, '0')}`;
                          return (
                            <div key={req.id} onClick={() => setSelectedRequest(req)} className="t-card flex flex-col sm:flex-row items-center justify-between gap-6 p-6 group hover:border-primary/40 transition-all border-dashed cursor-pointer bg-card-bg hover:shadow-md">
                              <div className="flex items-center gap-5 w-full sm:w-auto">
                                <div className="w-16 h-16 bg-primary-light text-primary rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-inner border border-primary/10">
                                  {req.patient?.user?.name?.charAt(0) || 'P'}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-extrabold text-xl">{req.patient?.user?.name || 'Patient'}</h4>
                                    <span className="text-[9px] font-black tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase shrink-0">
                                      {req.type === 'video' ? 'Téléconsultation' : req.type === 'in_person' ? 'Cabinet' : 'Téléphone'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-text-muted mt-2">
                                    <span className="flex items-center gap-1.5 text-primary bg-primary/10 px-2 py-1 rounded-lg">
                                      <Clock size={12} /> {dateStr} é {timeStr}
                                    </span>
                                    <span className="bg-bg-main px-2 py-1 rounded-lg border border-border-color">
                                      {req.status === 'scheduled' ? 'Nouvelle demande' : 'Confirmé'}
                                    </span>
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
                          );
                        })
                      )}
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
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 p-3 bg-bg-main/40 border border-border-color rounded-xl">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Légende :</span>
                        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-main"><span className="w-3 h-3 rounded bg-primary"></span>Rendez-vous confirmé</span>
                        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-main"><span className="w-3 h-3 rounded bg-amber-500"></span>Demande en attente</span>
                        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-main"><span className="w-3 h-3 rounded bg-card-bg border border-border-color"></span>Créneau disponible</span>
                        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-main"><span className="w-3 h-3 rounded bg-red-500/60"></span>Créneau indisponible</span>
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
                              const isPastDay = isValidDay && isPastDate(currentYear, currentMonth, dayNumber);
                              return (
                                <div 
                                  key={i} 
                                  onClick={() => {
                                    if (isValidDay && !isPastDay) {
                                      setSelectedDateStr(cellDateStr);
                                    }
                                  }}
                                  className={`p-2 border-r border-b border-border-color last:border-r-0 flex flex-col justify-between group transition-all relative select-none min-h-[7.5rem] ${
                                    isValidDay && !isPastDay
                                      ? 'cursor-pointer hover:bg-primary/[0.03] bg-card-bg' 
                                      : isValidDay && isPastDay
                                        ? 'bg-bg-main/5 opacity-50 cursor-default pointer-events-none'
                                        : 'bg-bg-main/5 text-text-muted/15 pointer-events-none'
                                  }`}
                                >
                                  <div className="flex justify-between items-center w-full mb-1">
                                    <span className={`text-[10px] font-black ${
                                      isValidDay && !isPastDay ? 'text-text-muted/60 group-hover:text-primary transition-colors' : 'text-text-muted/15'
                                    }`}>
                                      {isValidDay ? dayNumber : ''}
                                    </span>
                                    {isValidDay && !isPastDay && (
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (availability.available) {
                                            openManageSlots(cellDateStr);
                                          } else {
                                            handleToggleAvailability(cellDateStr);
                                          }
                                        }}
                                        className={`text-[8px] font-black tracking-wider opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded-md shrink-0 border uppercase cursor-pointer ${
                                          availability.available 
                                            ? 'text-primary bg-primary/10 border-primary/20' 
                                            : 'text-amber-600 bg-amber-50 border-amber-200'
                                        }`}
                                      >
                                        {availability.available ? 'Gérer' : 'Activer'}
                                      </span>
                                    )}
                                  </div>

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
                                        title={`${app.time} - ${app.patient}`}
                                      >
                                        <span className="truncate">{app.time} - {app.patient}</span>
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

                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6 bg-gradient-to-br from-amber-500/5 via-amber-500/10 to-transparent rounded-[2rem] border border-amber-500/15 shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="p-3.5 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
                            <Star size={26} className="fill-current" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-text-main text-left">Statistiques & évaluations globales</h3>
                            <p className="text-xs text-text-muted mt-0.5 font-semibold text-left">Toutes les notes de vos séances s'y répercutent automatiquement.</p>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-extrabold text-amber-500 tracking-tight">{therapistStats.averageRating || 'é'}</span>
                          <span className="text-xs font-black text-text-muted uppercase tracking-wider">/ 5 é ({therapistStats.totalRatings} évaluations)</span>
                        </div>
                      </div>

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
                            {patientNames.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
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

                      <div className="grid gap-4 text-left">
                        {completedSessions.length === 0 ? (
                          <div className="p-16 text-center bg-card-bg border border-dashed border-border-color rounded-3xl flex flex-col items-center justify-center w-full bg-gradient-to-br from-primary/5 to-transparent">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                              <History className="text-primary" size={24} />
                            </div>
                            <p className="text-sm font-bold text-text-main">Aucune séance dans l'historique</p>
                            <p className="text-xs text-text-muted mt-1 font-medium">Les séances terminées apparaétront ici.</p>
                          </div>
                        ) : (
                          (() => {
                            const filtered = completedSessions.filter(s => {
                              const patientName = s.patient?.user?.name || '';
                              const matchSearch = patientName.toLowerCase().includes(sessionSearch.toLowerCase());
                              const matchSelect = selectedPatientFilter === 'ALL' || patientName === selectedPatientFilter;
                              return matchSearch && matchSelect;
                            }).sort((a, b) => {
                              if (sessionSort === 'date-desc') return new Date(b.scheduledAt) - new Date(a.scheduledAt);
                              if (sessionSort === 'date-asc') return new Date(a.scheduledAt) - new Date(b.scheduledAt);
                              if (sessionSort === 'patient-asc') return (a.patient?.user?.name || '').localeCompare(b.patient?.user?.name || '');
                              return 0;
                            });

                            if (filtered.length === 0) {
                              return (
                                <div className="p-16 text-center bg-card-bg border border-dashed border-border-color rounded-3xl flex flex-col items-center justify-center w-full bg-gradient-to-br from-primary/5 to-transparent">
                                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <History className="text-primary" size={24} />
                                  </div>
                                  <p className="text-sm font-bold text-text-main">Aucun résultat</p>
                                  <p className="text-xs text-text-muted mt-1 font-medium">Modifiez vos filtres pour voir plus de séances.</p>
                                </div>
                              );
                            }

                            return filtered.map((session, idx) => {
                              const sessionDate = new Date(session.scheduledAt);
                              const patientName = session.patient?.user?.name || 'Patient';
                              return (
                                <div 
                                  key={session.id || idx}
                                  onClick={() => setSelectedSessionDetails(session)}
                                  className="t-card border-l-4 border-l-primary transition-all duration-300 hover:translate-x-2 cursor-pointer group"
                                >
                                  <div className="flex flex-col md:flex-row justify-between gap-4">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-primary">
                                          {sessionDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-blue-500/10 text-blue-500 border-blue-500/20`}>
                                          Terminée
                                        </span>
                                      </div>
                                      <p className="text-sm text-text-muted">
                                        {patientName} é {session.durationMinutes || 60} min
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 justify-between">
                                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
                                        Détails <ChevronRight size={10} />
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-4xl mx-auto space-y-6">
                      <button
                        onClick={() => setSelectedSessionDetails(null)}
                        className="flex items-center gap-2 text-primary font-bold hover:underline transition-all"
                      >
                        <ArrowLeft size={16} /> Retour é l'historique
                      </button>
                      <div className="t-card">
                        <h3 className="text-xl font-bold mb-4">
                          Détails de la séance é {selectedSessionDetails.patient?.user?.name || 'Patient'}
                        </h3>
                        <p className="text-sm text-text-muted">
                          {new Date(selectedSessionDetails.scheduledAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })} é {selectedSessionDetails.durationMinutes || 60} min
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div 
                  key="settings-view"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex-1 p-4 md:p-12 overflow-y-auto h-full"
                >
                  <div className="max-w-4xl mx-auto space-y-8">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1 text-text-main">Mon Profil</h2>
                      <p className="text-text-muted font-medium text-sm">Gérez votre profil de praticien.</p>
                    </div>

                    <div className="t-card space-y-6">
                      <h3 className="text-lg font-bold">Photo de profil</h3>
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <div className="w-24 h-24 bg-primary-light rounded-full flex items-center justify-center text-primary text-3xl font-black overflow-hidden border-4 border-card-bg shadow-inner">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              therapistData.name?.charAt(0) || 'D'
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setIsAvatarModalOpen(true)}
                          className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                        >
                          <Camera size={16} /> Changer la photo
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-primary">Nom</label>
                          <p className="t-input bg-bg-main/50">{therapistProfile?.user?.name || therapistData.name}</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-primary">Spécialité</label>
                          <p className="t-input bg-bg-main/50">{therapistProfile?.approcheTherapeute || therapistData.speciality}</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-primary">Tarif horaire</label>
                          <p className="t-input bg-bg-main/50">
                            {therapistProfile?.hourlyRate ? `${therapistProfile.hourlyRate} ${therapistProfile.currency || 'DZD'}` : 'Non spécifié'}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-primary">Note moyenne</label>
                          <p className="t-input bg-bg-main/50">{therapistStats.averageRating || 'é'} / 5 ({therapistStats.totalRatings} avis)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Manage Slots Modal */}
      <AnimatePresence>
        {manageSlotModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setManageSlotModal({ open: false, dateStr: null })}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card-bg w-full max-w-lg border border-border-color rounded-3xl shadow-2xl p-6 md:p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold">Gérer les disponibilités</h3>
                  <p className="text-xs text-text-muted">
                    {manageSlotModal.dateStr ? new Date(manageSlotModal.dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                  </p>
                </div>
                <button
                  onClick={() => setManageSlotModal({ open: false, dateStr: null })}
                  className="p-2 hover:bg-bg-main rounded-xl text-text-muted hover:text-red-500 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {manageSlotError && (
                <div className="p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs font-bold text-red-600">
                  <AlertCircle size={14} />
                  {manageSlotError}
                </div>
              )}

              <div className="space-y-2 mb-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Créneaux actuels</h4>
                {slotsForDate.length === 0 ? (
                  <div className="p-4 bg-bg-main border border-dashed border-border-color rounded-xl text-center">
                    <p className="text-xs text-text-muted font-medium">Aucun créneau pour cette date</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {slotsForDate.map(slot => {
                      const isEditing = editingSlotId === slot.id;
                      const badge = getSlotBadgeInfo(slot);
                      return (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between gap-2 p-3 bg-bg-main border border-border-color rounded-xl"
                        >
                          {isEditing ? (
                            <>
                              <div className="flex items-center gap-2 flex-1">
                                <Clock size={14} className="text-primary shrink-0" />
                                <input
                                  type="time"
                                  value={editSlotFrom}
                                  onChange={(e) => setEditSlotFrom(e.target.value)}
                                  className="flex-1 min-w-0 p-1.5 bg-card-bg border border-border-color rounded-lg text-xs font-bold outline-none focus:border-primary"
                                />
                                <span className="text-text-muted text-xs">?</span>
                                <input
                                  type="time"
                                  value={editSlotTo}
                                  onChange={(e) => setEditSlotTo(e.target.value)}
                                  className="flex-1 min-w-0 p-1.5 bg-card-bg border border-border-color rounded-lg text-xs font-bold outline-none focus:border-primary"
                                />
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={handleCancelEditSlot}
                                  className="p-1.5 hover:bg-bg-main text-text-muted hover:text-text-main rounded-lg transition-all"
                                  title="Annuler"
                                >
                                  <X size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSlotInModal(slot.id)}
                                  disabled={editSlotLoading}
                                  className="p-1.5 bg-primary text-white rounded-lg hover:scale-105 transition-all disabled:opacity-40"
                                  title="Enregistrer"
                                >
                                  {editSlotLoading ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Check size={14} />
                                  )}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Clock size={14} className="text-primary shrink-0" />
                                <span className="text-xs font-bold">
                                  {formatTimeUtc(slot.startAt)} - {formatTimeUtc(slot.endAt)}
                                </span>
                                {badge.showBadge && (
                                  <span
                                    className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 border ${badge.classes}`}
                                    title={`Statut du rendez-vous : ${badge.label}`}
                                  >
                                    {badge.label}
                                  </span>
                                )}
                              </div>
                              {!badge.isOccupied && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditSlot(slot)}
                                    className="p-1.5 hover:bg-primary/10 text-text-muted hover:text-primary rounded-lg transition-all"
                                    title="Modifier le créneau"
                                  >
                                    <FileText size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSlotInModal(slot.id)}
                                    disabled={deleteSlotId === slot.id}
                                    className="p-1.5 hover:bg-red-500/10 text-text-muted hover:text-red-500 rounded-lg transition-all disabled:opacity-40"
                                    title="Supprimer le créneau"
                                  >
                                    {deleteSlotId === slot.id ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <Trash2 size={14} />
                                    )}
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-border-color pt-5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">Ajouter un créneau</h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1 block">Début</label>
                    <input
                      type="time"
                      value={addSlotFrom}
                      onChange={(e) => setAddSlotFrom(e.target.value)}
                      className="w-full p-2.5 bg-bg-main border-2 border-border-color rounded-xl text-xs font-bold outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1 block">Fin</label>
                    <input
                      type="time"
                      value={addSlotTo}
                      onChange={(e) => setAddSlotTo(e.target.value)}
                      className="w-full p-2.5 bg-bg-main border-2 border-border-color rounded-xl text-xs font-bold outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="pt-5">
                    <button
                      onClick={handleAddSlotInModal}
                      disabled={manageSlotLoading}
                      className="p-2.5 bg-primary text-white rounded-xl hover:scale-105 transition-all disabled:opacity-40 cursor-pointer"
                    >
                      {manageSlotLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BUG 1 FIX: Détails du RDV Modal é s'affiche quand on clique sur un rendez-vous dans le calendrier */}
      <AnimatePresence>
        {selectedViewAppointment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedViewAppointment(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card-bg w-full max-w-md border border-border-color rounded-3xl shadow-2xl p-6 md:p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Détails du RDV</h3>
                <button
                  onClick={() => setSelectedViewAppointment(null)}
                  className="p-2 hover:bg-bg-main rounded-xl text-text-muted hover:text-red-500 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Patient */}
                <div className="flex items-center gap-3 p-3 bg-bg-main rounded-xl border border-border-color">
                  <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold text-sm">
                    {selectedViewAppointment.patient?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Patient</p>
                    <p className="text-sm font-bold">{selectedViewAppointment.patient}</p>
                  </div>
                </div>

                {/* Date & Heure */}
                <div className="flex items-center gap-3 p-3 bg-bg-main rounded-xl border border-border-color">
                  <Clock size={18} className="text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Date & Heure</p>
                    <p className="text-sm font-bold">
                      {(() => {
                        const d = new Date(selectedViewAppointment.date + 'T12:00:00');
                        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                      })()} é {selectedViewAppointment.time}
                    </p>
                  </div>
                </div>

                {/* Statut */}
                <div className="flex items-center gap-3 p-3 bg-bg-main rounded-xl border border-border-color">
                  <div className={`w-3 h-3 rounded-full ${selectedViewAppointment.status === 'confirmed' ? 'bg-primary' : 'bg-amber-500'}`}></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Statut</p>
                    <p className="text-sm font-bold">
                      {selectedViewAppointment.status === 'confirmed' ? 'Confirmé' : 'En attente'}
                    </p>
                  </div>
                </div>

                {/* Type (déduit de la couleur du badge ou info supplémentaire) */}
                <div className="flex items-center gap-3 p-3 bg-bg-main rounded-xl border border-border-color">
                  <Video size={18} className="text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Mode</p>
                    <p className="text-sm font-bold">Téléconsultation</p>
                  </div>
                </div>
              </div>

              {/* Bouton Supprimer */}
              <div className="mt-8 pt-5 border-t border-border-color">
                <button
                  onClick={() => handleDeleteAppointment(selectedViewAppointment.id)}
                  className="w-full p-4 bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Trash2 size={18} />
                  Supprimer le rendez-vous
                </button>
                <p className="text-[10px] text-text-muted text-center mt-2 font-medium">
                  Le rendez-vous sera annulé et le créneau libéré.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}