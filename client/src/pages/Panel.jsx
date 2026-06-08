import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Users, FileCheck, AlertTriangle, Settings,
  Search, Check, X, AlertCircle, Eye,
  Send, Activity, ShieldAlert, LogOut, CheckCircle2, UserCheck,
  MessageSquare, AlertOctagon,
  FileText, Globe,
  Lock, RefreshCw, Loader2
} from 'lucide-react';
import LeafKeyIcon from '../components/LeafKeyIcon';
import { apiCall, auth as authApi } from '../services/api';
import { useAuth } from '../auth/AuthContext';

// Helper to generate IDs for optimistic updates
const generateLocalId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ---------------------------------------------------------------------------
// Auth helpers (logout)
// ---------------------------------------------------------------------------
// The original handler only called `onNavigateToPage('LOGIN')`, which left
// the JWT in localStorage AND the cached AuthContext user untouched. On the
// very next render App.jsx's redirect-on-mount effect would see
// `isAuthenticated === true` and slam the user back onto the admin
// dashboard — a textbook session-leak.
//
// The new flow:
//   1. Tell the server to delete the Session row (`authApi.logout`).
//      Best-effort: if it fails (e.g. 401 because the token is already
//      gone), we still proceed with the local cleanup.
//   2. Wipe ALL auth-related storage keys — `token`, the cached
//      `tassarut:user` blob, and the theme/config keys we own, so a
//      stale "remembered" admin can't come back through a hidden tab.
//   3. `useAuth().logout()` resets the global AuthContext state (user ->
//      null) which causes App.jsx to drop the ProtectedRoute guard and
//      render the login page.
//   4. Only THEN do we navigate, so React's tree is already in the
//      "logged out" state when the LOGIN view mounts.
const clearAuthStorage = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('tassarut:user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('tassarut:user');
  localStorage.removeItem('tassarut_admin_configs');
  localStorage.removeItem('tassarut_admin_errors');
};

// Human-readable label for a verificationStatus value.
const verificationLabel = (status) => {
  if (status === 'verified') return { text: 'Validé', classes: 'bg-green-500/10 text-green-600' };
  if (status === 'rejected') return { text: 'Rejeté', classes: 'bg-red-500/10 text-red-600' };
  if (status === 'pending') return { text: 'En attente', classes: 'bg-amber-500/10 text-amber-600' };
  return null;
};

// Format a file size in human-readable units.
const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

// Render a single document block (image preview / PDF iframe / generic file).
const renderDocumentPreview = (doc) => {
  if (!doc) return null;
  const { mimeType, originalName, url, downloadUrl, fileSize } = doc;
  const safeName = originalName || 'document';

  if (mimeType && mimeType.startsWith('image/') && url) {
    return (
      <a
        href={downloadUrl || url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        title={`Ouvrir ${safeName} dans un nouvel onglet`}
      >
        <img
          src={url}
          alt={safeName}
          className="w-full max-h-56 object-contain bg-bg-main border border-border-color rounded-xl"
        />
      </a>
    );
  }

  if (mimeType === 'application/pdf' && url) {
    return (
      <iframe
        title={safeName}
        src={url}
        className="w-full h-56 bg-bg-main border border-border-color rounded-xl"
      />
    );
  }

  // Generic file — no inline preview possible. Show a download CTA.
  return (
    <div className="p-3 bg-bg-main border border-border-color rounded-xl flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-black text-text-main truncate">{safeName}</div>
        <div className="text-[10px] text-text-muted font-mono">
          {mimeType || 'type inconnu'} · {formatFileSize(fileSize)}
        </div>
      </div>
      {downloadUrl ? (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-primary text-white shrink-0"
        >
          Télécharger
        </a>
      ) : (
        <span className="text-[10px] text-text-muted italic">URL signée indisponible</span>
      )}
    </div>
  );
};

export default function Panel({ onNavigateToPage }) {
  // --- GLOBAL AUTH CONTEXT ------------------------------------------------
  const { logout: authLogout } = useAuth();

  // --- NAV & SECTION STATES ---
  const [activeTab, setActiveTab] = useState('dashboard');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- REAL DATA FROM API ---
  const [usersList, setUsersList] = useState([]);
  const [therapistsList, setTherapistsList] = useState([]);
  const [errorReportsList, setErrorReportsList] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- VERIFICATION DETAILS ------------------------------------------------
  const [verificationDetails, setVerificationDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

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

  // Load all admin data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, usersRes, pendingRes, logsRes] = await Promise.all([
          apiCall('/admin/stats', { method: 'GET' }),
          apiCall('/admin/users?limit=50', { method: 'GET' }),
          apiCall('/admin/therapists/pending', { method: 'GET' }),
          apiCall('/admin/audit-logs?limit=10', { method: 'GET' }),
        ]);

        const storedErrors = localStorage.getItem('tassarut_admin_errors');
        const errors = storedErrors ? JSON.parse(storedErrors) : [];

        setStats(statsRes.data);
        setUsersList(usersRes.data || []);
        setTherapistsList([...(pendingRes.data || [])]);
        setErrorReportsList(errors);
        setSystemLogs(logsRes.data || []);
      } catch (err) {
        setError(err.message || 'Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Also fetch all therapists for the validation history
  useEffect(() => {
    const loadAllTherapists = async () => {
      try {
        const res = await apiCall('/admin/therapists?limit=100', { method: 'GET' });
        if (res.data) {
          setTherapistsList(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const newOnes = (res.data || []).filter(t => !existingIds.has(t.id));
            return [...prev, ...newOnes];
          });
        }
      } catch (e) {
        // Non-critical
      }
    };
    loadAllTherapists();
  }, []);

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

  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('ALL');
  const [usersStatusFilter, setUsersStatusFilter] = useState('ALL');

  const [errorsSearch, setErrorsSearch] = useState('');
  const [errorsCategoryFilter, setErrorsCategoryFilter] = useState('ALL');
  const [errorsStatusFilter, setErrorsStatusFilter] = useState('ALL');

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    actionType: "",
    targetId: null,
    extraData: null
  });

  const [adminReplyText, setAdminReplyText] = useState('');

  // FIX (issue #3): when the admin clicks a pending request, fetch full
  // verification details (User + profile + SIGNED document URLs).
  useEffect(() => {
    if (!selectedTherapist || !selectedTherapist.id) {
      setVerificationDetails(null);
      return;
    }
    let cancelled = false;
    setLoadingDetails(true);
    apiCall(`/admin/therapists/${selectedTherapist.id}/verification-details`, { method: 'GET' })
      .then((res) => {
        if (cancelled) return;
        setVerificationDetails(res?.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[Panel] failed to load verification details', err);
        setVerificationDetails(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTherapist]);

  // FIX (issue #2): prefer server-computed counts from /admin/stats.
  const kpis = {
    totalUsers: stats?.totalUsers ?? usersList.length,
    activeToday: usersList.length,
    pendingTherapists:
      stats?.pendingTherapists
      ?? therapistsList.filter(t => t.verificationStatus === 'pending').length,
    openTickets: errorReportsList.filter(e => e.status === 'Ouvert' || e.status === 'En cours').length,
    criticalTickets: errorReportsList.filter(e => e.severity === 'Critique' || e.severity === 'Élevée').length,
    validatedTherapists:
      stats?.verifiedTherapists
      ?? therapistsList.filter(t => t.verificationStatus === 'verified').length,
    rejectedTherapists:
      stats?.rejectedTherapists
      ?? therapistsList.filter(t => t.verificationStatus === 'rejected').length,
    maintenanceStatus: siteConfigs.maintenanceMode ? "Actif" : "Inactif"
  };

  // FIX (issue #1): the new logout sequence.
  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[Panel] server logout failed (continuing local cleanup):', e?.message);
    }
    clearAuthStorage();
    try {
      await authLogout();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[Panel] auth context logout failed:', e?.message);
    }
    onNavigateToPage('LOGIN');
  }, [authLogout, onNavigateToPage]);

  const handleRefreshStats = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      const newLog = {
        id: generateLocalId(),
        type: "system",
        text: "Rafraîchissement manuel des paramètres accompli : Statut OK.",
        time: new Date().toLocaleTimeString('fr-FR'),
        status: "success"
      };
      setSystemLogs(prev => [newLog, ...prev]);
    }, 800);
  };

  const triggerConfirmation = (actionType, title, message, targetId, extraData = null) => {
    setConfirmModal({ isOpen: true, title, message, actionType, targetId, extraData });
  };

  const executeConfirmedAction = async () => {
    const { actionType, targetId } = confirmModal;

    if (actionType === 'MAINTENANCE_TOGGLE') {
      setSiteConfigs(prev => ({ ...prev, maintenanceMode: !prev.maintenanceMode }));
      const log = {
        id: generateLocalId(),
        type: "system",
        text: `Mode maintenance modifié par l'administrateur: ${!siteConfigs.maintenanceMode ? 'Activé' : 'Désactivé'}`,
        time: new Date().toLocaleTimeString('fr-FR'),
        status: !siteConfigs.maintenanceMode ? "warning" : "success"
      };
      setSystemLogs(prev => [log, ...prev]);
    }

    else if (actionType === 'BANN') {
      try {
        await apiCall(`/admin/users/${targetId}/ban`, { method: 'PUT' });
        setUsersList(prev => prev.map(u => u.id === targetId ? { ...u, banned: true, status: 'Banni' } : u));
        if (selectedUser && selectedUser.id === targetId) {
          setSelectedUser(prev => ({ ...prev, banned: true, status: "Banni" }));
        }
      } catch (err) {
        console.error('Failed to ban user:', err);
      }
    }

    else if (actionType === 'UNBANN') {
      try {
        await apiCall(`/admin/users/${targetId}/reactivate`, { method: 'PUT' });
        setUsersList(prev => prev.map(u => u.id === targetId ? { ...u, banned: false, status: 'Actif' } : u));
        if (selectedUser && selectedUser.id === targetId) {
          setSelectedUser(prev => ({ ...prev, banned: false, status: "Actif" }));
        }
      } catch (err) {
        console.error('Failed to reactivate user:', err);
      }
    }

    else if (actionType === 'APPROVE_THERAPIST') {
      try {
        await apiCall(`/admin/therapists/${targetId}/verify`, { method: 'PUT' });
        setTherapistsList(prev => prev.map(t => t.id === targetId ? { ...t, verificationStatus: 'verified' } : t));
        const therapistObj = therapistsList.find(t => t.id === targetId);
        if (therapistObj) {
          const alreadyInUsers = usersList.some(u => u.email === therapistObj.email);
          if (!alreadyInUsers) {
            setUsersList(prev => [...prev, {
              id: generateLocalId(),
              name: therapistObj.name,
              email: therapistObj.email,
              role: 'THERAPIST',
              status: 'Active',
              joined: new Date().toISOString().split('T')[0],
              lastActive: "À l'instant"
            }]);
          }
        }
        const log = {
          id: generateLocalId(),
          type: "system",
          text: `Compte vérifié validé avec succès : ${therapistObj?.name || 'Thérapeute'}`,
          time: new Date().toLocaleTimeString('fr-FR'),
          status: "success"
        };
        setSystemLogs(prev => [log, ...prev]);
      } catch (err) {
        console.error('Failed to approve therapist:', err);
      }
      setSelectedTherapist(null);
      setVerificationDetails(null);
    }

    else if (actionType === 'REJECT_THERAPIST') {
      try {
        const therapistObj = therapistsList.find(t => t.id === targetId);
        await apiCall(`/admin/therapists/${targetId}/reject`, {
          method: 'PUT',
          body: JSON.stringify({ reason: 'Documents non conformes' }),
        });
        setTherapistsList(prev => prev.map(t => t.id === targetId ? { ...t, verificationStatus: 'rejected' } : t));
        setUsersList(prev => prev.map(u => u.email === therapistObj?.email ? { ...u, status: 'Suspended' } : u));

        const log = {
          id: generateLocalId(),
          type: "security",
          text: `Dossier de praticien rejeté : ${therapistObj?.name || 'Thérapeute'} (Raison: documents non conformes)`,
          time: new Date().toLocaleTimeString('fr-FR'),
          status: "blocked"
        };
        setSystemLogs(prev => [log, ...prev]);
      } catch (err) {
        console.error('Failed to reject therapist:', err);
      }
      setSelectedTherapist(null);
      setVerificationDetails(null);
    }

    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  // --- SUPPORT RESPONSE ACTIONS ---
  const handleSendReply = (e) => {
    e.preventDefault();
    if (!adminReplyText.trim()) return;

    setErrorReportsList(prev => prev.map(item => {
      if (item.id === selectedError.id) {
        const updatedReplies = [...item.replies];
        if (adminReplyText.trim()) {
          updatedReplies.push({ sender: "Admin (Karim)", text: adminReplyText, time: "À l'instant" });
        }
        return { ...item, replies: updatedReplies, status: "En cours" };
      }
      return item;
    }));

    setSelectedError(prev => {
      const updatedReplies = [...prev.replies];
      if (adminReplyText.trim()) {
        updatedReplies.push({ sender: "Admin (Karim)", text: adminReplyText, time: "À l'instant" });
      }
      return { ...prev, replies: updatedReplies, status: "En cours" };
    });

    setAdminReplyText('');
  };

  const handleToggleTicketStatus = (ticketId, isResolved) => {
    const nextStatus = isResolved ? "Résolu" : "Ouvert";
    setErrorReportsList(prev => prev.map(item => item.id === ticketId ? { ...item, status: nextStatus } : item));
    if (selectedError && selectedError.id === ticketId) {
      setSelectedError(prev => ({ ...prev, status: nextStatus }));
    }
    const log = {
      id: generateLocalId(),
      type: "system",
      text: `Ticket support ${ticketId} marqué comme ${nextStatus.toUpperCase()}`,
      time: new Date().toLocaleTimeString('fr-FR'),
      status: isResolved ? "success" : "warning"
    };
    setSystemLogs(prev => [log, ...prev]);
  };

  // --- FILTERS APPLIED ---
  // FIX (issue #4): the user list now respects therapist verificationStatus.
  const filteredUsers = usersList.filter(user => {
    const matchesSearch = (user.name || '').toLowerCase().includes(usersSearch.toLowerCase()) ||
                          (user.email || '').toLowerCase().includes(usersSearch.toLowerCase());
    const matchesRole = usersRoleFilter === 'ALL' || (user.role || '').toUpperCase() === usersRoleFilter;
    const renderedStatus = (() => {
      if (user.role === 'THERAPIST' && user.verificationStatus) {
        const v = verificationLabel(user.verificationStatus);
        if (v) return v.text;
      }
      return user.status || 'Active';
    })();
    const matchesStatus = usersStatusFilter === 'ALL' || renderedStatus === usersStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredErrors = errorReportsList.filter(report => {
    const matchesSearch = (report.title || '').toLowerCase().includes(errorsSearch.toLowerCase()) ||
                          (report.user || '').toLowerCase().includes(errorsSearch.toLowerCase()) ||
                          (report.id || '').toLowerCase().includes(errorsSearch.toLowerCase());
    const matchesCat = errorsCategoryFilter === 'ALL' || report.category === errorsCategoryFilter;
    const matchesStatus = errorsStatusFilter === 'ALL' || report.status === errorsStatusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main text-text-main font-sans flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-text-muted font-medium">Chargement de la console d'administration...</p>
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
    <div className="min-h-screen bg-bg-main text-text-main font-sans selection:bg-primary-light flex flex-col md:flex-row">

      {/* --- SIDEBAR --- */}
      <aside className="w-full md:w-64 bg-card-bg border-b md:border-b-0 md:border-r border-border-color shrink-0 flex flex-col justify-between">
        <div>
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
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>

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
                    setVerificationDetails(null);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    isActive ? 'bg-primary text-white font-bold shadow-md shadow-primary/20' : 'text-text-muted hover:bg-bg-main hover:text-text-main'
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

        <div className="p-4 border-t border-border-color">
          {/* FIX (issue #1): wired to handleLogout which clears storage + context + navigates */}
          <button
            onClick={handleLogout}
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
              {activeTab === 'dashboard' && "Vue d'ensemble du système"}
              {activeTab === 'users' && 'Directory des Comptes & Rôles'}
              {activeTab === 'validations' && 'Modération & Validation Praticiens'}
              {activeTab === 'errors' && 'Centre de Résolution des Erreurs'}
              {activeTab === 'settings' && "Paramètres de l'Application"}
              {activeTab === 'system' && "Infrastructure & Journaux d'Événements"}
            </h2>
          </div>

          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
            <button
              onClick={handleRefreshStats}
              className={`p-2.5 border border-border-color hover:border-text-muted/30 hover:bg-bg-main text-text-muted rounded-xl transition-all cursor-pointer bg-card-bg flex items-center gap-1.5 text-xs font-semibold ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Rafraîchir</span>
            </button>

            <div className="p-1 px-3.5 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
              <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
              Serveur OK
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-8 scrollbar-hide">

          {/* ================= SECTION 1: DASHBOARD ================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {siteConfigs.maintenanceMode && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-start gap-3 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="shrink-0 mt-0.5 text-amber-500" size={18} />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide">Mode Maintenance Actif</h4>
                    <p className="text-[11px] font-medium leading-relaxed mt-0.5">La plateforme de téléconsultation n'accepte actuellement plus de nouvelles sessions.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="t-card">
                  <div className="flex items-center justify-between text-text-muted">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Membres totaux</span>
                    <Users size={16} />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-text-main">{kpis.totalUsers}</span>
                    <span className="text-[10px] font-extrabold text-green-500 font-mono">+{stats?.monthlyAppointments || 0}%</span>
                  </div>
                  <span className="text-[9px] font-semibold text-text-muted/65 mt-1 block">Inscrits cette semaine</span>
                </div>

                <div className="t-card">
                  <div className="flex items-center justify-between text-text-muted">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Praticiens Validés</span>
                    <UserCheck size={16} />
                  </div>
                  {/* FIX (issue #2): renders the server-computed verifiedTherapists count */}
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

              <div className="t-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-text-main">Événements en cours d'exécution</h4>
                    <p className="text-[10px] text-text-muted mt-0.5">Enregistrements en temps réel de l'activité utilisateur et serveur</p>
                  </div>
                </div>

                <div className="division overflow-hidden border border-border-color rounded-2xl">
                  {systemLogs.length === 0 ? (
                    <div className="p-6 text-center text-text-muted text-xs">Aucun log pour le moment.</div>
                  ) : (
                    systemLogs.slice(0, 10).map((log) => (
                      <div key={log.id} className="p-3.5 bg-card-bg even:bg-bg-main border-b border-border-color last:border-b-0 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {log.type === "security" && (
                            <span className="p-1.5 bg-red-500/10 text-red-500 rounded-lg shrink-0">
                              <AlertOctagon size={14} />
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
                            {log.text || log.action || 'No details'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[9px] text-text-muted/60 shrink-0">
                          <span className="opacity-40">UTC</span>
                          <span>{log.createdAt ? new Date(log.createdAt).toLocaleTimeString('fr-FR') : log.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}


          {/* ================= SECTION 2: USERS ================= */}
          {activeTab === 'users' && (
            <div className="space-y-6">
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
                          usersRoleFilter === roleOpt ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        {roleOpt === 'ALL' ? 'Tous' : roleOpt === 'PATIENT' ? 'Patients' : 'Thérapeutes'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-card-bg border border-border-color rounded-[1.5rem] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-bg-main border-b border-border-color text-[10px] font-extrabold uppercase tracking-wider text-text-muted/60">
                        <th className="p-4 pl-6">Nom</th>
                        <th className="p-4">E-mail</th>
                        <th className="p-4">Rôle</th>
                        <th className="p-4">Créé le</th>
                        <th className="p-4">Statut</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color/60 text-xs">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-text-muted font-medium italic">
                            Aucun utilisateur ne correspond aux critères.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => {
                          // FIX (issue #4): explicit verification status for therapists
                          const vLabel = user.role === 'THERAPIST' && user.verificationStatus
                            ? verificationLabel(user.verificationStatus)
                            : null;
                          const cellClasses = vLabel
                            ? vLabel.classes
                            : user.banned
                              ? 'bg-red-500/10 text-red-600'
                              : (user.status === 'Active' || !user.status ? 'bg-green-500/10 text-green-600'
                                : user.status === 'Suspended' ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-red-500/10 text-red-600');
                          const cellText = vLabel ? vLabel.text : (user.banned ? 'Banni' : (user.status || 'Active'));

                          return (
                            <tr key={user.id} className="hover:bg-primary/[0.01] transition-all">
                              <td className="p-4 pl-6 font-bold text-text-main flex items-center gap-2.5">
                                <span className={`w-2.5 h-2.5 rounded-full ${user.role === 'THERAPIST' ? 'bg-primary' : 'bg-emerald-500'}`} />
                                {user.name}
                              </td>
                              <td className="p-4 text-text-muted font-mono">{user.email}</td>
                              <td className="p-4">
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border ${
                                  user.role === 'THERAPIST' ? 'text-primary bg-primary/5 border-primary/10' : 'text-emerald-600 bg-emerald-500/5 border-emerald-500/10'
                                }`}>
                                  {user.role === 'THERAPIST' ? 'PRATICIEN' : 'PATIENT'}
                                </span>
                              </td>
                              <td className="p-4 text-text-muted font-mono">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '—'}
                              </td>
                              <td className="p-4">
                                {/* FIX (issue #4): explicit verification tag for pending/rejected therapists */}
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${cellClasses}`}>
                                  {cellText}
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
                                {user.banned ? (
                                  <button
                                    onClick={() => triggerConfirmation('UNBANN', "Réactiver l'utilisateur", `Souhaitez-vous lever le bannissement de ${user.name} ?`, user.id)}
                                    className="p-1.5 bg-green-500/5 hover:bg-green-500/10 text-green-600 rounded-lg border border-green-500/15 transition-all text-[10px] font-extrabold cursor-pointer"
                                  >
                                    Réactiver
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => triggerConfirmation('BANN', 'Suspendre / Bannir', `Êtes-vous sûr de vouloir bloquer l'accès de ${user.name} ?`, user.id)}
                                    className="p-1.5 bg-red-500/5 hover:bg-red-500/10 text-red-600 rounded-lg border border-red-500/15 transition-all text-[10px] font-extrabold cursor-pointer"
                                  >
                                    Bannir
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-card-bg w-full max-w-md border border-border-color rounded-[1.5rem] shadow-2xl p-6 space-y-5">
                    <div className="flex justify-between items-center">
                      <h3 className="font-black text-sm text-text-main">Fiche Utilisateur</h3>
                      <button onClick={() => setSelectedUser(null)} className="text-text-muted hover:text-red-500 cursor-pointer">✕</button>
                    </div>
                    <div className="flex gap-3.5 items-center p-4 bg-bg-main border border-border-color rounded-2xl">
                      <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black">
                        {(selectedUser.name || '').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="block text-xs font-black text-text-main">{selectedUser.name}</span>
                        <span className="block text-[10px] text-text-muted font-mono">{selectedUser.email}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                      <div className="p-3 bg-bg-main rounded-xl border border-border-color">
                        <span className="block text-[8px] font-extrabold uppercase text-text-muted">Rôle</span>
                        <span className="block mt-0.5 text-text-main">{selectedUser.role}</span>
                      </div>
                      <div className="p-3 bg-bg-main rounded-xl border border-border-color">
                        <span className="block text-[8px] font-extrabold uppercase text-text-muted">Inscrit depuis</span>
                        <span className="block mt-0.5 text-text-main font-mono">
                          {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </span>
                      </div>
                      <div className="p-3 bg-bg-main rounded-xl border border-border-color">
                        <span className="block text-[8px] font-extrabold uppercase text-text-muted">Vérification</span>
                        <span className="block mt-0.5 text-text-main font-bold">
                          {selectedUser.role === 'THERAPIST' && selectedUser.verificationStatus
                            ? (verificationLabel(selectedUser.verificationStatus)?.text || selectedUser.verificationStatus)
                            : '—'}
                        </span>
                      </div>
                      <div className="p-3 bg-bg-main rounded-xl border border-border-color">
                        <span className="block text-[8px] font-extrabold uppercase text-text-muted">Statut Compte</span>
                        <span className="block mt-0.5 text-text-main font-bold">{selectedUser.status || 'Active'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedUser(null)}
                        className="flex-1 py-2.5 bg-bg-main border border-border-color hover:border-primary/40 rounded-xl text-xs font-bold text-text-muted hover:text-primary transition-all cursor-pointer"
                      >
                        Fermer la Fiche
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* ================= SECTION 3: THERAPIST VALIDATION ================= */}
          {activeTab === 'validations' && (
            <div className="space-y-6">
              <div className="p-4 bg-primary-light/50 dark:bg-primary-light/10 border border-primary/20 rounded-2xl flex items-start gap-3.5">
                <AlertCircle className="text-primary shrink-0 mt-0.5" size={18} />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black uppercase tracking-wide text-primary">Processus d'homologation légale obligatoire</h4>
                  <p className="text-[11px] font-semibold text-text-muted leading-relaxed">Chaque praticien inscrit sur Tassarut doit impérativement charger un scan lisible de son diplôme clinique national.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3.5">
                  <h3 className="text-sm font-black text-text-main">Attributions en attente ({therapistsList.filter(t => t.verificationStatus === 'pending').length})</h3>

                  {therapistsList.filter(t => t.verificationStatus === 'pending').length === 0 ? (
                    <div className="p-8 bg-card-bg border border-border-color rounded-2xl text-center space-y-2">
                      <CheckCircle2 className="text-emerald-500 mx-auto" size={32} />
                      <p className="text-xs font-black text-text-main uppercase">Tous les dossiers sont validés</p>
                      <p className="text-[10px] text-text-muted">Aucune demande d'inscription en attente.</p>
                    </div>
                  ) : (
                    therapistsList.filter(t => t.verificationStatus === 'pending').map((req) => (
                      <div
                        key={req.id}
                        onClick={() => setSelectedTherapist(req)}
                        className={`p-4 border rounded-2xl cursor-pointer transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                          selectedTherapist && selectedTherapist.id === req.id ? 'bg-primary/5 border-primary shadow-md shadow-primary/5' : 'bg-card-bg border-border-color hover:border-primary/30'
                        }`}
                      >
                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-text-main">{req.user?.name || req.name}</h4>
                          <span className="block text-[10px] text-text-muted font-mono">{req.user?.email || req.email || 'Email non disponible'}</span>
                          <span className="text-[9px] text-primary font-extrabold uppercase tracking-widest">{req.approcheTherapeute || 'Non spécifié'}</span>
                        </div>
                        <div className="flex items-center gap-3.5 self-end sm:self-auto">
                          <div className="text-right hidden sm:block">
                            <span className="block text-[8px] font-black uppercase text-text-muted">Envoyé le</span>
                            <span className="block text-[10px] font-bold text-text-main font-mono mt-0.5">
                              {req.createdAt ? new Date(req.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                            </span>
                          </div>
                          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/15 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0">
                            En Attente
                          </span>
                        </div>
                      </div>
                    ))
                  )}

                  <div className="pt-4 space-y-2">
                    <h3 className="text-xs font-black text-text-muted uppercase tracking-widest">Demandes arbitrées récemment</h3>
                    <div className="border border-border-color rounded-2xl overflow-hidden bg-card-bg">
                      {therapistsList.filter(t => t.verificationStatus !== 'pending').length === 0 ? (
                        <div className="p-4 text-center text-text-muted text-xs">Aucun dossier arbitré.</div>
                      ) : (
                        therapistsList.filter(t => t.verificationStatus !== 'pending').slice(0, 5).map(t => (
                          <div key={t.id} className="p-3 bg-card-bg border-b border-border-color last:border-0 flex justify-between items-center text-xs">
                            <div>
                              <span className="font-extrabold text-text-main">{t.user?.name || t.name}</span>
                              <span className="text-[10px] text-text-muted font-mono ml-2">({t.email || 'N/A'})</span>
                            </div>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                              t.verificationStatus === 'verified' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                            }`}>
                              {t.verificationStatus === 'verified' ? 'Validé' : 'Refusé'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <h3 className="text-sm font-black text-text-main">Examen du Dossier</h3>

                  {selectedTherapist ? (
                    <div className="p-5 bg-card-bg border border-border-color rounded-2xl space-y-5 shadow-sm">
                      <div className="pb-3.5 border-b border-border-color/60">
                        <span className="text-[9px] font-extrabold text-primary uppercase tracking-widest">
                          {(verificationDetails?.approcheTherapeute) || selectedTherapist.approcheTherapeute || 'Non spécifié'}
                        </span>
                        <h4 className="text-sm font-black text-text-main">
                          {verificationDetails?.user?.name || selectedTherapist.user?.name || selectedTherapist.name}
                        </h4>
                        {verificationDetails?.user?.email && (
                          <span className="block text-[10px] text-text-muted font-mono mt-0.5">
                            {verificationDetails.user.email}
                          </span>
                        )}
                      </div>

                      {/* FIX (issue #3): documents section. Uses
                          `verificationDetails.documents` (signed URLs from
                          backend) when present, otherwise falls back to
                          `selectedTherapist.documents` (signed URLs from
                          the list endpoint). When neither has documents
                          we show a friendly empty state. */}
                      <div className="space-y-2.5">
                        <span className="text-[9px] font-extrabold text-text-muted uppercase tracking-widest block">
                          Documents ({(verificationDetails?.documents || selectedTherapist.documents || []).length})
                        </span>
                        {loadingDetails ? (
                          <div className="p-3 bg-bg-main border border-border-color rounded-xl text-xs text-center text-text-muted flex items-center justify-center gap-2">
                            <Loader2 size={12} className="animate-spin" />
                            Chargement des documents...
                          </div>
                        ) : (() => {
                          const docs = verificationDetails?.documents || selectedTherapist.documents || [];
                          if (docs.length === 0) {
                            return (
                              <div className="p-3 bg-bg-main border border-border-color rounded-xl text-xs text-center text-text-muted">
                                Aucun document n'a été soumis pour ce dossier.
                              </div>
                            );
                          }
                          return (
                            <div className="space-y-2.5">
                              {docs.map((doc) => (
                                <div key={doc.id} className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-text-muted">
                                    <span className="truncate" title={doc.originalName}>{doc.originalName}</span>
                                    <span>{formatFileSize(doc.fileSize)}</span>
                                  </div>
                                  {renderDocumentPreview(doc)}
                                </div>
                              ))}
                              {docs[0]?.expiresAt && (
                                <div className="text-[9px] text-text-muted/65 italic">
                                  Les liens signés expirent le {new Date(docs[0].expiresAt).toLocaleString('fr-FR')}.
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-3.5 border-t border-border-color">
                        <button
                          onClick={() => triggerConfirmation(
                            'REJECT_THERAPIST',
                            "Rejeter l'inscription du Praticien",
                            `Souhaitez-vous rejeter le dossier de ${selectedTherapist.user?.name || selectedTherapist.name} ?`,
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
                            `Confirmez-vous que les documents de ${selectedTherapist.user?.name || selectedTherapist.name} sont authentiques ?`,
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
                      <p className="text-xs text-text-muted font-bold leading-relaxed max-w-[200px]">Sélectionnez une demande dans la liste pour examiner ses documents.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}


          {/* ================= SECTION 4: ERRORS ================= */}
          {activeTab === 'errors' && (
            <div className="space-y-6">
              <div className="p-4 bg-card-bg border border-border-color rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted/50" size={16} />
                  <input
                    type="text"
                    value={errorsSearch}
                    onChange={(e) => setErrorsSearch(e.target.value)}
                    placeholder="Chercher par ticket ou utilisateur..."
                    className="w-full pl-10 pr-4 py-2.5 bg-bg-main border border-border-color rounded-xl text-xs font-semibold outline-none focus:border-primary text-text-main"
                  />
                </div>

                <div className="flex gap-2.5 w-full md:w-auto self-stretch md:self-auto justify-end">
                  <select
                    value={errorsCategoryFilter}
                    onChange={(e) => setErrorsCategoryFilter(e.target.value)}
                    className="px-3.5 py-2.5 bg-bg-main border border-border-color rounded-xl text-[11px] font-black text-text-muted cursor-pointer"
                  >
                    <option value="ALL">Toutes Catégories</option>
                    <option value="Paiement">Paiement</option>
                    <option value="Consultation Vidéo">Consultation Vidéo</option>
                    <option value="Contenu / UI">Contenu / UI</option>
                  </select>

                  <select
                    value={errorsStatusFilter}
                    onChange={(e) => setErrorsStatusFilter(e.target.value)}
                    className="px-3.5 py-2.5 bg-bg-main border border-border-color rounded-xl text-[11px] font-black text-text-muted cursor-pointer"
                  >
                    <option value="ALL">Tous les statuts</option>
                    <option value="Ouvert">Ouverts</option>
                    <option value="En cours">En cours</option>
                    <option value="Résolu">Résolus</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3.5">
                  <h3 className="text-sm font-black text-text-main">Tickets ({filteredErrors.length})</h3>

                  <div className="space-y-3">
                    {filteredErrors.length === 0 ? (
                      <p className="p-8 text-center text-text-muted font-bold italic border border-border-color bg-card-bg rounded-2xl">Aucun ticket trouvé.</p>
                    ) : (
                      filteredErrors.map((report) => (
                        <div
                          key={report.id}
                          onClick={() => setSelectedError(report)}
                          className={`p-4 border rounded-2xl cursor-pointer transition-all space-y-3.5 ${
                            selectedError && selectedError.id === report.id ? 'bg-primary/5 border-primary shadow-sm' : 'bg-card-bg border-border-color hover:border-primary/20'
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

                <div className="space-y-3.5">
                  <h3 className="text-sm font-black text-text-main">Traitement</h3>

                  {selectedError ? (
                    <div className="p-5 bg-card-bg border border-border-color rounded-2xl space-y-4 shadow-sm">
                      <div className="pb-3 border-b border-border-color/60 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-mono text-text-muted">{selectedError.id}</span>
                          <h4 className="text-xs font-black text-text-main mt-0.5">{selectedError.title}</h4>
                        </div>
                        <button onClick={() => setSelectedError(null)} className="text-text-muted hover:text-red-500">✕</button>
                      </div>

                      <div className="space-y-1.5 p-3 rounded-xl bg-bg-main border border-border-color text-[11px] font-semibold">
                        <p><span className="text-text-muted/65 uppercase text-[9px] block">Déclarant</span> {selectedError.user} ({selectedError.email})</p>
                        <p className="mt-1.5"><span className="text-text-muted/65 uppercase text-[9px] block">Message</span> <span className="font-normal italic">"{selectedError.description}"</span></p>
                      </div>

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

                      <form onSubmit={handleSendReply} className="space-y-3 pt-3 border-t border-border-color">
                        {selectedError.status !== 'Résolu' ? (
                          <>
                            <textarea
                              rows="3"
                              required
                              value={adminReplyText}
                              onChange={(e) => setAdminReplyText(e.target.value)}
                              placeholder="Rédiger une réponse..."
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
                              ✓ RÉSOLU
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
                      <p className="text-xs text-text-muted font-bold leading-relaxed max-w-[200px]">Sélectionnez un ticket pour le traiter.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION 5: SETTINGS ================= */}
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
                    <label className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider ml-1">E-mail de contact</label>
                    <input
                      type="email"
                      value={siteConfigs.contactEmail}
                      onChange={(e) => setSiteConfigs({ ...siteConfigs, contactEmail: e.target.value })}
                      className="w-full p-2.5 bg-bg-main border border-border-color rounded-xl outline-none focus:border-primary text-xs font-bold text-text-main"
                    />
                  </div>
                </div>

                <h4 className="text-sm font-black text-text-main border-b border-border-color pt-2 pb-2 flex items-center gap-2">
                  <Lock size={16} className="text-primary" />
                  Maintenance
                </h4>

                <div className="space-y-4">
                  <div className="p-4 bg-bg-main border border-border-color rounded-2xl flex items-center justify-between shadow-xs">
                    <div>
                      <span className="block text-xs font-black text-text-main">Mode maintenance</span>
                      <span className="block text-[10px] text-text-muted mt-0.5">Désactiver l'accès aux réservations</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerConfirmation(
                        'MAINTENANCE_TOGGLE',
                        siteConfigs.maintenanceMode ? 'Désactiver' : 'Activer',
                        siteConfigs.maintenanceMode ? 'Remettre la plateforme en ligne ?' : 'Activer le mode maintenance ?',
                        null
                      )}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                        siteConfigs.maintenanceMode ? 'bg-red-500 text-white' : 'bg-primary/10 text-primary border-primary/20'
                      }`}
                    >
                      {siteConfigs.maintenanceMode ? 'ACTIF' : 'INACTIF'}
                    </button>
                  </div>

                  <div className="p-4 bg-bg-main border border-border-color rounded-2xl flex items-center justify-between shadow-xs">
                    <div>
                      <span className="block text-xs font-black text-text-main">Nouvelles inscriptions</span>
                      <span className="block text-[10px] text-text-muted mt-0.5">Autoriser les nouveaux utilisateurs</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSiteConfigs(prev => ({ ...prev, signupEnabled: !prev.signupEnabled }))}
                      className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${siteConfigs.signupEnabled ? 'bg-primary' : 'bg-border-color'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${siteConfigs.signupEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION 6: SYSTEM LOGS ================= */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div className="t-card space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-black text-text-main">Journaux Système</h4>
                </div>
                <div className="p-4 bg-black font-mono text-[11px] text-green-400 rounded-2xl space-y-2 overflow-x-auto select-all max-h-80">
                  {systemLogs.length === 0 ? (
                    <p className="text-gray-500">// Aucun log disponible.</p>
                  ) : (
                    systemLogs.map((log) => (
                      <p key={log.id} className={
                        log.status === 'blocked' ? 'text-red-400' :
                        log.status === 'warning' ? 'text-yellow-400' :
                        'text-green-400'
                      }>
                        [{new Date(log.createdAt || Date.now()).toLocaleString('fr-FR')}] {log.text || log.action || '—'}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* --- CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-bg w-full max-w-sm border border-border-color rounded-[1.5rem] shadow-2xl p-6 space-y-4 text-center"
            >
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
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
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-red-500/15"
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




