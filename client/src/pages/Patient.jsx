import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  MessageSquare,
  Clock,
  RefreshCw,
  Menu,
  X,
  History,
  Star,
  ChevronRight,
  ChevronLeft,
  Info,
  Check,
  Video,
  Phone,
  MapPin,
  User,
  Mail,
  Shield,
  AlertTriangle,
  Loader2,
  Bell,
  CheckCircle2,
  XCircle,
  Trash2,
  CheckCheck,
  UserCheck,
  Target
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ChatWidget from '../components/ChatWidget';
import SessionReport from '../components/SessionReport';
import {
  removeToken,
  patient as patientApi,
  appointment as appointmentApi,
  publicApi,
  notification as notificationApi,
} from '../services/api';
import { useAuth } from '../auth/AuthContext';

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// ---------------------------------------------------------------------------
// Timezone-safe date helpers
// ---------------------------------------------------------------------------
// The backend now stores slot timestamps in the server's local timezone
// and returns them as ISO strings. The frontend formats them with
// `formatYmdLocal()` below to compute the calendar day. NEVER use
// `toISOString().split('T')[0]` for display, because that produces the
// UTC date which can be a day before/after the user's local date.
// ---------------------------------------------------------------------------
const formatYmdLocal = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isPastDate = (year, month, day) => {
  const d = new Date(year, month, day);
  const today = new Date();
  const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return d < todayReset;
};

const formatDateFr = (date) => {
  if (!date) return "";
  const daysFull = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const dayName = daysFull[date.getDay()];
  const dayNum = date.getDate();
  const monthName = MONTHS_FR[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName} ${dayNum} ${monthName} ${year}`;
};

// BUG 1 FIX (client side): UTC-aware date formatter.
// Appointment timestamps are stored in UTC on the server (via Date.UTC).
// When the browser reads them, `date.getDay() / getDate() / getMonth()`
// would apply the local timezone offset, which can shift the displayed
// day for late-evening/early-morning slots. To display the same date
// the therapist entered, we use the UTC getters below.
const formatDateFrUtc = (date) => {
  if (!date) return "";
  const daysFull = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const dayName = daysFull[date.getUTCDay()];
  const dayNum = date.getUTCDate();
  const monthName = MONTHS_FR[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${dayName} ${dayNum} ${monthName} ${year}`;
};

// Format a time from an ISO string using UTC components,
// so 13:00 UTC renders as "13:00" regardless of the browser's timezone.
const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

const getStatusColor = (status) => {
  const colors = {
    scheduled: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    confirmed: 'text-green-500 bg-green-500/10 border-green-500/20',
    completed: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    cancelled: 'text-red-500 bg-red-500/10 border-red-500/20',
    no_show: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
  };
  return colors[status] || 'text-text-muted bg-bg-main border-border-color';
};

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

const getStatusLabel = (status) => {
  const labels = {
    scheduled: 'Programmé',
    confirmed: 'Confirmé',
    completed: 'Terminé',
    cancelled: 'Annulé',
    no_show: 'Absent',
  };
  return labels[status] || status;
};

export default function Patient({ onNavigateToPage, currentTherapist }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [selectedSession, setSelectedSession] = useState(null);

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [patientProfile, setPatientProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [sessionReports, setSessionReports] = useState([]);
  const [therapistInfo, setTherapistInfo] = useState(null);

  // Booking states
  const [bookingStep, setBookingStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [consultationType, setConsultationType] = useState('teleconsultation');
  const [expeditionNotification, setExpeditionNotification] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [lastBooking, setLastBooking] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Rating states
  const [ratingFeedbackSelected, setRatingFeedbackSelected] = useState(0);
  const [ratingFeedbackHover, setRatingFeedbackHover] = useState(0);
  const [ratingFeedbackComment, setRatingFeedbackComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);

  const [showChangeTherapistConfirm, setShowChangeTherapistConfirm] = useState(false);
  
  // Change therapist workflow states
  const [changeTherapistStep, setChangeTherapistStep] = useState('idle'); // idle | checking | warning | results | confirming
  const [changeTherapistInitData, setChangeTherapistInitData] = useState(null);
  const [matchedTherapists, setMatchedTherapists] = useState([]);
  const [changeTherapistLoading, setChangeTherapistLoading] = useState(false);
  const [changeTherapistError, setChangeTherapistError] = useState('');
  const [selectedNewTherapist, setSelectedNewTherapist] = useState(null);
  
  const todayDate = new Date();
  const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth());
  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear());
  const [availableDatesSet, setAvailableDatesSet] = useState(new Set());

  // Load data on mount.
  //
  // The /patients/profile endpoint now returns the assigned therapist
  // directly in `profile.currentTherapist` (with the real name from
  // the User table), so we no longer need to make a second public
  // call to resolve the name. If for any reason the relation is
  // missing (legacy data, mid-migration), we fall back to the first
  // appointment's therapist, then to the prop. We never invent a
  // fake "Mon thérapeute" placeholder anymore.
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, appointmentsRes, reportsRes] = await Promise.all([
          patientApi.getProfile(),
          patientApi.getAppointments(),
          patientApi.getSessionReports(),
        ]);

        const profile = profileRes.data;
        const apps = appointmentsRes.data || [];
        const reports = reportsRes.data || [];

        setPatientProfile(profile);
        setAppointments(apps);
        setSessionReports(reports);

        // 1) Preferred source: the relation included in the profile
        if (profile.currentTherapist && profile.currentTherapist.name) {
          setTherapistInfo({
            id: profile.currentTherapist.id,
            userId: profile.currentTherapist.userId, // User.id du thérapeute (pour l'envoi de messages)
            name: profile.currentTherapist.name,
            speciality: profile.currentTherapist.approcheTherapeute || 'Psychologue',
            profilePhotoUrl: profile.currentTherapist.profilePhotoUrl || null,
          });
        } else if (profile.currentTherapistid) {
          // 2) Fallback: derive from an existing appointment
          const appWithTherapist = apps.find(
            (a) => a.therapistId === profile.currentTherapistid,
          );
          console.log('Fallback appointment therapist:', appWithTherapist);
          if (appWithTherapist && appWithTherapist.therapist?.user?.name) {
            setTherapistInfo({
              id: appWithTherapist.therapistId,
              userId: appWithTherapist.therapist.user.id, // User.id du thérapeute
              name: appWithTherapist.therapist.user.name,
              speciality:
                appWithTherapist.therapist.approcheTherapeute || 'Psychologue',
            });
          } else {
            // 3) Last resort: fetch public profile by id
            try {
              const therapistRes = await publicApi.getTherapistProfile(
                profile.currentTherapistid,
              );
              console.log('Fallback public therapist:', therapistRes.data);
              if (therapistRes.data) {
                setTherapistInfo({
                  id: profile.currentTherapistid,
                  userId: therapistRes.data.user?.id || profile.currentTherapistid,
                  name:
                    therapistRes.data.user?.name ||
                    therapistRes.data.name ||
                    null,
                  speciality:
                    therapistRes.data.approcheTherapeute || 'Psychologue',
                });
              }
            } catch (_) {
              /* leave therapistInfo null */
            }
          }
        } else if (currentTherapist && currentTherapist.name) {
          // 4) Pre-onboarding fallback (e.g. coming from Registration)
          console.log('Fallback currentTherapist prop:', currentTherapist);
          setTherapistInfo({
            id: currentTherapist.id,
            userId: currentTherapist.userId || currentTherapist.id,
            name: currentTherapist.name,
            speciality: currentTherapist.speciality || currentTherapist.approcheTherapeute || 'Psychologue',
          });
        }
      } catch (err) {
        setError(err.message || 'Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentTherapist]);

  // Fetch available slots when the selected date or therapist
  // changes. The query string uses the local YYYY-MM-DD so the
  // server-side timezone arithmetic returns the right day.
  useEffect(() => {
    if (!selectedDate || !therapistInfo?.id) {
      setAvailableSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setSlotsLoading(true);
      try {
        const dateStr = formatYmdLocal(selectedDate);
        const res = await appointmentApi.getAvailableSlots(
          therapistInfo.id,
          dateStr,
        );
        setAvailableSlots(res.data || []);
      } catch (err) {
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };
    fetchSlots();
  }, [selectedDate, therapistInfo?.id]);

  // Fetch which days in the current month have bookable slots
  useEffect(() => {
    if (!therapistInfo?.id) {
      setAvailableDatesSet(new Set());
      return;
    }

    const fetchMonthAvailability = async () => {
      try {
        const res = await appointmentApi.getMonthAvailability(
          therapistInfo.id,
          currentYear,
          currentMonth + 1, // API expects 1-based month
        );
        setAvailableDatesSet(new Set(res.data || []));
      } catch (err) {
        // Non-fatal: fall back to empty set (all days appear unavailable)
        setAvailableDatesSet(new Set());
      }
    };
    fetchMonthAvailability();
  }, [therapistInfo?.id, currentYear, currentMonth]);

  const handleRateSession = async (appointmentId, rating, comment) => {
    setRatingLoading(true);
    try {
      // Update the session report with rating
      await appointmentApi.createSessionReport(appointmentId, {
        rating,
        comment,
        isConfidential: false,
        isAnonymous: false,
        sessionNotes: '',
        interventionsUsed: [],
      });

      // Refresh data
      const reportsRes = await patientApi.getSessionReports();
      setSessionReports(reportsRes.data || []);

      setRatingFeedbackSelected(0);
      setRatingFeedbackComment('');
    } catch (err) {
      console.error('Error submitting rating:', err);
    } finally {
      setRatingLoading(false);
    }
  };

  // -----------------------------------------------------------------
  // Notifications state and helpers
  // -----------------------------------------------------------------
  // The patient receives a notification whenever their appointment
  // is refused (scheduled → cancelled) or cancelled by the therapist
  // (confirmed → cancelled). The backend stores the contextual copy
  // (date, time, therapist name) directly on the notification row, so
  // the client just has to display it.
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await notificationApi.getUnreadCount();
      setUnreadCount(res?.data?.count ?? 0);
    } catch (err) {
      // Non-fatal: silently keep the previous count.
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await notificationApi.getAll({ page: 1, limit: 50 });
      setNotifications(res?.data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  // Poll the unread count on mount and every 30s so refus/annulation
  // notifications emitted by the therapist appear without a refresh.
  useEffect(() => {
    refreshUnreadCount();
    const id = setInterval(refreshUnreadCount, 30000);
    return () => clearInterval(id);
  }, [refreshUnreadCount]);

  // When the user opens the Notifications tab, do a full fetch and
  // mark any newly-loaded entries as read.
  useEffect(() => {
    if (activeTab === 'notifications') {
      loadNotifications().then(() => {
        // Optimistically mark everything as read on the server, then
        // refresh the badge so it goes back to 0.
        notificationApi
          .markAllAsRead()
          .then(() => refreshUnreadCount())
          .catch((err) => console.error('Failed to mark all as read:', err));
      });
    }
  }, [activeTab, loadNotifications, refreshUnreadCount]);

  const handleMarkAsRead = async (id) => {
    // Optimistic update so the card visually fades immediately.
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    try {
      await notificationApi.markAsRead(id);
      refreshUnreadCount();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleDeleteNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await notificationApi.delete(id);
      refreshUnreadCount();
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Visual config for each notification type so refus / cancellation
  // are easy to tell apart at a glance.
  const notificationStyle = {
    appointment_refused: {
      icon: XCircle,
      ring: 'border-orange-500/30',
      bg: 'bg-orange-500/5',
      iconBg: 'bg-orange-500/10 text-orange-600',
    },
    appointment_cancelled: {
      icon: XCircle,
      ring: 'border-red-500/30',
      bg: 'bg-red-500/5',
      iconBg: 'bg-red-500/10 text-red-600',
    },
    appointment_confirmed: {
      icon: CheckCircle2,
      ring: 'border-green-500/30',
      bg: 'bg-green-500/5',
      iconBg: 'bg-green-500/10 text-green-600',
    },
    appointment_completed: {
      icon: CheckCircle2,
      ring: 'border-blue-500/30',
      bg: 'bg-blue-500/5',
      iconBg: 'bg-blue-500/10 text-blue-600',
    },
    appointment_no_show: {
      icon: AlertTriangle,
      ring: 'border-gray-500/30',
      bg: 'bg-gray-500/5',
      iconBg: 'bg-gray-500/10 text-gray-600',
    },
  };

  const getNotificationStyle = (type) =>
    notificationStyle[type] || {
      icon: Bell,
      ring: 'border-primary/20',
      bg: 'bg-primary/5',
      iconBg: 'bg-primary/10 text-primary',
    };

  // Human-friendly relative time, used in the notification card.
  const formatRelativeTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `il y a ${h} h`;
    const days = Math.round(h / 24);
    if (days < 7) return `il y a ${days} j`;
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    });
  };

  const therapist = useMemo(() => {
    // The therapist name is now sourced exclusively from the backend
    // relation `Patient.currentTherapist.user.name`. If the patient
    // does not yet have a therapist, `therapist` is null and the UI
    // renders a dedicated empty-state CTA instead of a fake name.
    if (therapistInfo && therapistInfo.name) return therapistInfo;
    if (currentTherapist && currentTherapist.name) return currentTherapist;
    return null;
  }, [therapistInfo, currentTherapist]);

  // Computed conversation ID for the chat widget
  // Note : on utilise user?.id depuis AuthContext car le backend utilise
  // des tokens de session hexadécimaux (pas des JWT). L'ancien code
  // qui faisait atob(token.split('.')[1]) échouait silencieusement.
  const patientConvId = useMemo(() => {
    const currentUserId = user?.id || null;
    return getConversationId(therapist?.userId, currentUserId);
  }, [therapist?.userId, user?.id]);

  // Safe-to-render name for the assigned therapist. Never null.
  // Used in copy where the therapist is mentioned (toast, modal copy...).
  // When no therapist is assigned, we fall back to a neutral phrase
  // so the UI never crashes on a missing relation.
  const therapistDisplayName = therapist?.name || 'votre thérapeute';

  const activeAppointments = useMemo(() => {
    return appointments.filter(a => 
      (a.status === 'scheduled' || a.status === 'confirmed') && 
      new Date(a.scheduledAt) > new Date()
    ).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  }, [appointments]);

  const pastAppointments = useMemo(() => {
    return appointments.filter(a => 
      a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show' ||
      new Date(a.scheduledAt) < new Date()
    ).sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
  }, [appointments]);

  const handlePrevMonth = () => {
    const today = new Date();
    if (currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
      return;
    }
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const { blanks, days } = useMemo(() => {
    const d1 = new Date(currentYear, currentMonth, 1);
    let startingDayIndex = d1.getDay();
    startingDayIndex = (startingDayIndex + 6) % 7;
    
    const numDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    return {
      blanks: Array(startingDayIndex).fill(null),
      days: Array.from({ length: numDays }, (_, i) => i + 1)
    };
  }, [currentYear, currentMonth]);

  // Check if a date has available slots using the fetched month availability data
  const dateHasSlots = useCallback((year, month, day) => {
    if (isPastDate(year, month, day)) return false;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return availableDatesSet.has(dateStr);
  }, [availableDatesSet]);

  const handleCompleteBooking = async () => {
    if (!selectedDate || !selectedTimeSlot || !selectedSlotId || !therapistInfo?.id) {
      setBookingError('Veuillez sélectionner une date et un créneau.');
      return;
    }

    setBookingLoading(true);
    setBookingError('');

    try {
      // Use the slot itself as the source of truth for the start
      // time. We still need to send `scheduledAt` in the request
      // body (the backend validates it against the slot), so we
      // forward `slot.startAt` verbatim — no client-side
      // reconstruction that could disagree with the server.
      const slot = availableSlots.find((s) => s.id === selectedSlotId);
      if (!slot) {
        throw new Error('Créneau introuvable. Veuillez le re-sélectionner.');
      }
      const scheduledAtIso = new Date(slot.startAt).toISOString();

      const response = await appointmentApi.create({
        therapistId: therapistInfo.id,
        scheduledAt: scheduledAtIso,
        durationMinutes: 60,
        type:
          consultationType === 'cabinet'
            ? 'in_person'
            : consultationType === 'phone'
              ? 'phone'
              : 'video',
        therapistAvailableTimeSlotId: selectedSlotId,
      });

      setLastBooking(response.data);
      setAppointments((prev) => [response.data, ...prev]);
      setBookingStep(2);
      setExpeditionNotification(true);
      setTimeout(() => {
        setExpeditionNotification(false);
      }, 6000);
    } catch (err) {
      setBookingError(err.message || 'Erreur lors de la réservation');
    } finally {
      setBookingLoading(false);
    }
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-bg-main text-text-main font-sans flex items-center justify-center p-6">
        <div className="bg-card-bg border border-border-color rounded-3xl p-8 max-w-md text-center shadow-xl">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
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
    <div className="min-h-screen bg-bg-main text-text-main font-sans selection:bg-primary-light">
      {/* Toast de confirmation de l'expédition */}
      <AnimatePresence>
        {expeditionNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-28 right-6 z-[999] max-w-sm w-full bg-card-bg border-l-4 border-l-green-500 border border-border-color shadow-2xl rounded-2xl p-5"
          >
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center shrink-0">
                <Check size={20} />
              </div>
              <div className="space-y-1">
                <p className="font-extrabold text-sm text-text-main">
                  Expédition confirmée !
                </p>
                <p className="text-[11px] text-text-muted leading-relaxed font-semibold">
                  Votre demande de session a bien été expédiée avec succès à {therapistDisplayName}.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Header 
        onLogin={() => onNavigateToPage('LOGIN')} 
        onAbout={() => onNavigateToPage('ABOUT')}
        onHome={() => onNavigateToPage('REGISTRATION')}
        user={user ? { name: user.name || 'Patient', email: user.email || '', role: 'PATIENT' } : (patientProfile ? { name: patientProfile.user?.name || 'Patient', email: patientProfile.user?.email || '', role: 'PATIENT' } : null)}
        onLogout={() => { removeToken(); onNavigateToPage('LANDING'); }}
        onNavigateToPage={onNavigateToPage}
      />

      <div className="pt-24 flex min-h-screen relative overflow-hidden">
        
        {/* Toggle Sidebar Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`fixed left-6 top-[140px] z-[80] p-3 bg-card-bg border border-border-color rounded-xl shadow-lg hover:text-primary transition-all ${isSidebarOpen ? 'translate-x-[280px] lg:translate-x-[320px]' : 'translate-x-0'}`}
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Sidebar Nav */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] lg:hidden"
              />
              <motion.aside 
                initial={{ x: -400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -400, opacity: 0 }}
                className="fixed left-6 top-32 z-[70] w-[280px] lg:w-[320px] h-[calc(100vh-160px)] max-h-[720px] bg-card-bg border border-border-color rounded-3xl p-6 overflow-y-auto shadow-2xl"
              >
                <div className="space-y-6">
                  {therapist ? (
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center text-primary font-black text-xl shadow-inner border-2 border-card-bg transition-colors">
                        {therapist.name ? therapist.name.charAt(0).toUpperCase() : 'T'}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">{therapist.name}</h2>
                        <p className="text-primary text-[10px] font-bold uppercase tracking-wider">{therapist.speciality || therapist.approcheTherapeute || 'Psychologue'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-6 p-3 bg-bg-main border border-dashed border-border-color rounded-2xl">
                      <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center text-primary font-black text-xl shadow-inner border-2 border-card-bg">
                        T
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-text-main">Aucun thérapeute</h2>
                        <p className="text-primary text-[10px] font-bold uppercase tracking-wider">Choisir un praticien</p>
                      </div>
                    </div>
                  )}

                  <nav className="space-y-2">
                    <button 
                      onClick={() => { setActiveTab('chat'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-bg-main text-text-muted'}`}
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare size={18} />
                        <span className="font-bold">Messagerie</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => { setActiveTab('appointments'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeTab === 'appointments' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-bg-main text-text-muted'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Calendar size={18} />
                        <span className="font-bold">Rendez-vous</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setActiveTab('history'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeTab === 'history' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-bg-main text-text-muted'}`}
                    >
                      <div className="flex items-center gap-3">
                        <History size={18} />
                        <span className="font-bold">Historique</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setActiveTab('notifications'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeTab === 'notifications' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-bg-main text-text-muted'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Bell size={18} />
                        <span className="font-bold">Notifications</span>
                      </div>
                      {unreadCount > 0 && (
                        <span
                          data-testid="unread-badge"
                          className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${
                            activeTab === 'notifications'
                              ? 'bg-white text-primary'
                              : 'bg-red-500 text-white animate-pulse'
                          }`}
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                  </nav>

                  {patientProfile?.currentTherapistid && (
                    <div className="mt-8 pt-6 border-t border-border-color">
                      <button 
                        onClick={() => setShowChangeTherapistConfirm(true)}
                        className="w-full flex items-center justify-center gap-2 p-4 text-primary font-bold hover:bg-primary-light rounded-xl transition-all group"
                      >
                        <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                        Changer de thérapeute
                      </button>
                      <p className="text-[10px] text-text-muted text-center mt-2 font-medium italic">
                        Cette action vous dissociera du praticien actuel.
                      </p>
                    </div>
                  )}

                  <div className="p-6 bg-primary/5 border border-primary/10 rounded-2xl">
                    <h4 className="font-bold flex items-center gap-2 mb-3 text-sm">
                      <Info size={14} className="text-primary" /> Note importante
                    </h4>
                    <p className="text-[10px] text-text-muted leading-relaxed font-medium">
                      En cas d'urgence immédiate, veuillez contacter les services de secours (14 ou 17).
                    </p>
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className={`flex-1 p-3 lg:p-6 transition-all duration-300 ${isSidebarOpen ? 'lg:pl-[368px]' : 'lg:pl-0'} flex flex-col`}>
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
            <AnimatePresence mode="wait">
              {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <ChatWidget therapist={therapist || undefined} conversationId={patientConvId} />
                </div>
              )}

              {activeTab === 'appointments' && (
                <motion.div 
                  key="appointments"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="space-y-8"
                >
                  <div className="t-card">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-2xl font-bold">Vos Rendez-vous</h3>
                        <p className="text-text-muted font-medium">Gérez vos prochaines séances.</p>
                      </div>
                      <Calendar className="w-10 h-10 text-primary opacity-20" />
                    </div>

                    <div className="space-y-3">
                      {activeAppointments.length === 0 ? (
                        <div className="p-6 text-center bg-bg-main border border-dashed border-border-color rounded-2xl">
                          <p className="text-text-muted font-medium">Aucun rendez-vous à venir</p>
                        </div>
                      ) : (
                        activeAppointments.map((appt) => {
                          const apptDate = new Date(appt.scheduledAt);
                          const monthsShort = ["JAN", "FEV", "MAR", "AVR", "MAI", "JUN", "JUL", "AOU", "SEP", "OCT", "NOV", "DEC"];
                          return (
                            <div key={appt.id} className="p-5 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:bg-primary/[0.08]">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-card-bg rounded-xl shadow-sm flex flex-col items-center justify-center border border-primary/10">
                                  <span className="text-[10px] font-bold text-primary uppercase">{monthsShort[apptDate.getUTCMonth()]}</span>
                                  <span className="text-lg font-black text-primary -mt-1">{String(apptDate.getUTCDate()).padStart(2, '0')}</span>
                                </div>
                                <div>
                                  <p className="font-bold text-text-main">Séance de suivi</p>
                                  <p className="text-sm font-medium text-text-muted">
                                    {formatDateFrUtc(apptDate)} à {formatTime(appt.scheduledAt)} 
                                    {appt.therapist?.user?.name ? ` • ${appt.therapist.user.name}` : ''}
                                    {appt.type ? ` (${appt.type === 'video' ? 'Téléconsultation' : appt.type === 'in_person' ? 'Cabinet' : 'Téléphone'})` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border ${getStatusColor(appt.status)}`}>
                                  {getStatusLabel(appt.status)}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="t-card pt-8">
                    <h4 className="font-bold mb-6 flex items-center gap-2">
                      <Clock size={18} className="text-primary" /> Réserver une nouvelle séance
                    </h4>

                    {bookingError && (
                      <div className="p-4 mb-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                        <p className="text-red-600 font-medium text-sm">{bookingError}</p>
                      </div>
                    )}

                    {bookingStep === 0 && !therapist && (
                      <div className="p-8 md:p-12 bg-card-bg border-2 border-dashed border-border-color rounded-3xl text-center space-y-4 shadow-lg">
                        <div className="w-16 h-16 bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                          <AlertTriangle size={28} />
                        </div>
                        <div className="space-y-2">
                          <h5 className="font-extrabold text-lg text-text-main">Choisissez d'abord un thérapeute</h5>
                          <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
                            La réservation d'une séance nécessite qu'un praticien vous soit assigné.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onNavigateToPage('REGISTRATION', { mode: 'RESULTS' })}
                          className="t-btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-extrabold text-white shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                        >
                          Choisir un praticien <ChevronRight size={14} />
                        </button>
                      </div>
                    )}

                    {bookingStep === 0 && therapist && (
                      <div className="space-y-6">
                        {therapist ? (
                          <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-3.5 mb-2">
                            <div className="mt-0.5 text-primary shrink-0">
                              <Calendar size={18} />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Réservation</p>
                              <p className="text-xs text-text-main font-semibold leading-relaxed">
                                Sélectionnez une date, un créneau horaire et le mode de consultation pour réserver une séance avec <span className="text-primary font-bold">{therapist.name}</span>.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-start gap-3.5 mb-2">
                            <div className="mt-0.5 text-amber-600 shrink-0">
                              <AlertTriangle size={18} />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">Aucun thérapeute</p>
                              <p className="text-xs text-text-main font-semibold leading-relaxed">
                                Pour réserver une séance, vous devez d'abord choisir un praticien.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="grid lg:grid-cols-12 gap-8 items-start">
                          <div className="lg:col-span-8 space-y-8">
                            
                            {/* Date Selector */}
                            <div>
                              <label className="block text-[11px] font-black uppercase tracking-widest text-primary mb-3">
                                1. Sélectionner une date
                              </label>
                              <div className="p-5 bg-bg-main border-2 border-border-color rounded-2xl">
                                
                                <div className="flex items-center justify-between mb-5">
                                  <button
                                    type="button"
                                    onClick={handlePrevMonth}
                                    disabled={currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear()}
                                    className="p-2 border border-border-color hover:border-primary hover:text-primary rounded-xl transition-all cursor-pointer disabled:opacity-25 disabled:pointer-events-none"
                                  >
                                    <ChevronLeft size={16} />
                                  </button>
                                  <span className="font-black text-sm text-text-main uppercase tracking-widest">
                                    {MONTHS_FR[currentMonth]} {currentYear}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={handleNextMonth}
                                    className="p-2 border border-border-color hover:border-primary hover:text-primary rounded-xl transition-all cursor-pointer"
                                  >
                                    <ChevronRight size={16} />
                                  </button>
                                </div>

                                <div className="grid grid-cols-7 gap-1 md:gap-2 text-center text-[10px] font-black uppercase text-text-muted tracking-widest mb-3 border-b border-border-color/10 pb-2">
                                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(dayHeader => (
                                    <div key={dayHeader} className="py-1">{dayHeader}</div>
                                  ))}
                                </div>

                                <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                                  {blanks.map((_, i) => (
                                    <div key={`blank-${i}`} className="aspect-square" />
                                  ))}
                                  {days.map(day => {
                                    const isSelected = selectedDate && selectedDate.getDate() === day && selectedDate.getMonth() === currentMonth && selectedDate.getFullYear() === currentYear;
                                    const isSelectable = dateHasSlots(currentYear, currentMonth, day);
                                    return (
                                      <button
                                        key={day}
                                        disabled={!isSelectable}
                                        type="button"
                                        onClick={() => {
                                          const date = new Date(currentYear, currentMonth, day);
                                          setSelectedDate(date);
                                          setSelectedTimeSlot(null);
                                          setSelectedSlotId(null);
                                        }}
                                        className={`
                                          aspect-square rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer
                                          ${isSelected 
                                            ? 'bg-primary text-white shadow-md shadow-primary/20 scale-105 z-10 font-bold' 
                                            : isSelectable 
                                              ? 'bg-primary/5 hover:bg-primary/10 text-primary border border-primary/25 hover:scale-105' 
                                              : 'text-text-muted opacity-25 border border-transparent cursor-not-allowed font-medium'
                                          }
                                        `}
                                      >
                                        {day}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="mt-5 pt-4 border-t border-border-color/40 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded bg-primary/15 border border-primary/25" />
                                    <span>Disponible</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded bg-primary" />
                                    <span>Sélectionné</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded bg-bg-main border border-transparent opacity-30" />
                                    <span>Indisponible</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Time Slot Selection */}
                            <div>
                              <label className="block text-[11px] font-black uppercase tracking-widest text-primary mb-3">
                                2. Choisir un créneau horaire
                              </label>
                              {!selectedDate ? (
                                <div className="p-6 bg-bg-main border-2 border-dashed border-border-color rounded-2xl flex flex-col items-center justify-center text-center text-text-muted space-y-2">
                                  <Clock size={24} className="opacity-40" />
                                  <p className="text-xs font-bold uppercase tracking-wider">Veuillez d'abord sélectionner une date valide</p>
                                </div>
                              ) : slotsLoading ? (
                                <div className="p-6 bg-bg-main border-2 border-dashed border-border-color rounded-2xl flex flex-col items-center justify-center text-center text-text-muted space-y-2">
                                  <Loader2 size={24} className="animate-spin opacity-40" />
                                  <p className="text-xs font-bold uppercase tracking-wider">Chargement des créneaux...</p>
                                </div>
                              ) : availableSlots.length === 0 ? (
                                <div className="p-6 bg-bg-main border-2 border-dashed border-border-color rounded-2xl flex flex-col items-center justify-center text-center text-text-muted space-y-2">
                                  <Clock size={24} className="opacity-40" />
                                  <p className="text-xs font-bold uppercase tracking-wider">Aucun créneau disponible pour cette date</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                  {availableSlots.map(slot => {
                                    const timeStr = formatTime(slot.startAt);
                                    const isSlotSelected = selectedSlotId === slot.id;
                                    return (
                                      <button
                                        key={slot.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedTimeSlot(timeStr);
                                          setSelectedSlotId(slot.id);
                                        }}
                                        className={`
                                          py-3 px-2 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer
                                          ${isSlotSelected 
                                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/15 scale-105 z-10' 
                                            : 'bg-bg-main hover:bg-primary-light border-border-color text-text-main hover:border-primary/40 hover:text-primary'
                                          }
                                        `}
                                      >
                                        {timeStr}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Consultation Mode Selection */}
                            <div>
                              <label className="block text-[11px] font-black uppercase tracking-widest text-primary mb-3">
                                3. Mode de consultation
                              </label>
                              <div className="grid sm:grid-cols-3 gap-3">
                                {[
                                  { id: 'teleconsultation', name: 'Téléconsultation', desc: 'Vidéo en ligne', icon: Video },
                                  { id: 'cabinet', name: 'En Cabinet', desc: 'Présentiel', icon: MapPin },
                                  { id: 'phone', name: 'Téléphone', desc: 'Appel vocal', icon: Phone }
                                ].map(type => {
                                  const IconComp = type.icon;
                                  const isTypeSelected = consultationType === type.id;
                                  return (
                                    <button
                                      key={type.id}
                                      type="button"
                                      onClick={() => setConsultationType(type.id)}
                                      className={`
                                        p-4 text-left rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3.5 group
                                        ${isTypeSelected 
                                          ? 'bg-primary-light border-primary text-primary shadow-sm' 
                                          : 'bg-bg-main border-border-color hover:border-primary/40 hover:bg-primary-light/30'
                                        }
                                      `}
                                    >
                                      <div className={`p-2.5 rounded-xl transition-colors ${isTypeSelected ? 'bg-primary text-white' : 'bg-card-bg text-text-muted group-hover:bg-primary/10 group-hover:text-primary'}`}>
                                        <IconComp size={16} />
                                      </div>
                                      <div>
                                        <p className="font-bold text-xs text-text-main">{type.name}</p>
                                        <p className="text-[10px] text-text-muted font-bold font-mono">{type.desc}</p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Dynamic Side Summary */}
                          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
                            <div className="t-card border border-border-color p-5 space-y-5 bg-card-bg shadow-lg rounded-2xl">
                              <h5 className="font-black text-[10px] uppercase text-text-muted tracking-widest border-b border-border-color/30 pb-3">
                                Récapitulatif
                              </h5>
                              <div className="space-y-4">
                                {therapist ? (
                                  <div className="flex items-center gap-3 bg-primary-light/40 p-3 rounded-2xl border border-primary/10">
                                    <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-black text-sm">
                                      {therapist.name ? therapist.name.charAt(0).toUpperCase() : 'T'}
                                    </div>
                                    <div>
                                      <p className="font-black text-xs text-text-main">{therapist.name}</p>
                                      <p className="text-[9px] font-bold text-primary uppercase tracking-wider">{therapist.speciality || 'Psychologue'}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 bg-bg-main p-3 rounded-2xl border border-dashed border-border-color">
                                    <div className="w-10 h-10 bg-text-muted/20 text-text-muted rounded-xl flex items-center justify-center font-black text-sm">
                                      T
                                    </div>
                                    <div>
                                      <p className="font-black text-xs text-text-main">Aucun praticien</p>
                                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Choisissez un thérapeute</p>
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-3 pt-3">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-text-muted font-bold">Date</span>
                                    <span className="font-bold text-text-main text-right">
                                      {selectedDate ? formatDateFr(selectedDate) : <span className="text-amber-500 font-bold italic">En attente</span>}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs border-t border-border-color/30 pt-3">
                                    <span className="text-text-muted font-bold">Heure</span>
                                    <span className="font-bold text-text-main text-right">
                                      {selectedTimeSlot ? selectedTimeSlot : <span className="text-amber-500 font-bold italic">En attente</span>}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs border-t border-border-color/30 pt-3">
                                    <span className="text-text-muted font-bold">Mode</span>
                                    <span className="font-semibold text-text-main text-right">
                                      {consultationType === 'cabinet' && '📍 En cabinet'}
                                      {consultationType === 'teleconsultation' && '💻 Téléconsultation'}
                                      {consultationType === 'phone' && '📞 Appel vocal'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={!selectedDate || !selectedTimeSlot || !selectedSlotId}
                                onClick={() => setBookingStep(1)}
                                className="t-btn-primary w-full py-4 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] disabled:hover:scale-100 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer font-bold transition-all text-xs text-white"
                              >
                                Continuer <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {bookingStep === 1 && (
                      <div className="max-w-xl mx-auto space-y-6">
                        <div className="p-6 md:p-8 bg-card-bg border-2 border-border-color rounded-3xl shadow-lg space-y-6 text-center">
                          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                            <Calendar size={28} />
                          </div>
                          
                          <div className="space-y-2">
                            <h5 className="font-extrabold text-lg text-text-main">
                              Demande de session
                            </h5>
                            <p className="text-xs text-text-muted leading-relaxed">
                              Vous êtes sur le point d'envoyer votre demande de session avec votre thérapeute.
                            </p>
                          </div>

                          <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl text-left space-y-3 text-xs">
                            <div className="flex justify-between border-b border-border-color/30 pb-2">
                              <span className="text-text-muted font-bold">Thérapeute :</span>
                              <span className="font-bold text-text-main">{therapist?.name || lastBooking.therapist?.user?.name || 'votre thérapeute'}</span>
                            </div>
                            <div className="flex justify-between border-b border-border-color/30 pb-2">
                              <span className="text-text-muted font-bold">Date :</span>
                              <span className="font-bold text-text-main">
                                {selectedDate ? formatDateFr(selectedDate) : ''}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-border-color/30 pb-2">
                              <span className="text-text-muted font-bold">Heure :</span>
                              <span className="font-bold text-text-main">{selectedTimeSlot}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-muted font-bold">Mode :</span>
                              <span className="font-semibold text-text-main">
                                {consultationType === 'cabinet' && '📍 En cabinet'}
                                {consultationType === 'teleconsultation' && '💻 Téléconsultation'}
                                {consultationType === 'phone' && '📞 Appel vocal'}
                              </span>
                            </div>
                          </div>

                          {bookingLoading ? (
                            <div className="flex items-center justify-center gap-2 py-4">
                              <Loader2 size={20} className="animate-spin text-primary" />
                              <span className="text-sm font-bold text-text-muted">Réservation en cours...</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={handleCompleteBooking}
                              className="t-btn-primary w-full py-4 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer font-bold transition-all text-xs text-white"
                            >
                              Confirmer ma demande de session <Check size={14} />
                            </button>
                          )}
                        </div>

                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => setBookingStep(0)}
                            className="text-xs font-bold text-text-muted hover:text-primary transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ChevronLeft size={14} /> Retour
                          </button>
                        </div>
                      </div>
                    )}

                    {bookingStep === 2 && lastBooking && (
                      <div className="p-6 md:p-10 bg-primary/5 border border-primary/20 rounded-3xl flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30 animate-bounce">
                          <Check size={32} />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xl font-extrabold text-text-main">Demande de session expédiée !</h4>
                          <p className="text-xs text-text-muted max-w-md font-medium leading-relaxed">
                            Votre demande de session a bien été expédiée. Votre praticien a été notifié.
                          </p>
                        </div>

                        <div className="p-4 bg-card-bg border border-border-color rounded-2xl w-full max-w-sm text-left space-y-3 shadow-sm text-xs">
                          <div className="flex justify-between border-b border-border-color/40 pb-2">
                            <span className="text-text-muted font-bold">Thérapeute :</span>
                            <span className="font-bold text-text-main">{lastBooking.therapist?.user?.name || therapist?.name || 'votre th\u00e9rapeute'}</span>
                          </div>
                          <div className="flex justify-between border-b border-border-color/40 pb-2">
                            <span className="text-text-muted font-bold">Date & Heure :</span>
                            <span className="font-bold text-primary text-right">{formatDateFrUtc(new Date(lastBooking.scheduledAt))} à {formatTime(lastBooking.scheduledAt)}</span>
                          </div>
                          <div className="flex justify-between border-b border-border-color/40 pb-2">
                            <span className="text-text-muted font-bold">Mode :</span>
                            <span className="font-bold text-text-main text-right">
                              {lastBooking.type === 'video' && '💻 Téléconsultation'}
                              {lastBooking.type === 'in_person' && '📍 En cabinet'}
                              {lastBooking.type === 'phone' && '📞 Appel vocal'}
                            </span>
                          </div>
                          <div className="flex justify-between pt-0.5">
                            <span className="text-text-muted font-bold">ID Session :</span>
                            <span className="font-mono font-bold text-[10px] uppercase tracking-wider text-text-muted">
                              {lastBooking.id ? lastBooking.id.substring(0, 8).toUpperCase() : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setBookingStep(0);
                              setSelectedDate(null);
                              setSelectedTimeSlot(null);
                              setSelectedSlotId(null);
                              setLastBooking(null);
                            }}
                            className="flex-1 py-3 px-4 text-xs font-bold border border-border-color rounded-xl hover:bg-bg-main transition-all cursor-pointer text-text-main"
                          >
                            Nouvelle séance
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('chat')}
                            className="flex-1 py-3 px-4 text-xs font-bold bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <MessageSquare size={14} /> Messagerie
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div 
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="space-y-6"
                >
                  {!selectedSession ? (
                    <>
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-2xl font-bold">Historique des séances</h3>
                          <p className="text-text-muted font-medium">Consultez vos échanges passés et vos progrès.</p>
                        </div>
                        <History className="w-10 h-10 text-primary opacity-20" />
                      </div>

                      <div className="grid gap-6">
                        {/* Past appointments as history items */}
                        {pastAppointments.map((appt) => {
                          const apptDate = new Date(appt.scheduledAt);
                          // Find matching session report for this appointment
                          const report = sessionReports.find(r => r.appointmentId === appt.id);
                          const hasRating = report?.rating > 0 || appt.appointmentOutcome?.rating > 0;
                          const apptRating = report?.rating || appt.appointmentOutcome?.rating || 0;
                          
                          return (
                            <div 
                              key={appt.id} 
                              onClick={() => setSelectedSession({ ...appt, report })}
                              className={`t-card border-l-4 transition-all duration-300 hover:translate-x-2 cursor-pointer group ${
                                hasRating 
                                  ? 'border-l-primary hover:border-primary/50' 
                                  : appt.status === 'completed'
                                    ? 'border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10 border-amber-500'
                                    : 'border-l-gray-400'
                              }`}
                            >
                              <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-primary">{formatDateFrUtc(apptDate)} à {formatTime(appt.scheduledAt)}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${getStatusColor(appt.status)}`}>
                                      {getStatusLabel(appt.status)}
                                    </span>
                                    {appt.status === 'completed' && !hasRating && (
                                      <span className="text-[10px] uppercase tracking-widest font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-full animate-pulse">À évaluer</span>
                                    )}
                                  </div>
                                  <p className="text-sm text-text-muted">
                                    {appt.therapist?.user?.name || 'Thérapeute'} • {appt.durationMinutes || 60} min
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-2 justify-between">
                                  <div className="flex gap-1 text-yellow-500">
                                    {hasRating ? (
                                      [...Array(5)].map((_, i) => (
                                        <Star key={i} size={14} className={i < apptRating ? 'fill-current' : 'opacity-20'} />
                                      ))
                                    ) : appt.status === 'completed' ? (
                                      <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Noter cette séance</span>
                                    ) : null}
                                  </div>
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
                                    Détails <ChevronRight size={10} />
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {pastAppointments.length === 0 && (
                          <div className="p-12 text-center bg-card-bg border border-dashed border-border-color rounded-3xl">
                            <History className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
                            <p className="font-bold text-text-main">Aucun historique</p>
                            <p className="text-text-muted text-sm">Vos séances passées apparaîtront ici.</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6"
                    >
                      <button 
                        onClick={() => setSelectedSession(null)}
                        className="flex items-center gap-2 text-primary font-bold hover:underline mb-4"
                      >
                        <ChevronRight size={16} className="rotate-180" /> Retour à l'historique
                      </button>

                      <div className="space-y-6">
                        {/* Rating form for unrated completed sessions */}
                        {selectedSession.status === 'completed' && 
                         !selectedSession.appointmentOutcome?.rating && 
                         !selectedSession.report?.rating && (
                          <div className="t-card border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-transparent p-6 rounded-3xl space-y-4">
                            <div className="flex items-start gap-4">
                              <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md">
                                <Star size={24} className="fill-current animate-pulse" />
                              </div>
                              <div>
                                <h4 className="font-extrabold text-base text-text-main text-left">Évaluer cette séance</h4>
                                <p className="text-xs text-text-muted text-left mt-0.5">Prenez un instant pour noter la qualité de l'échange.</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4 pt-3 text-left">
                              <div>
                                <label className="block text-[11px] font-black uppercase text-amber-600 tracking-wider mb-2">Note</label>
                                <div className="flex gap-2">
                                  {[1, 2, 3, 4, 5].map((star) => {
                                    const isLight = ratingFeedbackHover >= star || ratingFeedbackSelected >= star;
                                    return (
                                      <button
                                        type="button"
                                        key={star}
                                        onClick={() => setRatingFeedbackSelected(star)}
                                        onMouseEnter={() => setRatingFeedbackHover(star)}
                                        onMouseLeave={() => setRatingFeedbackHover(0)}
                                        className="p-2 rounded-xl border border-border-color hover:border-amber-500 hover:scale-110 transition-all bg-card-bg cursor-pointer"
                                      >
                                        <Star
                                          size={24}
                                          className={`transition-colors ${isLight ? 'text-amber-500 fill-amber-500' : 'text-text-muted opacity-30'}`}
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <label className="block text-[11px] font-black uppercase text-amber-600 tracking-wider">Commentaire (facultatif)</label>
                                <textarea
                                  placeholder="Partagez votre ressenti sur cette séance..."
                                  value={ratingFeedbackComment}
                                  onChange={(e) => setRatingFeedbackComment(e.target.value)}
                                  className="w-full text-xs font-semibold p-4 bg-card-bg border-2 border-border-color rounded-2xl focus:border-amber-500 outline-none leading-relaxed transition-all h-24 resize-none"
                                />
                              </div>

                              <button
                                type="button"
                                disabled={!ratingFeedbackSelected || ratingLoading}
                                onClick={() => handleRateSession(selectedSession.id, ratingFeedbackSelected, ratingFeedbackComment)}
                                className="w-full py-4 rounded-xl text-xs font-black text-white bg-amber-500 hover:bg-amber-600 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {ratingLoading ? (
                                  <><Loader2 size={14} className="animate-spin" /> Publication...</>
                                ) : (
                                  <><Check size={14} /> Publier mon avis</>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        <SessionReport session={selectedSession} />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {activeTab === 'notifications' && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-2xl font-bold">Notifications</h3>
                      <p className="text-text-muted font-medium">
                        Refus, annulations, confirmations et autres alertes liées à vos rendez-vous.
                      </p>
                    </div>
                    <Bell className="w-10 h-10 text-primary opacity-20" />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-text-muted font-bold uppercase tracking-widest">
                      {notifications.length} notification{notifications.length > 1 ? 's' : ''}
                    </p>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          notificationApi
                            .markAllAsRead()
                            .then(() => {
                              setNotifications((prev) =>
                                prev.map((n) => ({ ...n, isRead: true })),
                              );
                              refreshUnreadCount();
                            })
                            .catch((err) => console.error('markAllAsRead failed:', err));
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
                      >
                        <CheckCheck size={14} />
                        Tout marquer comme lu
                      </button>
                    )}
                  </div>

                  {notifLoading && notifications.length === 0 ? (
                    <div className="p-12 text-center bg-card-bg border border-dashed border-border-color rounded-3xl">
                      <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin mb-3" />
                      <p className="text-text-muted font-medium">Chargement des notifications…</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-12 text-center bg-card-bg border border-dashed border-border-color rounded-3xl">
                      <Bell className="w-12 h-12 mx-auto text-text-muted/30 mb-4" />
                      <p className="font-bold text-text-main">Aucune notification</p>
                      <p className="text-text-muted text-sm">
                        Les alertes liées à vos rendez-vous apparaîtront ici.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((notif) => {
                        const style = getNotificationStyle(notif.type);
                        const IconComp = style.icon;
                        return (
                          <div
                            key={notif.id}
                            data-testid={`notification-${notif.type}`}
                            onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
                            className={`t-card border ${style.ring} ${style.bg} ${notif.isRead ? 'opacity-70' : ''} p-5 flex flex-col sm:flex-row items-start gap-4 transition-all cursor-pointer hover:translate-x-1`}
                          >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${style.iconBg}`}>
                              <IconComp size={22} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-extrabold text-sm text-text-main">
                                  {notif.title || 'Notification'}
                                </p>
                                {!notif.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" aria-label="non lu" />
                                )}
                              </div>
                              <p className="text-sm font-medium text-text-muted leading-relaxed mt-1">
                                {notif.message}
                              </p>
                              <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-2">
                                {formatRelativeTime(notif.createdAt)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNotification(notif.id);
                              }}
                              className="p-2 rounded-xl text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              aria-label="Supprimer la notification"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Change Therapist Full Workflow Modal */}
      <AnimatePresence>
        {showChangeTherapistConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowChangeTherapistConfirm(false);
                setChangeTherapistStep('idle');
                setChangeTherapistInitData(null);
                setMatchedTherapists([]);
                setSelectedNewTherapist(null);
                setChangeTherapistError('');
              }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 cursor-pointer"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card-bg w-full max-w-3xl border border-border-color rounded-[2.5rem] shadow-2xl relative cursor-default p-8 md:p-10 text-left max-h-[90vh] overflow-y-auto"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeTherapistConfirm(false);
                    setChangeTherapistStep('idle');
                    setChangeTherapistInitData(null);
                    setMatchedTherapists([]);
                    setSelectedNewTherapist(null);
                    setChangeTherapistError('');
                  }}
                  className="absolute top-6 right-6 p-2 bg-text-muted/10 hover:bg-red-500 hover:text-white rounded-xl transition-all cursor-pointer shadow-sm border border-border-color text-text-muted"
                >
                  <X size={16} />
                </button>

                {/* STEP: idle — initial confirmation */}
                {changeTherapistStep === 'idle' && (
                  <>
                    <div className="mb-6 flex items-center gap-3">
                      <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl">
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-text-main">Changer de thérapeute</h3>
                        <p className="text-xs text-text-muted mt-0.5 font-semibold">Vérification de vos rendez-vous</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-1.5">
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-extrabold leading-tight">
                          Êtes-vous sûr de vouloir changer de thérapeute ?
                        </p>
                        <p className="text-[11px] text-text-muted leading-relaxed font-semibold">
                          Cette action vous dissociera de votre praticien actuel.
                        </p>
                      </div>

                      {therapist && (
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Votre thérapeute actuel</h4>
                          <div className="p-5 bg-bg-main border border-border-color rounded-2xl flex items-center gap-4">
                            <div className="w-14 h-14 bg-primary-light rounded-2xl flex items-center justify-center text-primary font-black text-2xl shadow-inner border-2 border-card-bg">
                              {therapist.name ? therapist.name.charAt(0).toUpperCase() : 'T'}
                            </div>
                            <div>
                              <h5 className="font-bold text-text-main text-base">{therapist.name}</h5>
                              <p className="text-primary text-xs font-bold uppercase tracking-wider">{therapist.speciality || 'Psychologue'}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {changeTherapistError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                          <p className="text-xs font-bold text-red-600">{changeTherapistError}</p>
                        </div>
                      )}

                      <div className="flex gap-4 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowChangeTherapistConfirm(false);
                            setChangeTherapistStep('idle');
                          }}
                          className="flex-1 py-3 bg-bg-main text-text-muted rounded-xl transition-all text-xs font-extrabold tracking-wider uppercase border border-border-color cursor-pointer text-center"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={changeTherapistLoading}
                          onClick={async () => {
                            setChangeTherapistLoading(true);
                            setChangeTherapistError('');
                            try {
                              const res = await patientApi.initiateChangeTherapist();
                              if (!res.canProceed && res.reason === 'confirmed_appointment') {
                                // BLOCKED: confirmed appointment
                                setChangeTherapistStep('blocked');
                                setChangeTherapistInitData(res);
                              } else if (res.requiresCancellation) {
                                // WARN: scheduled appointment
                                setChangeTherapistStep('warning');
                                setChangeTherapistInitData(res);
                              } else {
                                // PROCEED: no active appointments
                                setChangeTherapistStep('loading');
                                // Directly fetch matches
                                const matchesRes = await patientApi.cancelAndGetMatches(null);
                                setMatchedTherapists(matchesRes.data || []);
                                if (matchesRes.noMatchesAvailable) {
                                  setChangeTherapistStep('no_matches');
                                  setChangeTherapistInitData(matchesRes);
                                } else {
                                  setChangeTherapistStep('results');
                                }
                              }
                            } catch (err) {
                              setChangeTherapistError(err.message || 'Erreur lors de la vérification');
                            } finally {
                              setChangeTherapistLoading(false);
                            }
                          }}
                          className="flex-1 py-3 bg-primary text-white rounded-xl transition-all text-xs font-extrabold tracking-wider uppercase shadow-lg shadow-primary/25 cursor-pointer text-center disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          {changeTherapistLoading ? (
                            <><Loader2 size={14} className="animate-spin" /> Vérification...</>
                          ) : (
                            'Continuer'
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* STEP: blocked — confirmed appointment */}
                {changeTherapistStep === 'blocked' && (
                  <>
                    <div className="mb-6 flex items-center gap-3">
                      <div className="p-3 bg-red-500/10 text-red-600 rounded-2xl">
                        <XCircle size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-text-main">Changement impossible</h3>
                        <p className="text-xs text-text-muted mt-0.5 font-semibold">Rendez-vous confirmé en cours</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl">
                        <p className="text-sm text-text-main font-semibold leading-relaxed whitespace-pre-line">
                          {changeTherapistInitData?.message || 'Vous avez un rendez-vous confirmé avec votre thérapeute actuel.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowChangeTherapistConfirm(false);
                          setChangeTherapistStep('idle');
                        }}
                        className="w-full py-3 bg-primary text-white rounded-xl transition-all text-xs font-extrabold tracking-wider uppercase shadow-lg shadow-primary/25 cursor-pointer text-center"
                      >
                        Fermer
                      </button>
                    </div>
                  </>
                )}

                {/* STEP: warning — scheduled appointment needs cancellation */}
                {changeTherapistStep === 'warning' && (
                  <>
                    <div className="mb-6 flex items-center gap-3">
                      <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl">
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-text-main">Demande de rendez-vous en attente</h3>
                        <p className="text-xs text-text-muted mt-0.5 font-semibold">Confirmation requise</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                        <p className="text-sm text-text-main font-semibold leading-relaxed whitespace-pre-line">
                          {changeTherapistInitData?.message || 'Vous avez une demande de rendez-vous en attente.'}
                        </p>
                      </div>

                      <div className="flex gap-4 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setChangeTherapistStep('idle');
                          }}
                          className="flex-1 py-3 bg-bg-main text-text-muted rounded-xl transition-all text-xs font-extrabold tracking-wider uppercase border border-border-color cursor-pointer text-center"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={changeTherapistLoading}
                          onClick={async () => {
                            setChangeTherapistLoading(true);
                            setChangeTherapistError('');
                            try {
                              const matchesRes = await patientApi.cancelAndGetMatches(
                                changeTherapistInitData.appointmentId,
                              );
                              setMatchedTherapists(matchesRes.data || []);
                              if (matchesRes.noMatchesAvailable) {
                                setChangeTherapistStep('no_matches');
                                setChangeTherapistInitData(matchesRes);
                              } else {
                                setChangeTherapistStep('results');
                              }
                            } catch (err) {
                              setChangeTherapistError(err.message || 'Erreur lors de l\'annulation');
                            } finally {
                              setChangeTherapistLoading(false);
                            }
                          }}
                          className="flex-1 py-3 bg-primary text-white rounded-xl transition-all text-xs font-extrabold tracking-wider uppercase shadow-lg shadow-primary/25 cursor-pointer text-center disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          {changeTherapistLoading ? (
                            <><Loader2 size={14} className="animate-spin" /> Annulation en cours...</>
                          ) : (
                            'Continuer'
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* STEP: loading — fetching matches */}
                {changeTherapistStep === 'loading' && (
                  <div className="py-12 text-center">
                    <Loader2 size={32} className="animate-spin text-primary mx-auto mb-4" />
                    <p className="text-text-muted font-bold">Recherche des thérapeutes disponibles...</p>
                  </div>
                )}

                {/* STEP: no_matches — no therapists available after exclusion */}
                {changeTherapistStep === 'no_matches' && (
                  <>
                    <div className="mb-6 flex items-center gap-3">
                      <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl">
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-text-main">Aucun thérapeute disponible</h3>
                        <p className="text-xs text-text-muted mt-0.5 font-semibold">Aucune correspondance trouvée</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                        <p className="text-sm text-text-main font-semibold leading-relaxed whitespace-pre-line">
                          {changeTherapistInitData?.message || 'Aucun autre thérapeute compatible n\'est actuellement disponible.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowChangeTherapistConfirm(false);
                          setChangeTherapistStep('idle');
                        }}
                        className="w-full py-3 bg-primary text-white rounded-xl transition-all text-xs font-extrabold tracking-wider uppercase shadow-lg shadow-primary/25 cursor-pointer text-center"
                      >
                        Fermer
                      </button>
                    </div>
                  </>
                )}

                {/* STEP: results — show matched therapists */}
                {changeTherapistStep === 'results' && (
                  <>
                    <div className="mb-6 flex items-center gap-3">
                      <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                        <UserCheck size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-text-main">Nouveaux thérapeutes disponibles</h3>
                        <p className="text-xs text-text-muted mt-0.5 font-semibold">
                          {matchedTherapists.length} correspondance{matchedTherapists.length > 1 ? 's' : ''} trouvée{matchedTherapists.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {matchedTherapists.map((therapist, i) => (
                        <motion.div
                          key={therapist.id || i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => setSelectedNewTherapist(therapist)}
                          className={`p-5 border-2 rounded-2xl flex items-center gap-4 transition-all cursor-pointer ${
                            selectedNewTherapist?.id === therapist.id
                              ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                              : 'border-border-color bg-bg-main hover:border-primary/40'
                          }`}
                        >
                          <div className="w-14 h-14 bg-primary-light rounded-2xl flex items-center justify-center text-primary font-black text-2xl shadow-inner border-2 border-card-bg shrink-0">
                            {therapist.name ? therapist.name.charAt(0).toUpperCase() : 'T'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-text-main text-sm">{therapist.name || 'Thérapeute'}</h4>
                              <span className="text-[10px] px-2 py-0.5 bg-green-500/10 text-green-600 font-bold rounded-full">
                                Vérifié
                              </span>
                            </div>
                            <p className="text-xs text-text-muted mt-0.5">
                              {therapist.approcheTherapeute ? (
                                <>
                                  {therapist.approcheTherapeute === 'TCC' && 'Thérapie Cognitivo-Comportementale'}
                                  {therapist.approcheTherapeute === 'PSYCHANALYSE' && 'Psychanalyse'}
                                  {therapist.approcheTherapeute === 'HUMANISTE_GESTALT' && 'Humaniste / Gestalt'}
                                  {therapist.approcheTherapeute === 'INTEGRATIVE' && 'Approche Intégrative'}
                                </>
                              ) : ''}
                            </p>
                            {therapist.matchReasons && therapist.matchReasons.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {therapist.matchReasons.slice(0, 2).map((reason, idx) => (
                                  <span key={idx} className="text-[9px] px-2 py-0.5 bg-primary/5 rounded-full text-primary font-medium">
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <div className="flex items-center gap-1 text-primary">
                              <Target size={14} />
                              <span className="font-bold text-base">{therapist.compatibility || therapist.matchScore || 0}%</span>
                            </div>
                            {selectedNewTherapist?.id === therapist.id && (
                              <CheckCircle2 size={20} className="text-primary" />
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {changeTherapistError && (
                      <div className="p-3 mt-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-xs font-bold text-red-600">{changeTherapistError}</p>
                      </div>
                    )}

                    <div className="flex gap-4 pt-6 border-t border-border-color/30 mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setChangeTherapistStep('idle');
                          setSelectedNewTherapist(null);
                        }}
                        className="flex-1 py-3 bg-bg-main text-text-muted rounded-xl transition-all text-xs font-extrabold tracking-wider uppercase border border-border-color cursor-pointer text-center"
                      >
                        Retour
                      </button>
                      <button
                        type="button"
                        disabled={!selectedNewTherapist || changeTherapistLoading}
                        onClick={async () => {
                          if (!selectedNewTherapist) return;
                          setChangeTherapistLoading(true);
                          setChangeTherapistError('');
                          try {
                            const res = await patientApi.confirmChangeTherapist(selectedNewTherapist.id);
                            if (res.success) {
                              // Update local state
                              if (res.data) {
                                setPatientProfile(res.data);
                                if (res.data.currentTherapist) {
                                  setTherapistInfo({
                                    id: res.data.currentTherapist.id,
                                    name: res.data.currentTherapist.name,
                                    speciality: res.data.currentTherapist.approcheTherapeute || 'Psychologue',
                                    profilePhotoUrl: res.data.currentTherapist.profilePhotoUrl || null,
                                  });
                                }
                              }
                              setChangeTherapistStep('done');
                            }
                          } catch (err) {
                            setChangeTherapistError(err.message || 'Erreur lors du changement');
                          } finally {
                            setChangeTherapistLoading(false);
                          }
                        }}
                        className="flex-1 py-3 bg-primary text-white rounded-xl transition-all text-xs font-extrabold tracking-wider uppercase shadow-lg shadow-primary/25 cursor-pointer text-center disabled:opacity-40 flex items-center justify-center gap-2"
                      >
                        {changeTherapistLoading ? (
                          <><Loader2 size={14} className="animate-spin" /> Confirmation...</>
                        ) : !selectedNewTherapist ? (
                          'Sélectionnez un thérapeute'
                        ) : (
                          'Confirmer la mise en relation'
                        )}
                      </button>
                    </div>
                  </>
                )}

                {/* STEP: done — success confirmation */}
                {changeTherapistStep === 'done' && (
                  <>
                    <div className="mb-6 flex items-center gap-3">
                      <div className="p-3 bg-green-500/10 text-green-600 rounded-2xl">
                        <CheckCircle2 size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-text-main">Changement effectué !</h3>
                        <p className="text-xs text-text-muted mt-0.5 font-semibold">Votre nouveau thérapeute</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-5 bg-green-500/5 border border-green-500/20 rounded-2xl">
                        <p className="text-sm text-text-main font-semibold leading-relaxed">
                          Votre changement de thérapeute a été effectué avec succès.
                        </p>
                      </div>

                      {selectedNewTherapist && (
                        <div className="p-5 bg-bg-main border border-border-color rounded-2xl flex items-center gap-4">
                          <div className="w-14 h-14 bg-primary-light rounded-2xl flex items-center justify-center text-primary font-black text-2xl shadow-inner border-2 border-card-bg">
                            {selectedNewTherapist.name ? selectedNewTherapist.name.charAt(0).toUpperCase() : 'T'}
                          </div>
                          <div>
                            <h5 className="font-bold text-text-main text-base">{selectedNewTherapist.name}</h5>
                            <p className="text-primary text-xs font-bold uppercase tracking-wider">{selectedNewTherapist.approcheTherapeute || 'Psychologue'}</p>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setShowChangeTherapistConfirm(false);
                          setChangeTherapistStep('idle');
                          setSelectedNewTherapist(null);
                          setMatchedTherapists([]);
                          // Refresh data
                          const reloadData = async () => {
                            try {
                              const [profileRes, appointmentsRes] = await Promise.all([
                                patientApi.getProfile(),
                                patientApi.getAppointments(),
                              ]);
                              setPatientProfile(profileRes.data);
                              setAppointments(appointmentsRes.data || []);
                            } catch (_) {}
                          };
                          reloadData();
                        }}
                        className="w-full py-3 bg-primary text-white rounded-xl transition-all text-xs font-extrabold tracking-wider uppercase shadow-lg shadow-primary/25 cursor-pointer text-center"
                      >
                        Terminé
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}