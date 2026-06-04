import { useState, useRef, useEffect, useMemo } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ChatWidget from '../components/ChatWidget';
import SessionReport from '../components/SessionReport';
import { removeToken } from '../services/api';

const THERAPIST_SCHEDULES = {
  "Dr. Amine B.": {
    days: [2], // Tuesday - Mardi
    daysText: "Mardi",
    hoursText: "12:00 à 15:00",
    start: "12:00",
    end: "15:00",
    slotDuration: 30
  },
  "Mme Sarah K.": {
    days: [1, 3], // Monday, Wednesday - Lundi, Mercredi
    daysText: "Lundi et Mercredi",
    hoursText: "09:00 à 12:00",
    start: "09:00",
    end: "12:00",
    slotDuration: 30
  },
  "Dr. Lynda M.": {
    days: [4], // Thursday - Jeudi
    daysText: "Jeudi",
    hoursText: "14:00 à 18:00",
    start: "14:00",
    end: "18:00",
    slotDuration: 60
  },
  "Mr. Yacine T.": {
    days: [6], // Saturday - Samedi
    daysText: "Samedi",
    hoursText: "10:00 à 14:00",
    start: "10:00",
    end: "14:00",
    slotDuration: 30
  }
};

const getTherapistSchedule = (name) => {
  return THERAPIST_SCHEDULES[name] || {
    days: [1, 4], // Lundi et Jeudi
    daysText: "Lundi et Jeudi",
    hoursText: "14:00 à 17:00",
    start: "14:00",
    end: "17:00",
    slotDuration: 30
  };
};

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const isPastDate = (year, month, day) => {
  const d = new Date(year, month, day);
  const today = new Date();
  const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return d < todayReset;
};

const isDateSelectable = (year, month, day, schedule) => {
  if (isPastDate(year, month, day)) return false;
  const d = new Date(year, month, day);
  const dayOfWeek = d.getDay(); // Sunday is 0, Monday is 1...
  return schedule.days.includes(dayOfWeek);
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

export default function Patient({ onNavigateToPage, currentTherapist }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [selectedSession, setSelectedSession] = useState(null);

  // Dynamic interactive rating states
  const [ratingFeedbackSelected, setRatingFeedbackSelected] = useState(0);
  const [ratingFeedbackHover, setRatingFeedbackHover] = useState(0);
  const [ratingFeedbackComment, setRatingFeedbackComment] = useState('');

  // Advanced Constrained Scheduling States
  const [bookingStep, setBookingStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [consultationType, setConsultationType] = useState('teleconsultation');
  const [expeditionNotification, setExpeditionNotification] = useState(false);
  const [showChangeTherapistConfirm, setShowChangeTherapistConfirm] = useState(false);
  
  const todayDate = new Date();
  const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth());
  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear());

  const [patientName, setPatientName] = useState('Walid B.');
  const [patientEmail, setPatientEmail] = useState('walid@example.com');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientNotes, setPatientNotes] = useState('');

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
        patientName: 'Walid B.',
        therapistName: 'Dr. Amine B.',
        date: '28 Avril 2024', 
        duration: '45 min', 
        rating: 5, 
        rated: true,
        note: 'Excellente séance, très apaisante.',
        status: 'Terminée',
        report: {
          summary: "Discussion approfondie sur les déclencheurs d'anxiété professionnelle. Le patient a identifié des schémas de pensée automatiques liés à la performance.",
          homework: "Pratiquer l'exercice de respiration 4-7-8 avant les réunions importantes.",
          nextGoals: ["Gestion des limites", "Techniques d'ancrage"]
        }
      },
      { 
        id: 2, 
        patientName: 'Walid B.',
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
        patientName: 'Walid B.',
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
        patientName: 'Walid B.',
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

  const handleRateSession = (id, rating, note) => {
    const updated = sessions.map(s => {
      if (s.id === id) {
        return { ...s, rating, note, rated: true };
      }
      return s;
    });
    setSessions(updated);
    localStorage.setItem('app_sessions', JSON.stringify(updated));
    if (selectedSession && selectedSession.id === id) {
      setSelectedSession({ ...selectedSession, rating, note, rated: true });
    }
  };

  const defaultTherapist = {
    name: "Dr. Amine B.",
    speciality: "TCC",
    wilaya: "16 - Alger",
    rating: 4.8,
    image: "A"
  };

  const therapist = currentTherapist || defaultTherapist;

  const [appointments, setAppointments] = useState([
    { 
      id: 1, 
      title: 'Séance d\'évaluation', 
      dateText: 'Mardi, 26 Mai 2026 à 14:30', 
      type: 'Téléconsultation', 
      status: 'Confirmé',
      dayNum: '26',
      monthShort: 'MAI'
    }
  ]);

  const patientUser = {
    name: "Walid B.",
    email: "walid@example.com",
    role: "PATIENT"
  };

  const activeSchedule = useMemo(() => {
    return getTherapistSchedule(therapist.name);
  }, [therapist.name]);

  const availableSlots = useMemo(() => {
    const slots = [];
    const [startHard, startMin] = activeSchedule.start.split(":").map(Number);
    const [endHard, endMin] = activeSchedule.end.split(":").map(Number);
    
    let currentMin = startHard * 60 + startMin;
    const endTotalMin = endHard * 60 + endMin;
    
    while (currentMin + activeSchedule.slotDuration <= endTotalMin) {
      const h = Math.floor(currentMin / 60);
      const m = currentMin % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(timeStr);
      currentMin += activeSchedule.slotDuration;
    }
    return slots;
  }, [activeSchedule]);

  const handlePrevMonth = () => {
    const today = new Date();
    if (currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
      return; // Can't go to past month
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
    let startingDayIndex = d1.getDay(); // 0 is Sunday, 1 is Monday ...
    startingDayIndex = (startingDayIndex + 6) % 7; // Convert to Monday=0 index
    
    const numDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    return {
      blanks: Array(startingDayIndex).fill(null),
      days: Array.from({ length: numDays }, (_, i) => i + 1)
    };
  }, [currentYear, currentMonth]);

  const handleCompleteBooking = () => {
    if (!selectedDate || !selectedTimeSlot) return;
    const monthsShort = ["JAN", "FEV", "MAR", "AVR", "MAI", "JUN", "JUL", "AOU", "SEP", "OCT", "NOV", "DEC"];
    const daysWeekStr = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const bookingDateText = `${daysWeekStr[selectedDate.getDay()]} ${selectedDate.getDate()} ${MONTHS_FR[selectedDate.getMonth()]} ${selectedDate.getFullYear()} à ${selectedTimeSlot}`;
    
    const newAppointment = {
      id: Date.now(),
      title: 'Séance de suivi',
      dateText: bookingDateText,
      type: consultationType === 'cabinet' ? 'Cabinet' : consultationType === 'phone' ? 'Appel vocal' : 'Téléconsultation',
      status: 'Confirmé',
      dayNum: String(selectedDate.getDate()).padStart(2, '0'),
      monthShort: monthsShort[selectedDate.getMonth()]
    };

    setAppointments([newAppointment, ...appointments]);
    setBookingStep(2);
    setExpeditionNotification(true);
    setTimeout(() => {
      setExpeditionNotification(false);
    }, 6000);
  };

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
                  Votre demande de session a bien été expédiée avec succès à votre thérapeute {therapist.name}.
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
        user={patientUser}
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
              {/* Mobile Overlay */}
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
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center text-primary font-black text-xl shadow-inner border-2 border-card-bg transition-colors">
                      {therapist.name.charAt(4)}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">{therapist.name}</h2>
                      <p className="text-primary text-[10px] font-bold uppercase tracking-wider">{therapist.speciality}</p>
                    </div>
                  </div>

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
                  </nav>

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
                  <ChatWidget therapist={therapist} />
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
                      {appointments.map((appt) => (
                        <div key={appt.id} className="p-5 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:bg-primary/[0.08]">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-card-bg rounded-xl shadow-sm flex flex-col items-center justify-center border border-primary/10">
                              <span className="text-[10px] font-bold text-primary uppercase">{appt.monthShort}</span>
                              <span className="text-lg font-black text-primary -mt-1">{appt.dayNum}</span>
                            </div>
                            <div>
                              <p className="font-bold text-text-main">{appt.title}</p>
                              <p className="text-sm font-medium text-text-muted">{appt.dateText} • {therapist.name} ({appt.type})</p>
                            </div>
                          </div>
                          <div className="t-badge t-badge-accent shadow-sm">{appt.status}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="t-card pt-8">
                    <h4 className="font-bold mb-6 flex items-center gap-2">
                      <Clock size={18} className="text-primary" /> Réserver une nouvelle séance
                    </h4>

                    {bookingStep === 0 && (
                      <div className="space-y-6">
                        {/* Therapist exclusive availability alert box */}
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-3.5 mb-2">
                          <div className="mt-0.5 text-primary shrink-0">
                            <Calendar size={18} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Disponibilité du Thérapeute</p>
                            <p className="text-xs text-text-main font-semibold leading-relaxed">
                              {therapist.name} est disponible uniquement le <span className="text-primary font-bold">{activeSchedule.daysText}</span> entre <span className="text-primary font-bold">{activeSchedule.hoursText}</span>.
                            </p>
                          </div>
                        </div>

                        {/* Core scheduler grid */}
                        <div className="grid lg:grid-cols-12 gap-8 items-start">
                          <div className="lg:col-span-8 space-y-8">
                            
                            {/* Date Selector */}
                            <div>
                              <label className="block text-[11px] font-black uppercase tracking-widest text-primary mb-3">
                                1. Sélectionner une date
                              </label>
                              <div className="p-5 bg-bg-main border-2 border-border-color rounded-2xl">
                                
                                {/* Calendar Month Control Navigation */}
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

                                {/* Calendar Weekday headers */}
                                <div className="grid grid-cols-7 gap-1 md:gap-2 text-center text-[10px] font-black uppercase text-text-muted tracking-widest mb-3 border-b border-border-color/10 pb-2">
                                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(dayHeader => (
                                    <div key={dayHeader} className="py-1">{dayHeader}</div>
                                  ))}
                                </div>

                                {/* Grid cells */}
                                <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                                  {blanks.map((_, i) => (
                                    <div key={`blank-${i}`} className="aspect-square" />
                                  ))}
                                  {days.map(day => {
                                    const isSelected = selectedDate && selectedDate.getDate() === day && selectedDate.getMonth() === currentMonth && selectedDate.getFullYear() === currentYear;
                                    const isSelectable = isDateSelectable(currentYear, currentMonth, day, activeSchedule);
                                    return (
                                      <button
                                        key={day}
                                        disabled={!isSelectable}
                                        type="button"
                                        onClick={() => {
                                          const date = new Date(currentYear, currentMonth, day);
                                          setSelectedDate(date);
                                          setSelectedTimeSlot(null); // Reset timeslot choice
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

                                {/* Legend markers */}
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

                            {/* Time Slot Generation dependent on selected Date */}
                            <div>
                              <label className="block text-[11px] font-black uppercase tracking-widest text-primary mb-3">
                                2. Choisir un créneau horaire
                              </label>
                              {!selectedDate ? (
                                <div className="p-6 bg-bg-main border-2 border-dashed border-border-color rounded-2xl flex flex-col items-center justify-center text-center text-text-muted space-y-2">
                                  <Clock size={24} className="opacity-40" />
                                  <p className="text-xs font-bold uppercase tracking-wider">Veuillez d'abord sélectionner une date valide dans l'agenda</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                  {availableSlots.map(slot => {
                                    const isSlotSelected = selectedTimeSlot === slot;
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() => setSelectedTimeSlot(slot)}
                                        className={`
                                          py-3 px-2 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer
                                          ${isSlotSelected 
                                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/15 scale-105 z-10' 
                                            : 'bg-bg-main hover:bg-primary-light border-border-color text-text-main hover:border-primary/40 hover:text-primary'
                                          }
                                        `}
                                      >
                                        {slot}
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

                          {/* Dynamic Side Summary - Sticky on desktop */}
                          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
                            <div className="t-card border border-border-color p-5 space-y-5 bg-card-bg shadow-lg rounded-2xl">
                              <h5 className="font-black text-[10px] uppercase text-text-muted tracking-widest border-b border-border-color/30 pb-3">
                                Récapitulatif
                              </h5>
                              <div className="space-y-4">
                                <div className="flex items-center gap-3 bg-primary-light/40 p-3 rounded-2xl border border-primary/10">
                                  <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-black text-sm">
                                    {therapist.name.charAt(4)}
                                  </div>
                                  <div>
                                    <p className="font-black text-xs text-text-main">{therapist.name}</p>
                                    <p className="text-[9px] font-bold text-primary uppercase tracking-wider">{therapist.speciality}</p>
                                  </div>
                                </div>

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
                                disabled={!selectedDate || !selectedTimeSlot}
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
                              Vous êtes sur le point d'envoyer votre demande de session avec votre thérapeute pour la séance choisie.
                            </p>
                          </div>

                          {/* Selected Info Summary Box */}
                          <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl text-left space-y-3 text-xs">
                            <div className="flex justify-between border-b border-border-color/30 pb-2">
                              <span className="text-text-muted font-bold">Thérapeute :</span>
                              <span className="font-bold text-text-main">{therapist.name}</span>
                            </div>
                            <div className="flex justify-between border-b border-border-color/30 pb-2">
                              <span className="text-text-muted font-bold">Date de la séance :</span>
                              <span className="font-bold text-text-main">
                                {selectedDate ? formatDateFr(selectedDate) : ''}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-border-color/30 pb-2">
                              <span className="text-text-muted font-bold">Heure choisie :</span>
                              <span className="font-bold text-text-main">{selectedTimeSlot}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-muted font-bold">Mode de consultation :</span>
                              <span className="font-semibold text-text-main">
                                {consultationType === 'cabinet' && '📍 En cabinet'}
                                {consultationType === 'teleconsultation' && '💻 Téléconsultation'}
                                {consultationType === 'phone' && '📞 Appel vocal'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleCompleteBooking}
                            className="t-btn-primary w-full py-4 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer font-bold transition-all text-xs text-white"
                          >
                            Confirmer ma demande de session <Check size={14} />
                          </button>
                        </div>

                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => setBookingStep(0)}
                            className="text-xs font-bold text-text-muted hover:text-primary transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ChevronLeft size={14} /> Retour à l'étape précédente
                          </button>
                        </div>
                      </div>
                    )}

                    {bookingStep === 2 && (
                      <div className="p-6 md:p-10 bg-primary/5 border border-primary/20 rounded-3xl flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30 animate-bounce">
                          <Check size={32} />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xl font-extrabold text-text-main">Demande de session expédiée !</h4>
                          <p className="text-xs text-text-muted max-w-md font-medium leading-relaxed">
                            Votre demande de session a bien été expédiée. Votre praticien {therapist.name} de votre rendez-vous a été notifié.
                          </p>
                        </div>

                        <div className="p-4 bg-card-bg border border-border-color rounded-2xl w-full max-w-sm text-left space-y-3 shadow-sm text-xs">
                          <div className="flex justify-between border-b border-border-color/40 pb-2">
                            <span className="text-text-muted font-bold">Thérapeute :</span>
                            <span className="font-bold text-text-main">{therapist.name}</span>
                          </div>
                          <div className="flex justify-between border-b border-border-color/40 pb-2">
                            <span className="text-text-muted font-bold">Date & Heure :</span>
                            <span className="font-bold text-primary text-right">{selectedDate && formatDateFr(selectedDate)} à {selectedTimeSlot}</span>
                          </div>
                          <div className="flex justify-between border-b border-border-color/40 pb-2">
                            <span className="text-text-muted font-bold">Mode :</span>
                            <span className="font-bold text-text-main text-right">
                              {consultationType === 'cabinet' && '📍 En cabinet'}
                              {consultationType === 'teleconsultation' && '💻 Téléconsultation'}
                              {consultationType === 'phone' && '📞 Appel vocal'}
                            </span>
                          </div>
                          <div className="flex justify-between pt-0.5">
                            <span className="text-text-muted font-bold">ID Session :</span>
                            <span className="font-mono font-bold text-[10px] uppercase tracking-wider text-text-muted">
                              SESS-{Math.floor(1000 + Math.random() * 9000)}
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
                        {sessions.map((session) => (
                          <div 
                            key={session.id} 
                            onClick={() => setSelectedSession(session)}
                            className={`t-card border-l-4 transition-all duration-300 hover:translate-x-2 cursor-pointer group ${
                              session.rated 
                                ? 'border-l-primary hover:border-primary/50' 
                                : 'border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10 border-amber-500'
                            }`}
                          >
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-primary">{session.date}</span>
                                  <span className="text-xs text-text-muted leading-none px-2 py-1 bg-bg-main rounded-md border border-border-color">{session.duration}</span>
                                  {!session.rated && (
                                    <span className="text-[10px] uppercase tracking-widest font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-full animate-pulse">À évaluer</span>
                                  )}
                                </div>
                                {session.rated ? (
                                  <p className="text-sm text-text-muted italic">"{session.note || 'Aucun commentaire laissé.'}"</p>
                                ) : (
                                  <p className="text-xs text-amber-700 font-bold flex items-center gap-1">
                                    <Star size={12} className="fill-current animate-spin" style={{ animationDuration: '3s' }} /> Évaluez cette séance pour finaliser votre historique
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2 justify-between">
                                <div className="flex gap-1 text-yellow-500">
                                  {session.rated ? (
                                    [...Array(5)].map((_, i) => (
                                      <Star key={i} size={14} className={i < session.rating ? 'fill-current' : 'opacity-20'} />
                                    ))
                                  ) : (
                                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider hover:underline">Laisser un avis</span>
                                  )}
                                </div>
                                <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
                                  Voir le compte rendu <ChevronRight size={10} />
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
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
                        {/* Interactive Rating Form for Unrated Sessions placed prominently */}
                        {!selectedSession.rated && (
                          <div className="t-card border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-transparent p-6 rounded-3xl space-y-4">
                            <div className="flex items-start gap-4">
                              <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md">
                                <Star size={24} className="fill-current animate-pulse" />
                              </div>
                              <div>
                                <h4 className="font-extrabold text-base text-text-main text-left">Évaluer cette séance du {selectedSession.date}</h4>
                                <p className="text-xs text-text-muted text-left mt-0.5">Prenez un instant pour noter la qualité de l'échange et laisser votre retour.</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4 pt-3 text-left">
                              <div>
                                <label className="block text-[11px] font-black uppercase text-amber-600 tracking-wider mb-2">1. Sélectionner une note</label>
                                <div className="flex gap-2">
                                  {[1, 2, 3, 4, 5].map((star) => {
                                    const isLight = ratingFeedbackHover >= star || (ratingFeedbackSelected || 0) >= star;
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
                                <label className="block text-[11px] font-black uppercase text-amber-600 tracking-wider">2. Ajouter un commentaire (facultatif)</label>
                                <textarea
                                  placeholder="Racontez brièvement comment s'est déroulée la séance (conseils, exercices suivis, etc.). Ce retour est confidentiel et partagé avec votre thérapeute."
                                  value={ratingFeedbackComment}
                                  onChange={(e) => setRatingFeedbackComment(e.target.value)}
                                  className="w-full text-xs font-semibold p-4 bg-card-bg border-2 border-border-color rounded-2xl focus:border-amber-500 outline-none leading-relaxed transition-all h-24 resize-none"
                                />
                              </div>

                              <button
                                type="button"
                                disabled={!ratingFeedbackSelected}
                                onClick={() => {
                                  handleRateSession(selectedSession.id, ratingFeedbackSelected, ratingFeedbackComment);
                                  setRatingFeedbackSelected(0);
                                  setRatingFeedbackComment('');
                                }}
                                className="w-full py-4 rounded-xl text-xs font-black text-white bg-amber-500 hover:bg-amber-600 focus:outline-none transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Publier mon avis <Check size={14} />
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
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Change Therapist Confirmation Modal */}
      <AnimatePresence>
        {showChangeTherapistConfirm && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChangeTherapistConfirm(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 cursor-pointer"
            >
              {/* Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card-bg w-full max-w-lg border border-border-color rounded-[2.5rem] shadow-2xl overflow-hidden relative cursor-default p-8 md:p-10 text-left"
              >
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowChangeTherapistConfirm(false)}
                  className="absolute top-6 right-6 p-2 bg-text-muted/10 hover:bg-red-500 hover:text-white rounded-xl transition-all cursor-pointer shadow-sm border border-border-color text-text-muted"
                >
                  <X size={16} />
                </button>

                {/* Attention Icon / Header Title */}
                <div className="mb-6 flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-text-main">Changer de thérapeute</h3>
                    <p className="text-xs text-text-muted mt-0.5 font-semibold">Confirmation de votre choix de redirection</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Warning details text */}
                  <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-1.5">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-extrabold leading-tight shadow-none">
                      Êtes-vous sûr de vouloir changer de thérapeute ?
                    </p>
                    <p className="text-[11px] text-text-muted leading-relaxed font-semibold">
                      Cette action vous dissociera de votre praticien actuel. Vos anciennes données de messagerie et de rendez-vous resteront archivées de manière sécurisée, mais vous ne serez plus directement suivi par ce praticien.
                    </p>
                  </div>

                  {/* Current Therapist Card Profile */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Votre thérapeute actuel</h4>
                    <div className="p-5 bg-bg-main border border-border-color rounded-2xl flex items-center gap-4 hover:shadow-sm transition-all">
                      <div className="w-14 h-14 bg-primary-light rounded-2xl flex items-center justify-center text-primary font-black text-2xl shadow-inner border-2 border-card-bg">
                        {therapist.name.replace(/^(Dr\.|Mme|Mr\.)\s*/i, '').charAt(0) || 'T'}
                      </div>
                      <div className="space-y-1">
                        <h5 className="font-bold text-text-main text-base leading-none">{therapist.name}</h5>
                        <p className="text-primary text-xs font-bold uppercase tracking-wider">{therapist.speciality}</p>
                        
                        {/* More therapist information showing consistency */}
                        <div className="flex items-center gap-2 text-text-muted text-[10px] font-bold">
                          <span className="flex items-center gap-1"><Star size={12} className="text-amber-500 fill-amber-500 animate-none mt-0" /> {therapist.rating || '4.8'}</span>
                          <span>•</span>
                          <span>{therapist.wilaya || '16 - Alger'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-muted leading-snug font-medium italic text-center">
                    Vous pouvez passer en revue votre décision et revenir en arrière à tout moment sans incidence sur votre parcours.
                  </p>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowChangeTherapistConfirm(false)}
                      className="flex-1 py-3 bg-bg-main text-text-muted rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-extrabold tracking-wider uppercase border border-border-color cursor-pointer text-center"
                    >
                      Conserver
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowChangeTherapistConfirm(false);
                        onNavigateToPage('REGISTRATION', { mode: 'RESULTS' });
                      }}
                      className="flex-1 py-3 bg-primary text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-extrabold tracking-wider uppercase shadow-lg shadow-primary/25 cursor-pointer text-center animate-none"
                    >
                      Confirmer le changement
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
