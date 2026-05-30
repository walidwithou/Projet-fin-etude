import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, Users, FileCheck, AlertTriangle, Settings, Bell, 
  Search, Filter, Check, X, Trash2, Edit, AlertCircle, Plus, Eye, 
  Send, Activity, ShieldAlert, LogOut, CheckCircle2, UserCheck, 
  UserMinus, MessageSquare, AlertOctagon, HelpCircle, FileText, Globe, 
  Lock, RefreshCw
} from 'lucide-react';
import LeafKeyIcon from '../components/LeafKeyIcon';

// --- INITIAL MOCK STATES ---
const INITIAL_USERS = [
  { id: 1, name: "Sonia Benali", email: "sonia.b@gmail.com", role: "PATIENT", status: "Active", joined: "2026-05-10", lastActive: "Il y a 2h" },
  { id: 2, name: "Dr. Walid Meziane", email: "ter@gm", role: "THERAPIST", status: "Active", joined: "2026-04-12", lastActive: "En ligne" },
  { id: 3, name: "Amine Kaci", email: "amine.k@gmail.com", role: "PATIENT", status: "Suspended", joined: "2026-05-18", lastActive: "Il y a 3j" },
  { id: 4, name: "Dr. Ryma Benaissa", email: "ryma.b@outlook.com", role: "THERAPIST", status: "En attente", joined: "2026-05-24", lastActive: "Il y a 10m" },
  { id: 5, name: "Karim Brahimi", email: "karim.br@gmail.com", role: "PATIENT", status: "Banned", joined: "2026-03-01", lastActive: "Il y a 2 mois" },
  { id: 6, name: "Dr. Lisa Haddad", email: "l.haddad@tassarut.dz", role: "THERAPIST", status: "Active", joined: "2026-01-15", lastActive: "Il y a 1j" }
];

const INITIAL_THERAPISTS = [
  {
    id: 1,
    name: "Dr. Ryma Benaissa",
    email: "ryma.b@outlook.com",
    specialty: "Psychologue Clinicienne",
    experience: "8 ans",
    institution: "Université d'Alger 2",
    submittedAt: "2026-05-24 14:32",
    status: "PENDING",
    documents: [
      { name: "Master_Psychologie_Clinique.pdf", size: "2.4 MB", type: "Diplôme principal" },
      { name: "Attestation_Inscription_Ordre.pdf", size: "1.2 MB", type: "Autorisation légale" },
      { name: "Piece_Identite_Nationale.pdf", size: "850 KB", type: "Identité" }
    ],
    bio: "Spécialisée en psychotraumatologie et thérapies cognitives et comportementales (TCC). Cabinet privé situé à Hydra."
  },
  {
    id: 2,
    name: "Dr. Sofiane Khelil",
    email: "sofiane.kh@gmail.com",
    specialty: "Psychiatre - Pédopsychiatre",
    experience: "12 ans",
    institution: "Faculté de Médecine d'Alger",
    submittedAt: "2026-05-25 09:15",
    status: "PENDING",
    documents: [
      { name: "Doctorat_Medecine_Alger.pdf", size: "3.1 MB", type: "Diplôme principal" },
      { name: "Attestation_Specialite_Psychiatrie.pdf", size: "1.9 MB", type: "Autorisation légale" }
    ],
    bio: "Ancien interne des hôpitaux d'Alger. Expert en troubles de l'humeur et psychogériatrie."
  },
  {
    id: 3,
    name: "Dr. Salim Mokhtari",
    email: "salim.m@gmail.com",
    specialty: "Psycho-praticien",
    experience: "3 ans",
    institution: "Formation Privée Paris",
    submittedAt: "2026-05-20",
    status: "REJECTED",
    documents: [{ name: "Certificat_Coaching.pdf", size: "900 KB", type: "Diplôme secondaire" }],
    bio: "Approche intégrative et thérapie brève orientée solutions."
  }
];

const INITIAL_ERROR_REPORTS = [
  {
    id: "ERR-204",
    user: "Sonia Benali",
    email: "sonia.b@gmail.com",
    title: "Le code OTP bancaire ne parvient pas",
    category: "Paiement",
    severity: "Élevée",
    status: "Ouvert",
    page: "/patient/booking",
    timestamp: "2026-05-27 10:45",
    description: "Lors de la finalisation de ma réservation pour le forfait Sérénité, je clique sur régler par carte CIB algérienne. La fenêtre de la Satim s'affiche mais l'envoi du code SMS OTP échoue à chaque tentative.",
    replies: [
      { sender: "System", text: "Ticket généré automatiquement lors de l'interruption du flux de paiement.", time: "27 Mai, 10:45" }
    ]
  },
  {
    id: "ERR-199",
    user: "Dr. Walid Meziane",
    email: "ter@gm",
    title: "La caméra se fige après 5 minutes de session",
    category: "Consultation Vidéo",
    severity: "Critique",
    status: "En cours",
    page: "/therapist/session-room",
    timestamp: "2026-05-26 15:30",
    description: "Sur Google Chrome version Android, la liaison vidéo se coupe subitement au bout de 5 minutes environ de téléconsultation. Le son continue de fonctionner normalement mais l'image du correspondant devient noire.",
    replies: [
      { sender: "Admin (Karim)", text: "Nous analysons les logs du serveur WebRTC. Cela semble lié aux codecs d'accélération matérielle.", time: "26 Mai, 17:10" }
    ]
  },
  {
    id: "ERR-185",
    user: "Amine Kaci",
    email: "amine.k@gmail.com",
    title: "Faute d'orthographe sur l'accord déontologique",
    category: "Contenu / UI",
    severity: "Faible",
    status: "Résolu",
    page: "/about",
    timestamp: "2026-05-24 11:20",
    description: "Le mot 'déontologique' est orthographié avec un accent de travers (dêontologique) au troisième paragraphe de la charte de confiance des praticiens.",
    replies: [
      { sender: "Admin (Karim)", text: "Corrigé immédiatement dans le fichier des libellés.", time: "24 Mai, 13:00" }
    ]
  }
];

const INITIAL_LOGS = [
  { id: 101, type: "security", text: "Tentative de connexion suspecte bloquée (IP: 197.200.41.3, Algiers)", time: "18:25:12", status: "blocked" },
  { id: 102, type: "system", text: "Envoi de 142 mails de rappel de rendez-vous terminé avec succès", time: "18:00:00", status: "success" },
  { id: 103, type: "database", text: "Sauvegarde miroir automatique de la base PostgreSQL réussie", time: "17:30:45", status: "success" },
  { id: 104, type: "system", text: "Échec temporaire de la passerelle d'envoi de SMS Mobilis (Code: 504)", time: "16:12:10", status: "warning" }
];

export default function Panel({ onNavigateToPage }) {
  // --- NAV & SECTION STATES ---
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, users, validations, errors, settings, system

  // --- CORE DATA IN STATE FOR PERSISTENCE ---
  const [usersList, setUsersList] = useState(() => {
    const saved = localStorage.getItem('tassarut_admin_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [therapistsList, setTherapistsList] = useState(() => {
    const saved = localStorage.getItem('tassarut_admin_therapists');
    return saved ? JSON.parse(saved) : INITIAL_THERAPISTS;
  });

  const [errorReportsList, setErrorReportsList] = useState(() => {
    const saved = localStorage.getItem('tassarut_admin_errors');
    return saved ? JSON.parse(saved) : INITIAL_ERROR_REPORTS;
  });

  const [systemLogs, setSystemLogs] = useState(INITIAL_LOGS);

  // --- GLOBAL CONFIGS STATE ---
  const [siteConfigs, setSiteConfigs] = useState(() => {
    const saved = localStorage.getItem('tassarut_admin_configs');
    return saved ? JSON.parse(saved) : {
      siteName: "Tassarut",
      logoDesc: "Plateforme algérienne de téléconsultation psychologique et de thérapie en ligne",
      defaultLang: "Français",
      timezone: "Africa/Algiers",
      maintenanceMode: false,
      contactEmail: "admin@tassarut.dz",
      signupEnabled: true
    };
  });

  // Keep localStorage in sync
  useEffect(() => {
    localStorage.setItem('tassarut_admin_users', JSON.stringify(usersList));
  }, [usersList]);

  useEffect(() => {
    localStorage.setItem('tassarut_admin_therapists', JSON.stringify(therapistsList));
  }, [therapistsList]);

  useEffect(() => {
    localStorage.setItem('tassarut_admin_errors', JSON.stringify(errorReportsList));
  }, [errorReportsList]);

  useEffect(() => {
    localStorage.setItem('tassarut_admin_configs', JSON.stringify(siteConfigs));
  }, [siteConfigs]);

  // --- MODALS & UI INTERACTION STATES ---
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [selectedError, setSelectedError] = useState(null);

  // Search & Filter state
  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('ALL');
  const [usersStatusFilter, setUsersStatusFilter] = useState('ALL');

  const [errorsSearch, setErrorsSearch] = useState('');
  const [errorsCategoryFilter, setErrorsCategoryFilter] = useState('ALL');
  const [errorsStatusFilter, setErrorsStatusFilter] = useState('ALL');

  // Confirmation dialog state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    actionType: "", // 'BANN', 'UNBANN', 'APPROVE_THERAPIST', 'REJECT_THERAPIST', 'MAINTENANCE_TOGGLE', 'DELETE_CONTENT'
    targetId: null,
    extraData: null
  });

  // Reply text state for desk
  const [adminReplyText, setAdminReplyText] = useState('');
  const [adminInternalNotes, setAdminInternalNotes] = useState('');

  // Safety trigger for manual stats refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- INTERMEDIATE CALCULATIONS (KPIs) ---
  const kpis = {
    totalUsers: usersList.length,
    activeToday: usersList.filter(u => u.status === 'Active').length,
    pendingTherapists: therapistsList.filter(t => t.status === 'PENDING').length,
    openTickets: errorReportsList.filter(e => e.status === 'Ouvert' || e.status === 'En cours').length,
    criticalTickets: errorReportsList.filter(e => e.severity === 'Critique' || e.severity === 'Élevée').length,
    validatedTherapists: therapistsList.filter(t => t.status === 'APPROVED').length,
    maintenanceStatus: siteConfigs.maintenanceMode ? "Actif" : "Inactif"
  };

  const handleRefreshStats = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      // Simulate new log
      const newLog = {
        id: Date.now(),
        type: "system",
        text: "Rafraîchissement manuel des paramètres accompli : Statut OK.",
        time: new Date().toLocaleTimeString('fr-FR'),
        status: "success"
      };
      setSystemLogs(prev => [newLog, ...prev.slice(0, 5)]);
    }, 800);
  };

  // --- CONFIRMATION HANDLERS ---
  const triggerConfirmation = (actionType, title, message, targetId, extraData = null) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      actionType,
      targetId,
      extraData
    });
  };

  const executeConfirmedAction = () => {
    const { actionType, targetId, extraData } = confirmModal;

    if (actionType === 'MAINTENANCE_TOGGLE') {
      setSiteConfigs(prev => ({ ...prev, maintenanceMode: !prev.maintenanceMode }));
      // Save logs
      const log = {
        id: Date.now(),
        type: "system",
        text: `Mode maintenance modifié par l'administrateur: ${!siteConfigs.maintenanceMode ? 'Activé' : 'Désactivé'}`,
        time: new Date().toLocaleTimeString('fr-FR'),
        status: !siteConfigs.maintenanceMode ? "warning" : "success"
      };
      setSystemLogs(prev => [log, ...prev]);
    }

    else if (actionType === 'BANN') {
      setUsersList(prev => prev.map(u => u.id === targetId ? { ...u, status: "Banned" } : u));
      if (selectedUser && selectedUser.id === targetId) {
        setSelectedUser(prev => ({ ...prev, status: "Banned" }));
      }
    }

    else if (actionType === 'UNBANN') {
      setUsersList(prev => prev.map(u => u.id === targetId ? { ...u, status: "Active" } : u));
      if (selectedUser && selectedUser.id === targetId) {
        setSelectedUser(prev => ({ ...prev, status: "Active" }));
      }
    }

    else if (actionType === 'APPROVE_THERAPIST') {
      // Find therapist first
      const therapistObj = therapistsList.find(t => t.id === targetId);
      if (therapistObj) {
        // Change status in therapistsList
        setTherapistsList(prev => prev.map(t => t.id === targetId ? { ...t, status: "APPROVED" } : u => t));
        // Add to the general users output if they don't exist
        const alreadyInUsers = usersList.some(u => u.email.toLowerCase() === therapistObj.email.toLowerCase());
        if (!alreadyInUsers) {
          const newU = {
            id: Date.now(),
            name: therapistObj.name,
            email: therapistObj.email,
            role: "THERAPIST",
            status: "Active",
            joined: new Date().toISOString().split('T')[0],
            lastActive: "À l'instant"
          };
          setUsersList(prev => [...prev, newU]);
        } else {
          // just update status
          setUsersList(prev => prev.map(u => u.email.toLowerCase() === therapistObj.email.toLowerCase() ? { ...u, status: "Active" } : u));
        }

        // Add System success log
        const log = {
          id: Date.now(),
          type: "system",
          text: `Compte vérifié validé avec succès : ${therapistObj.name}`,
          time: new Date().toLocaleTimeString('fr-FR'),
          status: "success"
        };
        setSystemLogs(prev => [log, ...prev]);
      }
      setSelectedTherapist(null);
    }

    else if (actionType === 'REJECT_THERAPIST') {
      const therapistObj = therapistsList.find(t => t.id === targetId);
      if (therapistObj) {
        setTherapistsList(prev => prev.map(t => t.id === targetId ? { ...t, status: "REJECTED" } : t));
        // Update user side too if listed
        setUsersList(prev => prev.map(u => u.email.toLowerCase() === therapistObj.email.toLowerCase() ? { ...u, status: "Suspended" } : u));

        const log = {
          id: Date.now(),
          type: "security",
          text: `Dossier de praticien rejeté : ${therapistObj.name} (Raison: documents non conformes)`,
          time: new Date().toLocaleTimeString('fr-FR'),
          status: "blocked"
        };
        setSystemLogs(prev => [log, ...prev]);
      }
      setSelectedTherapist(null);
    }

    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  // --- SUPPORT RESPONSE ACTIONS ---
  const handleSendReply = (e) => {
    e.preventDefault();
    if (!adminReplyText.trim() && !adminInternalNotes.trim()) return;

    setErrorReportsList(prev => prev.map(item => {
      if (item.id === selectedError.id) {
        const updatedReplies = [...item.replies];
        if (adminReplyText.trim()) {
          updatedReplies.push({
            sender: "Admin (Karim)",
            text: adminReplyText,
            time: "À l'instant"
          });
        }
        return {
          ...item,
          replies: updatedReplies,
          status: "En cours" // Automatic transition to in progress
        };
      }
      return item;
    }));

    // Update locally too
    setSelectedError(prev => {
      const updatedReplies = [...prev.replies];
      if (adminReplyText.trim()) {
        updatedReplies.push({
          sender: "Admin (Karim)",
          text: adminReplyText,
          time: "À l'instant"
        });
      }
      return {
        ...prev,
        replies: updatedReplies,
        status: "En cours"
      };
    });

    setAdminReplyText('');
    setAdminInternalNotes('');
  };

  const handleToggleTicketStatus = (ticketId, isResolved) => {
    const nextStatus = isResolved ? "Résolu" : "Ouvert";
    setErrorReportsList(prev => prev.map(item => item.id === ticketId ? { ...item, status: nextStatus } : item));
    if (selectedError && selectedError.id === ticketId) {
      setSelectedError(prev => ({ ...prev, status: nextStatus }));
    }

    const log = {
      id: Date.now(),
      type: "system",
      text: `Ticket support ${ticketId} marqué comme ${nextStatus.toUpperCase()}`,
      time: new Date().toLocaleTimeString('fr-FR'),
      status: isResolved ? "success" : "warning"
    };
    setSystemLogs(prev => [log, ...prev]);
  };

  // --- FILTERS APPLIED ---
  const filteredUsers = usersList.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(usersSearch.toLowerCase()) || 
                          user.email.toLowerCase().includes(usersSearch.toLowerCase());
    const matchesRole = usersRoleFilter === 'ALL' || user.role === usersRoleFilter;
    const matchesStatus = usersStatusFilter === 'ALL' || user.status === usersStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredErrors = errorReportsList.filter(report => {
    const matchesSearch = report.title.toLowerCase().includes(errorsSearch.toLowerCase()) || 
                          report.user.toLowerCase().includes(errorsSearch.toLowerCase()) ||
                          report.id.toLowerCase().includes(errorsSearch.toLowerCase());
    const matchesCat = errorsCategoryFilter === 'ALL' || report.category === errorsCategoryFilter;
    const matchesStatus = errorsStatusFilter === 'ALL' || report.status === errorsStatusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-bg-main text-text-main font-sans selection:bg-primary-light flex flex-col md:flex-row">
      
      {/* --- SIDEBAR HEADER ON DESKTOP & FLUID NAVIGATION --- */}
      <aside className="w-full md:w-64 bg-card-bg border-b md:border-b-0 md:border-r border-border-color shrink-0 flex flex-col justify-between">
        <div>
          {/* Logo Brand Brand */}
          <div className="p-6 border-b border-border-color flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center font-bold text-lg">
                <LeafKeyIcon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight">Tassarut</h1>
                <span className="text-[10px] font-bold text-primary tracking-widest uppercase block -mt-1">Console Admin</span>
              </div>
            </div>
            {/* Dark & Live visual */}
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>

          {/* User Identity widget */}
          <div className="p-4 mx-4 mt-4 bg-bg-main border border-border-color rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-sm">
              AD
            </div>
            <div className="truncate">
              <span className="block text-xs font-black text-text-main truncate">Karim Brahimi</span>
              <span className="block text-[9px] font-bold text-text-muted uppercase tracking-widest mt-0.5">Admin Général</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {[
              { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
              { id: 'users', label: 'Utilisateurs & Accès', icon: Users, badge: null },
              { id: 'validations', label: 'Vérification Praticiens', icon: FileCheck, badge: kpis.pendingTherapists },
              { id: 'errors', label: 'Bugs & Support', icon: AlertTriangle, badge: kpis.openTickets },
              { id: 'settings', label: 'Configuration Globale', icon: Settings, badge: null },
              { id: 'system', label: 'Journaux & Système', icon: ShieldAlert, badge: null }
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedUser(null);
                    setSelectedTherapist(null);
                    setSelectedError(null);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    isActive 
                      ? 'bg-primary text-white font-bold shadow-md shadow-primary/20' 
                      : 'text-text-muted hover:bg-bg-main hover:text-text-main'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TabIcon size={16} className={isActive ? 'text-white' : 'opacity-70'} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && tab.badge > 0 ? (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                      isActive ? 'bg-white text-primary' : 'bg-red-500/10 text-red-600 border border-red-500/15'
                    }`}>
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Logout section */}
        <div className="p-4 border-t border-border-color">
          <button
            onClick={() => onNavigateToPage('LOGIN')}
            className="w-full py-2.5 hover:bg-red-500/10 hover:text-red-500 text-text-muted border border-transparent rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut size={14} />
            DÉCONNEXION
          </button>
        </div>
      </aside>

      {/* --- MAIN PAGE WRAPPER --- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* --- GLOBAL ADMIN TOP BAR --- */}
        <header className="p-4 md:p-6 bg-card-bg border-b border-border-color flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black text-primary tracking-widest uppercase">Console de gestion intégrée</span>
            <h2 className="text-xl font-black text-text-main mt-0.5">
              {activeTab === 'dashboard' && 'Vue d\'ensemble du système'}
              {activeTab === 'users' && 'Directory des Comptes & Rôles'}
              {activeTab === 'validations' && 'Modération & Validation Praticiens'}
              {activeTab === 'errors' && 'Centre de Résolution des Erreurs'}
              {activeTab === 'settings' && 'Paramètres de l\'Application'}
              {activeTab === 'system' && 'Infrastructure & Journaux d\'Événements'}
            </h2>
          </div>

          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
            <button
              onClick={handleRefreshStats}
              title="Rafraîchir les métriques"
              className={`p-2.5 border border-border-color hover:border-text-muted/30 hover:bg-bg-main text-text-muted rounded-xl transition-all cursor-pointer bg-card-bg flex items-center gap-1.5 text-xs font-semibold ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Rafraîchir</span>
            </button>

            {/* Platform status indicator */}
            <div className="p-1 px-3.5 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
              <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
              Serveur OK
            </div>
          </div>
        </header>

        {/* --- CORE SECTIONS RENDERED BASED ON STATED TAB --- */}
        <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
          
          {/* ================= SECTION 1: DASHBOARD OVERVIEW ================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Alert if Maintenance mode is active */}
              {siteConfigs.maintenanceMode && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-start gap-3 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="shrink-0 mt-0.5 text-amber-500" size={18} />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide">Mode Maintenance Actif</h4>
                    <p className="text-[11px] font-medium leading-relaxed mt-0.5">La plateforme de téléconsultation n'accepte actuellement plus de nouvelles sessions. Les praticiens et patients connectés verront un bandeau d'indisponibilité préventif.</p>
                  </div>
                </div>
              )}

              {/* KPIs Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="t-card">
                  <div className="flex items-center justify-between text-text-muted">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Membres totaux</span>
                    <Users size={16} />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-text-main">{kpis.totalUsers}</span>
                    <span className="text-[10px] font-extrabold text-green-500 font-mono">+12%</span>
                  </div>
                  <span className="text-[9px] font-semibold text-text-muted/65 mt-1 block">Inscrits cette semaine</span>
                </div>

                <div className="t-card">
                  <div className="flex items-center justify-between text-text-muted">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Praticiens Validés</span>
                    <UserCheck size={16} />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-text-main">{kpis.validatedTherapists}</span>
                    <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded">ACTIFS</span>
                  </div>
                  <span className="text-[9px] font-semibold text-text-muted/65 mt-1 block">Comptes validés enregistrés</span>
                </div>

                <div className="t-card">
                  <div className="flex items-center justify-between text-text-muted">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Dossiers en attente</span>
                    <FileCheck className="text-amber-500" size={16} />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-text-main">{kpis.pendingTherapists}</span>
                    {kpis.pendingTherapists > 0 ? (
                      <span className="h-2 w-2 bg-amber-500 rounded-full animate-bounce" />
                    ) : null}
                  </div>
                  <span className="text-[9px] font-semibold text-text-muted/65 mt-1 block">Validations de diplômes requises</span>
                </div>

                <div className="t-card">
                  <div className="flex items-center justify-between text-text-muted">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Tickets de Bug Ouverts</span>
                    <AlertTriangle className={kpis.criticalTickets > 0 ? 'text-red-500 animate-pulse' : 'text-text-muted'} size={16} />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-text-main">{kpis.openTickets}</span>
                    {kpis.criticalTickets > 0 && (
                      <span className="text-[9px] text-red-500 font-extrabold uppercase tracking-wider bg-red-500/10 px-2 py-0.5 rounded">
                        {kpis.criticalTickets} Critiques
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold text-text-muted/65 mt-1 block">Rapports d'incident ouverts</span>
                </div>
              </div>

              {/* Real-time Analytics Custom SVG Graphs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Traffic Trend SVG Graph */}
                <div className="t-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-text-main">Trafic & Sessions de Consultation</h4>
                      <p className="text-[10px] text-text-muted mt-0.5">Sessions de téléconsultation actives et visiteurs journaliers</p>
                    </div>
                    <span className="text-[10px] font-bold text-text-muted/60">7 derniers jours</span>
                  </div>
                  
                  {/* custom SVG Line graph */}
                  <div className="relative pt-2">
                    <svg viewBox="0 0 400 150" className="w-full h-36">
                      <defs>
                        <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <grid className="opacity-15" stroke="currentColor">
                        <line x1="0" y1="37" x2="400" y2="37" strokeWidth="0.5" />
                        <line x1="0" y1="75" x2="400" y2="75" strokeWidth="0.5" />
                        <line x1="0" y1="112" x2="400" y2="112" strokeWidth="0.5" />
                      </grid>
                      {/* Grid labels */}
                      <text x="5" y="32" className="text-[8px] fill-text-muted/60 font-mono">100 s.</text>
                      <text x="5" y="70" className="text-[8px] fill-text-muted/60 font-mono">50 s.</text>
                      <text x="5" y="108" className="text-[8px] fill-text-muted/60 font-mono">15 s.</text>

                      {/* Area Fill */}
                      <path d="M 0 150 Q 50 120, 100 80 T 200 110 T 300 45 T 400 30 L 400 150 L 0 150 Z" fill="url(#purpleGradient)" />
                      {/* Line plot */}
                      <path d="M 0 150 Q 50 120, 100 80 T 200 110 T 300 45 T 400 30" fill="none" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" />
                      
                      {/* Coordinate Dots */}
                      <circle cx="100" cy="80" r="4.5" className="fill-white stroke-primary stroke-2" />
                      <circle cx="200" cy="110" r="4.5" className="fill-white stroke-primary stroke-2" />
                      <circle cx="300" cy="45" r="4.5" className="fill-white stroke-primary stroke-2" />
                      <circle cx="400" cy="30" r="4.5" className="fill-white stroke-primary stroke-2" />

                      {/* Labels */}
                      <text x="100" y="65" className="text-[9px] font-black fill-text-main text-center">45</text>
                      <text x="300" y="30" className="text-[9px] font-black fill-text-main text-center">88</text>
                    </svg>

                    <div className="flex justify-between items-center text-[9px] font-mono text-text-muted/60 px-1 mt-2">
                      <span>Jeudi 21</span>
                      <span>Vendredi 22</span>
                      <span>Samedi 23</span>
                      <span>Dimanche 24</span>
                      <span>Lundi 25</span>
                      <span>Mardi 26</span>
                      <span>Aujourd'hui</span>
                    </div>
                  </div>
                </div>

                {/* Bug ticket status SVG chart */}
                <div className="t-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-text-main">Nouveaux Signalements vs Clôtures</h4>
                      <p className="text-[10px] text-text-muted mt-0.5">Ratio de résolution hebdomadaire des bugs envoyés par les membres</p>
                    </div>
                    <span className="text-[10px] font-bold text-text-muted/60">Tickets support</span>
                  </div>

                  {/* SVG Bar Chart */}
                  <div className="relative pt-2">
                    <svg viewBox="0 0 400 150" className="w-full h-36">
                      {/* Grid lines */}
                      <line x1="0" y1="37" x2="400" y2="37" stroke="currentColor" className="opacity-10" />
                      <line x1="0" y1="75" x2="400" y2="75" stroke="currentColor" className="opacity-10" />
                      <line x1="0" y1="112" x2="400" y2="112" stroke="currentColor" className="opacity-10" />

                      {/* Day 1 */}
                      <rect x="50" y="50" width="12" height="100" rx="3" fill="#7C3AED" className="opacity-30" />
                      <rect x="66" y="80" width="12" height="70" rx="3" fill="#10B981" />

                      {/* Day 2 */}
                      <rect x="120" y="30" width="12" height="120" rx="3" fill="#7C3AED" className="opacity-30" />
                      <rect x="136" y="45" width="12" height="105" rx="3" fill="#10B981" />

                      {/* Day 3 */}
                      <rect x="190" y="70" width="12" height="80" rx="3" fill="#7C3AED" className="opacity-30" />
                      <rect x="206" y="60" width="12" height="90" rx="3" fill="#10B981" />

                      {/* Day 4 */}
                      <rect x="260" y="40" width="12" height="110" rx="3" fill="#7C3AED" className="opacity-30" />
                      <rect x="276" y="40" width="12" height="110" rx="3" fill="#10B981" />

                      {/* Day 5 (Today) */}
                      <rect x="330" y="15" width="12" height="135" rx="3" fill="#7C3AED" />
                      <rect x="346" y="55" width="12" height="95" rx="3" fill="#10B981" />
                    </svg>

                    <div className="flex justify-between items-center text-[9px] font-mono text-text-muted/60 px-6 mt-2">
                      <span>23 Mai</span>
                      <span>24 Mai</span>
                      <span>25 Mai</span>
                      <span>26 Mai</span>
                      <span className="font-bold text-text-main">Aujourd'hui</span>
                    </div>

                    <div className="flex items-center gap-4 justify-center pt-2 border-t border-border-color/60 text-[9px] font-bold">
                      <div className="flex items-center gap-1.5 text-primary">
                        <span className="h-2 w-2 rounded-sm bg-primary" />
                        Signalés / Reçus
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-500">
                        <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                        Résolus / Clôturés
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feed of combined Recent Activity / Logging */}
              <div className="t-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-text-main">Événements en cours d'exécution</h4>
                    <p className="text-[10px] text-text-muted mt-0.5">Enregistrements en temps réel de l'activité utilisateur et serveur</p>
                  </div>
                  <HelpCircle size={14} className="text-text-muted/50" />
                </div>

                <div className="division overflow-hidden border border-border-color rounded-2xl">
                  {systemLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="p-3.5 bg-card-bg even:bg-bg-main border-b border-border-color last:border-b-0 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {log.type === "security" && (
                          <span className="p-1.5 bg-red-500/10 text-red-500 rounded-lg shrink-0">
                            <AlertOctagon size={14} />
                          </span>
                        )}
                        {log.type === "database" && (
                          <span className="p-1.5 bg-primary/10 text-primary rounded-lg shrink-0">
                            <Activity size={14} />
                          </span>
                        )}
                        {log.type === "system" && log.status === "warning" && (
                          <span className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg shrink-0">
                            <AlertCircle size={14} />
                          </span>
                        )}
                        {log.type === "system" && log.status === "success" && (
                          <span className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                            <Check size={14} />
                          </span>
                        )}

                        <p className="text-xs font-semibold text-text-main truncate leading-normal">
                          {log.text}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[9px] text-text-muted/60 shrink-0">
                        <span className="opacity-40">UTC</span>
                        <span>{log.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION 2: USER & ACCESSIBILITY MANAGEMENT ================= */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              
              {/* Directory Filter bar */}
              <div className="p-5 bg-card-bg border border-border-color rounded-2xl flex flex-col md:flex-row items-center gap-4 justify-between shadow-sm">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted/55" size={16} />
                  <input
                    type="text"
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    placeholder="Chercher par nom ou email..."
                    className="w-full pl-10 pr-4 py-2 bg-bg-main border border-border-color rounded-xl text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-text-main"
                  />
                  {usersSearch && (
                    <button onClick={() => setUsersSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-red-500 text-xs font-black cursor-pointer">✕</button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto self-stretch md:self-auto justify-end">
                  <div className="flex gap-1.5 bg-bg-main p-1 rounded-xl border border-border-color">
                    {['ALL', 'PATIENT', 'THERAPIST'].map((roleOpt) => (
                      <button
                        key={roleOpt}
                        onClick={() => setUsersRoleFilter(roleOpt)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          usersRoleFilter === roleOpt
                            ? 'bg-primary text-white shadow-sm font-black'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        {roleOpt === 'ALL' ? 'Tous' : roleOpt === 'PATIENT' ? 'Patients' : 'Thérapeutes'}
                      </button>
                    ))}
                  </div>

                  <select
                    value={usersStatusFilter}
                    onChange={(e) => setUsersStatusFilter(e.target.value)}
                    className="px-3.5 py-2 bg-bg-main border border-border-color rounded-xl text-[11px] font-black outline-none focus:border-primary text-text-muted text-right tracking-tight cursor-pointer"
                  >
                    <option value="ALL">Statut: Tous</option>
                    <option value="Active">Actifs</option>
                    <option value="Suspended">Suspendus</option>
                    <option value="Banned">Bannis</option>
                  </select>
                </div>
              </div>

              {/* Users Directory Table */}
              <div className="bg-card-bg border border-border-color rounded-[1.5rem] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-bg-main border-b border-border-color text-[10px] font-extrabold uppercase tracking-wider text-text-muted/60">
                        <th className="p-4 pl-6">Nom</th>
                        <th className="p-4">E-mail</th>
                        <th className="p-4">Rôle</th>
                        <th className="p-4">Créé le</th>
                        <th className="p-4">Dernière activité</th>
                        <th className="p-4">Statut</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color/60 text-xs">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="p-8 text-center text-text-muted font-medium italic">
                            Aucun utilisateur ne correspond aux critères de recherche.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-primary/[0.01] transition-all">
                            <td className="p-4 pl-6 font-bold text-text-main flex items-center gap-2.5">
                              <span className={`w-2.5 h-2.5 rounded-full ${
                                user.role === 'THERAPIST' ? 'bg-primary' : 'bg-emerald-500'
                              }`} />
                              {user.name}
                            </td>
                            <td className="p-4 text-text-muted font-mono">{user.email}</td>
                            <td className="p-4">
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border ${
                                user.role === 'THERAPIST'
                                  ? 'text-primary bg-primary/5 border-primary/10'
                                  : 'text-emerald-600 bg-emerald-500/5 border-emerald-500/10'
                              }`}>
                                {user.role === 'THERAPIST' ? 'PRATICIEN' : 'PATIENT'}
                              </span>
                            </td>
                            <td className="p-4 text-text-muted font-mono">{user.joined}</td>
                            <td className="p-4 text-text-muted font-semibold">{user.lastActive}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                user.status === 'Active' ? 'bg-green-500/10 text-green-600' :
                                user.status === 'Suspended' ? 'bg-amber-500/10 text-amber-600' :
                                'bg-red-500/10 text-red-600'
                              }`}>
                                {user.status}
                              </span>
                            </td>
                            <td className="p-4 pr-6 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => setSelectedUser(user)}
                                className="p-1.5 hover:bg-bg-main border border-border-color rounded-lg text-text-muted hover:text-text-main transition-colors cursor-pointer"
                                title="Voir détails"
                              >
                                <Eye size={12} />
                              </button>
                              
                              {user.status === 'Banned' ? (
                                <button
                                  onClick={() => triggerConfirmation('UNBANN', "Réactiver l'utilisateur", `Souhaitez-vous lever le bannissement de ${user.name} ? Son accès à la plateforme sera immédiatement restauré.`, user.id)}
                                  className="p-1.5 bg-green-500/5 hover:bg-green-500/10 text-green-600 rounded-lg border border-green-500/15 transition-all text-[10px] font-extrabold cursor-pointer"
                                >
                                  Réactiver
                                </button>
                              ) : (
                                <button
                                  onClick={() => triggerConfirmation('BANN', "Suspendre / Bannir", `Êtes-vous sûr de vouloir bloquer l'accès de ${user.name} ? Il ne pourra plus se connecter.`, user.id)}
                                  className="p-1.5 bg-red-500/5 hover:bg-red-500/10 text-red-600 rounded-lg border border-red-500/15 transition-all text-[10px] font-extrabold cursor-pointer"
                                >
                                  Bannir
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* User detail info modal */}
              {selectedUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-card-bg w-full max-w-md border border-border-color rounded-[1.5rem] shadow-2xl p-6 space-y-5">
                    <div className="flex justify-between items-center">
                      <h3 className="font-black text-sm text-text-main">Fiche Utilisateur Globale</h3>
                      <button onClick={() => setSelectedUser(null)} className="text-text-muted hover:text-red-500 cursor-pointer">✕</button>
                    </div>

                    <div className="flex gap-3.5 items-center p-4 bg-bg-main border border-border-color rounded-2xl">
                      <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black">
                        {selectedUser.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="block text-xs font-black text-text-main">{selectedUser.name}</span>
                        <span className="block text-[10px] text-text-muted font-mono">{selectedUser.email}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                      <div className="p-3 bg-bg-main rounded-xl border border-border-color">
                        <span className="block text-[8px] font-extrabold uppercase text-text-muted">Rôle système</span>
                        <span className="block mt-0.5 text-text-main">{selectedUser.role}</span>
                      </div>
                      <div className="p-3 bg-bg-main rounded-xl border border-border-color">
                        <span className="block text-[8px] font-extrabold uppercase text-text-muted">Inscrit depuis</span>
                        <span className="block mt-0.5 text-text-main font-mono">{selectedUser.joined}</span>
                      </div>
                      <div className="p-3 bg-bg-main rounded-xl border border-border-color">
                        <span className="block text-[8px] font-extrabold uppercase text-text-muted">Activité</span>
                        <span className="block mt-0.5 text-text-main">{selectedUser.lastActive}</span>
                      </div>
                      <div className="p-3 bg-bg-main rounded-xl border border-border-color">
                        <span className="block text-[8px] font-extrabold uppercase text-text-muted">Statut Compte</span>
                        <span className="block mt-0.5 text-text-main font-bold">{selectedUser.status}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          alert(`Un e-mail temporaire de réinitialisation de mot de passe a été envoyé à l'adresse sécurisée: ${selectedUser.email}`);
                          setSelectedUser(null);
                        }}
                        className="flex-1 py-2.5 bg-bg-main border border-border-color hover:border-primary/40 rounded-xl text-xs font-bold text-text-muted hover:text-primary transition-all cursor-pointer"
                      >
                        Changer Mot de passe
                      </button>
                      <button
                        onClick={() => setSelectedUser(null)}
                        className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-black cursor-pointer"
                      >
                        Fermer la Fiche
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= SECTION 3: THERAPIST VALIDATION WORKFLOW ================= */}
          {activeTab === 'validations' && (
            <div className="space-y-6">
              <div className="p-4 bg-primary-light/50 dark:bg-primary-light/10 border border-primary/20 rounded-2xl flex items-start gap-3.5">
                <AlertCircle className="text-primary shrink-0 mt-0.5" size={18} />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black uppercase tracking-wide text-primary">Processus d'homologation légale obligatoire</h4>
                  <p className="text-[11px] font-semibold text-text-muted leading-relaxed">Chaque praticien inscrit sur Tassarut doit impérativement charger un scan lisible de son diplôme clinique national et son attestation d'autorisation d'exercer délivrée par les autorités compétentes algériennes.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* List of Requests Column */}
                <div className="lg:col-span-2 space-y-3.5">
                  <h3 className="text-sm font-black text-text-main">Attributions en attente ({therapistsList.filter(t=>t.status==='PENDING').length})</h3>
                  
                  {therapistsList.filter(t => t.status === 'PENDING').length === 0 ? (
                    <div className="p-8 bg-card-bg border border-border-color rounded-2xl text-center space-y-2">
                      <CheckCircle2 className="text-emerald-500 mx-auto" size={32} />
                      <p className="text-xs font-black text-text-main uppercase">Tous les dossiers sont validés</p>
                      <p className="text-[10px] text-text-muted">Aucune demande d'inscription d'ordre professionnel ou diplôme n'est en attente d'arbitrage.</p>
                    </div>
                  ) : (
                    therapistsList.filter(t => t.status === 'PENDING').map((req) => (
                      <div 
                        key={req.id} 
                        onClick={() => setSelectedTherapist(req)}
                        className={`p-4 border rounded-2xl cursor-pointer transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                          selectedTherapist && selectedTherapist.id === req.id
                            ? 'bg-primary/5 border-primary shadow-md shadow-primary/5'
                            : 'bg-card-bg border-border-color hover:border-primary/30'
                        }`}
                      >
                        <div className="space-y-1">
                          <span className="text-[9px] text-primary font-extrabold uppercase tracking-widest">{req.specialty}</span>
                          <h4 className="text-xs font-black text-text-main">{req.name}</h4>
                          <span className="block text-[10px] text-text-muted font-mono">{req.email}</span>
                        </div>

                        <div className="flex items-center gap-3.5 self-end sm:self-auto">
                          <div className="text-right hidden sm:block">
                            <span className="block text-[8px] font-black uppercase text-text-muted">Envoyé le</span>
                            <span className="block text-[10px] font-bold text-text-main font-mono mt-0.5">{req.submittedAt}</span>
                          </div>
                          
                          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/15 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0">
                            En Attente
                          </span>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Log of resolved validations */}
                  <div className="pt-4 space-y-2">
                    <h3 className="text-xs font-black text-text-muted uppercase tracking-widest">Demandes arbitrées récemment</h3>
                    <div className="border border-border-color rounded-2xl overflow-hidden bg-card-bg">
                      {therapistsList.filter(t=>t.status !== 'PENDING').map(t => (
                        <div key={t.id} className="p-3 bg-card-bg border-b border-border-color last:border-0 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-extrabold text-text-main">{t.name}</span>
                            <span className="text-[10px] text-text-muted font-mono ml-2">({t.email})</span>
                          </div>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                            t.status === 'APPROVED' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-650'
                          }`}>
                            {t.status === 'APPROVED' ? 'Validé' : 'Refusé'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Detail View of Selected Request */}
                <div className="space-y-3.5">
                  <h3 className="text-sm font-black text-text-main">Examen du Dossier</h3>
                  
                  {selectedTherapist ? (
                    <div className="p-5 bg-card-bg border border-border-color rounded-2xl space-y-5 shadow-sm">
                      <div className="pb-3.5 border-b border-border-color/60">
                        <span className="text-[9px] font-extrabold text-primary uppercase tracking-widest">{selectedTherapist.specialty}</span>
                        <h4 className="text-sm font-black text-text-main">{selectedTherapist.name}</h4>
                        <span className="text-[10px] font-semibold text-text-muted mt-0.5 block">Expérience : {selectedTherapist.experience} • Diplômé de {selectedTherapist.institution}</span>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[9px] font-extrabold text-text-muted uppercase tracking-widest">Présentation du praticien</span>
                        <p className="text-[11px] leading-relaxed text-text-muted">"{selectedTherapist.bio}"</p>
                      </div>

                      <div className="space-y-2.5">
                        <span className="text-[9px] font-extrabold text-text-muted uppercase tracking-widest block">Documents fournis (Justificatifs)</span>
                        <div className="space-y-2">
                          {selectedTherapist.documents.map((doc, idx) => (
                            <div key={idx} className="p-3 bg-bg-main border border-border-color rounded-xl flex items-center justify-between text-xs font-semibold hover:border-primary/20 transition-all">
                              <div className="truncate pr-2">
                                <span className="block text-[9px] font-extrabold text-primary uppercase tracking-wide">{doc.type}</span>
                                <span className="block text-text-main truncate text-[11px] mt-0.5">{doc.name}</span>
                              </div>
                              <span className="text-[9px] font-mono text-text-muted shrink-0 bg-card-bg px-1.5 py-0.5 border rounded-lg">{doc.size}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-3.5 border-t border-border-color">
                        <button
                          onClick={() => triggerConfirmation(
                            'REJECT_THERAPIST', 
                            "Rejeter l'inscription du Praticien", 
                            `Souhaitez-vous fermement rejeter le dossier de ${selectedTherapist.name} ? Un mail d'information automatique lui sera expédié.`, 
                            selectedTherapist.id
                          )}
                          className="py-2.5 border border-red-500/20 hover:bg-red-500/5 text-red-600 rounded-xl text-xs font-black transition-all cursor-pointer text-center"
                        >
                          Rejeter le dossier
                        </button>
                        <button
                          onClick={() => triggerConfirmation(
                            'APPROVE_THERAPIST',
                            "Valider l'inscription",
                            `Confirmez-vous que les documents de ${selectedTherapist.name} sont légalement authentiques et conformes à l'exercice ? Son compte praticien sera officiellement activé.`,
                            selectedTherapist.id
                          )}
                          className="py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-black transition-all cursor-pointer text-center shadow-lg shadow-primary/20"
                        >
                          Valider le praticien
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-10 border border-border-color bg-card-bg rounded-2xl text-center space-y-2 h-64 flex flex-col items-center justify-center">
                      <FileCheck className="text-text-muted/40" size={36} />
                      <p className="text-xs text-text-muted font-bold leading-relaxed max-w-[200px]">Sélectionnez une demande dans la liste pour examiner ses documents légaux.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION 4: SUPPORT ERROR DESK ================= */}
          {activeTab === 'errors' && (
            <div className="space-y-6">
              
              {/* Desk Filters bar */}
              <div className="p-4 bg-card-bg border border-border-color rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted/50" size={16} />
                  <input
                    type="text"
                    value={errorsSearch}
                    onChange={(e) => setErrorsSearch(e.target.value)}
                    placeholder="Chercher par ticket, titre ou nom de membre..."
                    className="w-full pl-10 pr-4 py-2.5 bg-bg-main border border-border-color rounded-xl text-xs font-semibold outline-none focus:border-primary text-text-main"
                  />
                </div>

                <div className="flex gap-2.5 w-full md:w-auto self-stretch md:self-auto justify-end">
                  <select
                    value={errorsCategoryFilter}
                    onChange={(e) => setErrorsCategoryFilter(e.target.value)}
                    className="px-3.5 py-2.5 bg-bg-main border border-border-color rounded-xl text-[11px] font-black text-text-muted cursor-pointer font-sans"
                  >
                    <option value="ALL">Toutes Catégories</option>
                    <option value="Paiement">Paiement</option>
                    <option value="Consultation Vidéo">Consultation Vidéo</option>
                    <option value="Contenu / UI">Contenu / UI</option>
                  </select>

                  <select
                    value={errorsStatusFilter}
                    onChange={(e) => setErrorsStatusFilter(e.target.value)}
                    className="px-3.5 py-2.5 bg-bg-main border border-border-color rounded-xl text-[11px] font-black text-text-muted cursor-pointer font-sans"
                  >
                    <option value="ALL">Tous les statuts</option>
                    <option value="Ouvert">Signalements Ouverts</option>
                    <option value="En cours">En cours d'examen</option>
                    <option value="Résolu">Résolus</option>
                  </select>
                </div>
              </div>

              {/* Tickets layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Tickets list */}
                <div className="lg:col-span-2 space-y-3.5">
                  <h3 className="text-sm font-black text-text-main">Boîte de réception des tickets ({filteredErrors.length})</h3>
                  
                  <div className="space-y-3">
                    {filteredErrors.length === 0 ? (
                      <p className="p-8 text-center text-text-muted font-bold italic border border-border-color bg-card-bg rounded-2xl">Aucun incident de bug trouvé selon les filtres.</p>
                    ) : (
                      filteredErrors.map((report) => (
                        <div
                          key={report.id}
                          onClick={() => setSelectedError(report)}
                          className={`p-4 border rounded-2xl cursor-pointer transition-all space-y-3.5 ${
                            selectedError && selectedError.id === report.id
                              ? 'bg-primary/5 border-primary shadow-sm'
                              : 'bg-card-bg border-border-color hover:border-primary/20'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono text-text-muted/60">{report.id} • {report.category}</span>
                              <h4 className="text-xs font-black text-text-main leading-snug">{report.title}</h4>
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                              report.severity === 'Critique' ? 'bg-red-500/10 text-red-600 border border-red-500/15 animate-pulse' :
                              report.severity === 'Élevée' ? 'bg-amber-500/10 text-amber-600' :
                              'bg-green-500/10 text-green-600'
                            }`}>
                              {report.severity}
                            </span>
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-border-color/60 text-[10px] font-semibold text-text-muted">
                            <span>De: <strong className="text-text-main">{report.user}</strong></span>
                            <div className="flex items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                report.status === 'Ouvert' ? 'bg-red-500' : report.status === 'En cours' ? 'bg-amber-500' : 'bg-emerald-500'
                              }`} />
                              <span className="uppercase font-black text-[9px]">{report.status}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Response area container */}
                <div className="space-y-3.5">
                  <h3 className="text-sm font-black text-text-main">Traitement & Réponses</h3>
                  
                  {selectedError ? (
                    <div className="p-5 bg-card-bg border border-border-color rounded-2xl space-y-4 shadow-sm">
                      <div className="pb-3 border-b border-border-color/60 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-mono text-text-muted">{selectedError.id}</span>
                          <h4 className="text-xs font-black text-text-main mt-0.5">{selectedError.title}</h4>
                        </div>
                        <button onClick={() => setSelectedError(null)} className="text-text-muted hover:text-red-500">✕</button>
                      </div>

                      {/* Info coordinates details */}
                      <div className="space-y-1.5 p-3 rounded-xl bg-bg-main border border-border-color text-[11px] font-semibold">
                        <p><span className="text-text-muted/65 uppercase text-[9px] block">Déclarant</span> {selectedError.user} ({selectedError.email})</p>
                        <p className="mt-1.5"><span className="text-text-muted/65 uppercase text-[9px] block">Page de l'incident</span> <code className="text-primary font-mono">{selectedError.page}</code></p>
                        <p className="mt-1.5"><span className="text-text-muted/65 uppercase text-[9px] block">Message initial</span> <span className="font-normal italic">"{selectedError.description}"</span></p>
                      </div>

                      {/* Conversation History thread */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-text-muted">Fil de discussion</span>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {selectedError.replies.map((reply, rid) => (
                            <div key={rid} className={`p-2 rounded-xl text-[10px] ${
                              reply.sender.startsWith('Admin') ? 'bg-primary/5 border border-primary/10 ml-4 text-text-main' : 'bg-bg-main border text-text-muted mr-4'
                            }`}>
                              <div className="flex justify-between items-center mb-1 font-bold">
                                <span>{reply.sender}</span>
                                <span className="opacity-60">{reply.time}</span>
                              </div>
                              <p className="font-medium">{reply.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Response form */}
                      <form onSubmit={handleSendReply} className="space-y-3 pt-3 border-t border-border-color">
                        {selectedError.status !== 'Résolu' ? (
                          <>
                            <textarea
                              rows="3"
                              required
                              value={adminReplyText}
                              onChange={(e) => setAdminReplyText(e.target.value)}
                              placeholder="Rédiger une réponse d'assistance officielle..."
                              className="w-full p-2.5 bg-bg-main border border-border-color rounded-xl text-xs font-medium outline-none focus:border-primary text-text-main resize-none"
                            />
                            
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleTicketStatus(selectedError.id, true)}
                                className="flex-1 py-2 border border-emerald-500/20 hover:bg-emerald-500/5 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                              >
                                <CheckCircle2 size={12} /> Fermer
                              </button>
                              
                              <button
                                type="submit"
                                className="flex-1 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-primary/10"
                              >
                                <Send size={11} /> Répondre
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <span className="text-xs text-green-600 font-extrabold flex items-center gap-1.5 bg-green-500/5 p-3.5 border border-green-500/10 rounded-xl justify-center">
                              ✓ ÉVÉNEMENT RÉSOLU ET CLÔTURÉ
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleTicketStatus(selectedError.id, false)}
                              className="w-full py-2 bg-bg-main border border-border-color hover:border-red-500/20 hover:text-red-500 rounded-xl text-[10px] font-black uppercase transition-all"
                            >
                              Réouvrir le ticket
                            </button>
                          </div>
                        )}
                      </form>
                    </div>
                  ) : (
                    <div className="p-10 border border-border-color bg-card-bg rounded-2xl text-center space-y-2 h-64 flex flex-col items-center justify-center">
                      <MessageSquare className="text-text-muted/40" size={36} />
                      <p className="text-xs text-text-muted font-bold leading-relaxed max-w-[200px]">Sélectionnez un ticket pour rédiger une solution ou modifier son statut de traitement.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* ================= SECTION 6: GLOBAL CONFIGURATIONS ================= */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <div className="p-6 bg-card-bg border border-border-color rounded-[1.5rem] space-y-6 shadow-sm">
                
                <h4 className="text-sm font-black text-text-main border-b border-border-color pb-2 flex items-center gap-2">
                  <Globe size={16} className="text-primary" />
                  Identité de la plate-forme
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider ml-1">Nom du site</label>
                    <input
                      type="text"
                      value={siteConfigs.siteName}
                      onChange={(e) => setSiteConfigs({ ...siteConfigs, siteName: e.target.value })}
                      className="w-full p-2.5 bg-bg-main border border-border-color rounded-xl outline-none focus:border-primary text-xs font-bold text-text-main"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider ml-1">E-mail de liaison</label>
                    <input
                      type="email"
                      value={siteConfigs.contactEmail}
                      onChange={(e) => setSiteConfigs({ ...siteConfigs, contactEmail: e.target.value })}
                      className="w-full p-2.5 bg-bg-main border border-border-color rounded-xl outline-none focus:border-primary text-xs font-bold text-text-main font-mono"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider ml-1">Description d'introduction (SEO)</label>
                    <textarea
                      rows="2"
                      value={siteConfigs.logoDesc}
                      onChange={(e) => setSiteConfigs({ ...siteConfigs, logoDesc: e.target.value })}
                      className="w-full p-2.5 bg-bg-main border border-border-color rounded-xl outline-none focus:border-primary text-xs font-semibold text-text-main resize-none"
                    />
                  </div>
                </div>

                <h4 className="text-sm font-black text-text-main border-b border-border-color pt-2 pb-2 flex items-center gap-2">
                  <Lock size={16} className="text-primary" />
                  Interruption & Sécurité administrative
                </h4>

                <div className="space-y-4">
                  {/* Maintenance block switch */}
                  <div className="p-4 bg-bg-main border border-border-color rounded-2xl flex items-center justify-between shadow-xs">
                    <div>
                      <span className="block text-xs font-black text-text-main">Mode interruption de maintenance</span>
                      <span className="block text-[10px] text-text-muted mt-0.5">Retirer l'accès aux réservations pour modifications de serveurs</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => triggerConfirmation(
                        'MAINTENANCE_TOGGLE',
                        siteConfigs.maintenanceMode ? "Désactiver la maintenance" : "Activer la maintenance : Urgent",
                        siteConfigs.maintenanceMode 
                          ? "Souhaitez-vous remettre la plateforme en ligne pour tous les patients et praticiens ?"
                          : "ATTENTION : Activer le mode maintenance déconnectera temporairement l'accès de consultation pour tous les patients.",
                        null
                      )}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 border cursor-pointer ${
                        siteConfigs.maintenanceMode
                          ? 'bg-red-500 text-white border-transparent'
                          : 'bg-primary/10 text-primary border-primary/20'
                      }`}
                    >
                      {siteConfigs.maintenanceMode ? '● ACTIVE' : '○ COPÉE'}
                    </button>
                  </div>

                  {/* Signup enabled switch */}
                  <div className="p-4 bg-bg-main border border-border-color rounded-2xl flex items-center justify-between shadow-xs">
                    <div>
                      <span className="block text-xs font-black text-text-main">Autoriser de nouvelles inscriptions</span>
                      <span className="block text-[10px] text-text-muted mt-0.5">Permettre aux nouveaux patients et praticiens de créer un profil</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSiteConfigs(prev => ({ ...prev, signupEnabled: !prev.signupEnabled }))}
                      className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 cursor-pointer ${
                        siteConfigs.signupEnabled ? 'bg-primary' : 'bg-border-color'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 transform ${
                        siteConfigs.signupEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      alert("Les configurations administratives ont été enregistrées avec succès dans la base de données.");
                    }}
                    className="t-btn-primary px-8"
                  >
                    Sauvegarder les configurations
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* ================= SECTION 7: SYSTEM LOGS & HEALTH ================= */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="t-card">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">Processeur API</span>
                  <p className="text-xl font-black text-text-main mt-1.5 font-mono">0.02% load</p>
                  <span className="text-[9px] text-green-500 mt-0.5 block">Statut optimal (Docker)</span>
                </div>
                <div className="t-card">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">Bande passante (WebRTC)</span>
                  <p className="text-xl font-black text-text-main mt-1.5 font-mono">1.4 MB/s</p>
                  <span className="text-[9px] text-text-muted/60 mt-0.5 block">2 sessions actives</span>
                </div>
                <div className="t-card">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">Bases de données</span>
                  <p className="text-xl font-black text-text-main mt-1.5 font-mono">Prisma Online</p>
                  <span className="text-[9px] text-green-500 mt-0.5 block">Latence: 4ms d'écriture</span>
                </div>
              </div>

              {/* Core System alerts history */}
              <div className="t-card space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-black text-text-main">Logs d'Alerte de Sécurité et Système</h4>
                  <span className="text-[9px] font-black text-red-500 bg-red-500/10 px-2.5 py-0.5 rounded border border-red-500/15">98.9% UPTIME</span>
                </div>

                <div className="p-4 bg-black font-mono text-[11px] text-green-400 rounded-2xl space-y-2 overflow-x-auto select-all max-h-80">
                  <p className="text-gray-500">// console_output starting process</p>
                  <p className="text-yellow-400">WARNING: 2026-05-27 18:25:12 - IP blocks 197.200.41.3 blocked on route /api/auth/login due to rate limits.</p>
                  <p>INFO: 2026-05-27 18:00:00 - CronJob "reminder-mail" booted up under process pid=204.</p>
                  <p>INFO: 2026-05-27 18:00:00 - Successfully queued and transmitted 142 notification messages.</p>
                  <p>DB_SYNC: 2026-05-27 17:30:45 - Backup dump database "tassarut_backup_v14.sql" completed inside cloud storage bucket.</p>
                  <p className="text-red-400">ERROR: 2026-05-27 16:12:10 - MOBILIS API failed to send SMS to profile Patient Sonia Benali (gateway response 504 Gateway Timeout).</p>
                  <p>INFO: 2026-05-27 15:44:11 - Server restarted successfully. Environment: PRODUCTION, Node v22.14.0.</p>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* --- REUSABLE INTERACTIVE CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-bg w-full max-w-sm border border-border-color rounded-[1.5rem] shadow-2xl p-6 space-y-4 text-center"
            >
              <div className="w-12 h-12 bg-red-500/10 text-red-550 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                <AlertCircle size={22} className="text-red-500" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-extrabold text-sm text-text-main leading-snug">{confirmModal.title}</h3>
                <p className="text-[11px] text-text-muted font-medium leading-relaxed">{confirmModal.message}</p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2.5 bg-bg-main border border-border-color hover:border-text-muted/30 text-text-muted rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={executeConfirmedAction}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-red-550/15"
                >
                  Confirmer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
