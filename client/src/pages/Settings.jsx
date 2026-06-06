import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { 
  Settings as SettingsIcon, 
  Shield, 
  History, 
  Layout, 
  HelpCircle, 
  MessageSquare, 
  AlertCircle, 
  Moon, 
  Sun, 
  Monitor,
  ChevronRight,
  ArrowLeft,
  Bell,
  Lock,
  User,
  ExternalLink,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  MessageCircle
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PastTherapist from '../components/PastTherapist';
import PastSessionsList from '../components/PastSessionsList';
import { useAuth } from '../auth/AuthContext';
import { patient as patientApi } from '../services/api';

export default function Settings({ onNavigateToPage, initialTab = 'account', userRole = 'PATIENT' }) {
  const { user } = useAuth();
  const t = (key, val) => val;
  const isRTL = false;
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab === 'history' && userRole === 'THERAPIST') {
      return 'account';
    }
    return initialTab;
  });
  
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') || 'system');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Real data states
  const [sessionReports, setSessionReports] = useState([]);
  const [pastTherapists, setPastTherapists] = useState([]);
  const [expandedTherapistId, setExpandedTherapistId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load real session history when tab is 'history' and role is PATIENT
  useEffect(() => {
    if (activeTab === 'history' && userRole !== 'THERAPIST') {
      const loadHistory = async () => {
        setLoadingHistory(true);
        try {
          const reportsRes = await patientApi.getSessionReports();
          const reports = reportsRes.data || [];
          setSessionReports(reports);
          
          // Group reports by therapist
          const therapistMap = {};
          reports.forEach(report => {
            const therapistId = report.appointment?.therapistId || 'unknown';
            const therapistName = report.appointment?.therapist?.user?.name || 'Thérapeute';
            if (!therapistMap[therapistId]) {
              therapistMap[therapistId] = {
                id: therapistId,
                name: therapistName,
                speciality: report.appointment?.therapist?.approcheTherapeute || 'Psychologue',
                wilaya: '16 - Alger',
                rating: report.rating || 0,
                sessionCount: 0,
                lastSessionDate: '',
                sessions: [],
              };
            }
            therapistMap[therapistId].sessionCount += 1;
            const sessionDate = new Date(report.appointment?.scheduledAt || report.createdAt);
            const dateStr = sessionDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            if (!therapistMap[therapistId].lastSessionDate || sessionDate > new Date(therapistMap[therapistId].lastSessionDate)) {
              therapistMap[therapistId].lastSessionDate = dateStr;
            }
            therapistMap[therapistId].sessions.push({
              id: report.id || report.appointmentId,
              date: dateStr,
              duration: '45 min',
              status: 'Terminée',
              rated: report.rating > 0,
              rating: report.rating || 0,
              note: report.comment || '',
              therapistName,
              report: {
                summary: report.sessionNotes || 'Résumé non disponible.',
                homework: '',
                nextGoals: report.interventionsUsed || [],
              },
            });
          });
          
          setPastTherapists(Object.values(therapistMap));
        } catch (err) {
          console.error('Failed to load session history:', err);
          setPastTherapists([]);
        } finally {
          setLoadingHistory(false);
        }
      };
      loadHistory();
    }
  }, [activeTab, userRole]);

  // Confidentiality detail views state
  const [selectedPrivacySection, setSelectedPrivacySection] = useState(null);

  // States for private checkup / settings
  const [anonData, setAnonData] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  
  const [msgRetention, setMsgRetention] = useState('always');
  const [hideNotifications, setHideNotifications] = useState(false);
  const [pinProtection, setPinProtection] = useState(false);
  
  const [profileVisibility, setProfileVisibility] = useState('active_therapists');
  const [hideEmail, setHideEmail] = useState(true);
  const [hidePhone, setHidePhone] = useState(true);

  // Reset confidentiality subpanel on main tab switch
  useEffect(() => {
    setSelectedPrivacySection(null);
  }, [activeTab]);

  // Dark Mode logic
  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = (theme) => {
      root.classList.remove('light', 'dark');
      if (theme === 'dark' || (theme === 'system' && mediaQuery.matches)) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    };

    applyTheme(darkMode);
    localStorage.setItem('theme', darkMode);

    if (darkMode === 'system') {
      const listener = (e) => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [darkMode]);

  // Build current user from AuthContext
  const currentUser = {
    name: user?.name || (userRole === 'THERAPIST' ? 'Dr.' : 'Utilisateur'),
    email: user?.email || '',
    role: userRole || 'PATIENT'
  };

  const tabs = [
    { id: 'account', label: t('tabAccount', 'Compte'), icon: User, category: t('tabCategoryGeneral', 'Général') },
    { id: 'privacy', label: t('tabPrivacy', 'Confidentialité'), icon: Shield, category: t('tabCategoryGeneral', 'Général') },
    { id: 'notifications', label: t('tabNotifications', 'Notifications'), icon: Bell, category: t('tabCategoryGeneral', 'Général') },
    ...(userRole !== 'THERAPIST' ? [{ id: 'history', label: t('tabHistory', 'Historique'), icon: History, category: t('tabCategoryGeneral', 'Général') }] : []),
    { id: 'display', label: t('tabDisplay', 'Affichage'), icon: Layout, category: t('tabCategoryInterface', 'Interface') },
    { id: 'help', label: t('tabHelp', 'Aide'), icon: HelpCircle, category: t('tabCategorySupport', 'Support') },
    { id: 'report', label: t('tabReport', 'Signaler un problème'), icon: AlertCircle, category: t('tabCategorySupport', 'Support') },
  ];

  const categories = [t('tabCategoryGeneral', 'Général'), t('tabCategoryInterface', 'Interface'), t('tabCategorySupport', 'Support')];

  return (
    <div className="min-h-screen bg-bg-main text-text-main font-sans">
      <Header 
        onLogin={() => onNavigateToPage('LOGIN')} 
        onAbout={() => onNavigateToPage('ABOUT')}
        onHome={() => onNavigateToPage(userRole === 'THERAPIST' ? 'THERAPIST' : 'PATIENT')}
        user={currentUser}
        onLogout={() => onNavigateToPage('LANDING')}
        onNavigateToPage={onNavigateToPage}
      />

      <main className="pt-32 pb-20 px-4 md:px-8 max-w-7xl mx-auto relative">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => onNavigateToPage(userRole === 'THERAPIST' ? 'THERAPIST' : 'PATIENT')}
            className="flex items-center gap-2 text-primary font-bold hover:translate-x-[-4px] rtl:hover:translate-x-[4px] transition-transform"
          >
            <ArrowLeft size={20} className="rtl:rotate-180" /> <span className="text-sm">{t('backToDashboard', 'Retour au tableau de bord')}</span>
          </button>

          {/* Mobile Sidebar Toggle */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-3 bg-card-bg border border-border-color rounded-xl shadow-sm text-primary hover:bg-primary-light transition-all"
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-8 relative items-start">
          {/* Sidebar Nav */}
          <aside className="hidden md:block md:w-[280px] lg:w-[320px] sticky top-32">
            <div className="t-card p-4">
              <h2 className="text-xl font-bold px-4 mb-6">{t('settingsTitle', 'Paramètres')}</h2>
              <div className="space-y-6">
                {categories.map(cat => (
                  <div key={cat}>
                    <p className="text-[10px] uppercase font-bold text-text-muted tracking-widest px-4 mb-2">{cat}</p>
                    <div className="space-y-1">
                      {tabs.filter(t => t.category === cat).map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-bold text-sm transition-all ${
                            activeTab === tab.id 
                              ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                              : 'hover:bg-bg-main text-text-muted'
                          }`}
                        >
                          <tab.icon size={18} />
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Mobile Sidebar */}
          <AnimatePresence>
            {isSidebarOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsSidebarOpen(false)}
                  className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] md:hidden"
                />
                
                <motion.div 
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  className="fixed inset-y-0 left-0 w-[280px] bg-bg-main z-[70] p-6 md:hidden overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold">{t('settingsTitle', 'Paramètres')}</h2>
                    <button 
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-2 hover:bg-card-bg rounded-lg text-text-muted border border-border-color shadow-sm transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {categories.map(cat => (
                      <div key={cat}>
                        <p className="text-[10px] uppercase font-bold text-text-muted tracking-widest px-4 mb-2">{cat}</p>
                        <div className="space-y-1">
                          {tabs.filter(t => t.category === cat).map(tab => (
                            <button
                              key={tab.id}
                              onClick={() => {
                                setActiveTab(tab.id);
                                setIsSidebarOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-bold text-sm transition-all ${
                                activeTab === tab.id 
                                  ? 'bg-primary text-white shadow-lg shadow-primary/20 shadow-inner' 
                                  : 'hover:bg-card-bg text-text-muted border border-transparent transition-colors'
                              }`}
                            >
                              <tab.icon size={18} />
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <div className="t-card">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  {activeTab === 'account' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">{t('accountSettings', 'Informations personnelles')}</h3>
                        <p className="text-sm text-text-muted font-medium">{t('accountSettingsSub', 'Gérez vos détails de compte et de sécurité.')}</p>
                      </div>

                      <div className="grid gap-6">
                        <div className="space-y-4">
                          <label className="text-xs font-bold uppercase tracking-wider text-primary">Nom Complet</label>
                          <input type="text" defaultValue={currentUser.name} className="t-input w-full" />
                        </div>
                        <div className="space-y-4">
                          <label className="text-xs font-bold uppercase tracking-wider text-primary">Email</label>
                          <input type="email" defaultValue={currentUser.email} className="t-input w-full" />
                        </div>
                        <div className="space-y-4">
                          <label className="text-xs font-bold uppercase tracking-wider text-primary">Changer le mot de passe</label>
                          <div className="space-y-4">
                            <input type="password" placeholder="Nouveau mot de passe" className="t-input w-full" />
                            <button className="t-btn-primary w-full sm:w-auto px-10 py-4">Mettre à jour le mot de passe</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'privacy' && (
                    <div className="space-y-8">
                      {selectedPrivacySection === null ? (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-8"
                        >
                          <div>
                            <h3 className="text-2xl font-bold mb-2">{t('privacySettings', 'Confidentialité')}</h3>
                            <p className="text-sm text-text-muted font-medium">{t('privacySettingsSub', 'Contrôlez qui peut voir vos informations.')}</p>
                          </div>

                          <div className="space-y-4">
                            {[
                              { id: 'checkup', title: 'Vérification de la confidentialité', desc: 'Un guide pour contrôler vos partages.', icon: Shield },
                              { id: 'encryption', title: 'Chiffrement des messages', desc: 'Vos conversations sont protégées de bout en bout.', icon: Lock },
                              { id: 'visibility', title: 'Visibilité du profil', desc: 'Visible uniquement par vos thérapeutes sélectionnés.', icon: User }
                            ].map((item, i) => (
                              <div 
                                key={i} 
                                onClick={() => setSelectedPrivacySection(item.id)}
                                className="flex items-center justify-between p-4 bg-bg-main rounded-2xl border border-border-color hover:border-primary/30 transition-all cursor-pointer group"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="p-3 bg-card-bg rounded-xl text-primary shadow-sm">
                                    <item.icon size={20} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm">{item.title}</p>
                                    <p className="text-xs text-text-muted">{item.desc}</p>
                                  </div>
                                </div>
                                <ChevronRight size={18} className="text-text-muted group-hover:translate-x-1 transition-transform" />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-6"
                        >
                          {/* 1. Privacy Checkup Subpage */}
                          {selectedPrivacySection === 'checkup' && (
                            <div className="space-y-6">
                              <button
                                onClick={() => setSelectedPrivacySection(null)}
                                className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary transition-all cursor-pointer mb-2"
                              >
                                <ArrowLeft size={14} /> Retour à la liste
                              </button>

                              <div className="border-b border-border-color pb-4">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                  <Shield className="text-primary" size={22} /> Vérification de la confidentialité
                                </h3>
                                <p className="text-xs text-text-muted font-medium mt-1">
                                  Faites le point complet sur la sécurité de votre compte et déterminez qui peut accéder à vos données de santé.
                                </p>
                              </div>

                              {/* Status badge and notification */}
                              <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                                  <CheckCircle2 size={22} />
                                </div>
                                <div>
                                  <p className="font-extrabold text-xs text-emerald-600 uppercase tracking-widest">Confidentialité optimale</p>
                                  <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed font-semibold">
                                    Votre compte respecte toutes les recommandations de sécurité de la plateforme. Vos données médicales sont entièrement protégées.
                                  </p>
                                </div>
                              </div>

                              {/* Checks items */}
                              <div className="space-y-3 pt-2">
                                <h4 className="text-[10px] font-black uppercase text-text-muted tracking-wide ml-1">Statut des éléments de contrôle</h4>
                                
                                <div className="p-4 bg-bg-main border border-border-color rounded-2xl space-y-3">
                                  <div className="flex items-start gap-3">
                                    <div className="text-emerald-500 mt-0.5 shrink-0">
                                      <CheckCircle2 size={16} />
                                    </div>
                                    <div>
                                      <p className="font-bold text-xs text-text-main">Accès thérapeute restreint</p>
                                      <p className="text-[11px] text-text-muted font-medium">Seul le thérapeute de votre consultation en cours ou passée est autorisé à consulter vos motifs et vos rapports.</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-start gap-3 border-t border-border-color/40 pt-3">
                                    <div className="text-emerald-500 mt-0.5 shrink-0">
                                      <CheckCircle2 size={16} />
                                    </div>
                                    <div>
                                      <p className="font-bold text-xs text-text-main">Chiffrement actif</p>
                                      <p className="text-[11px] text-text-muted font-medium">Vos rapports de sessions et vos messages de chat sont scellés par des clés cryptographiques uniques.</p>
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-3 border-t border-border-color/40 pt-3">
                                    <div className="text-emerald-500 mt-0.5 shrink-0">
                                      <CheckCircle2 size={16} />
                                    </div>
                                    <div>
                                      <p className="font-bold text-xs text-text-main">Abonnement & Facturation sécurisés</p>
                                      <p className="text-[11px] text-text-muted font-medium">Vos informations de facturation privées ne transitent jamais sur nos serveurs et sont hébergées par notre partenaire agréé PCI-DSS.</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Quick consent controls */}
                              <div className="space-y-4 pt-2">
                                <h4 className="text-[10px] font-black uppercase text-text-muted tracking-wide ml-1">Options de consentement</h4>

                                <div className="flex items-center justify-between p-4 bg-bg-main rounded-2xl border border-border-color">
                                  <div className="pr-4">
                                    <p className="font-bold text-sm">Anonymisation des statistiques d'usage</p>
                                    <p className="text-xs text-text-muted leading-relaxed mt-0.5">Permettre l'évaluation de vos données d'usage de l'application de façon strictement anonyme pour nous aider à améliorer l'ergonomie de l'interface.</p>
                                  </div>
                                  <button 
                                    onClick={() => setAnonData(!anonData)}
                                    className={`w-12 h-6 rounded-full p-1 transition-all shrink-0 cursor-pointer ${anonData ? 'bg-primary' : 'bg-border-color'}`}
                                  >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-all ${anonData ? 'translate-x-6' : 'translate-x-0'}`} />
                                  </button>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-bg-main rounded-2xl border border-border-color">
                                  <div className="pr-4">
                                    <p className="font-bold text-sm">Alertes de connexion suspectes</p>
                                    <p className="text-xs text-text-muted leading-relaxed mt-0.5">M'envoyer une notification immédiate par courriel si une nouvelle connexion suspecte est détectée depuis un autre navigateur ou un autre ordinateur.</p>
                                  </div>
                                  <button 
                                    onClick={() => setEmailAlerts(!emailAlerts)}
                                    className={`w-12 h-6 rounded-full p-1 transition-all shrink-0 cursor-pointer ${emailAlerts ? 'bg-primary' : 'bg-border-color'}`}
                                  >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-all ${emailAlerts ? 'translate-x-6' : 'translate-x-0'}`} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 2. Message Encryption Subpage */}
                          {selectedPrivacySection === 'encryption' && (
                            <div className="space-y-6">
                              <button
                                onClick={() => setSelectedPrivacySection(null)}
                                className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary transition-all cursor-pointer mb-2"
                              >
                                <ArrowLeft size={14} /> Retour à la liste
                              </button>

                              <div className="border-b border-border-color pb-4">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                  <Lock className="text-primary" size={22} /> Chiffrement des messages
                                </h3>
                                <p className="text-xs text-text-muted font-medium mt-1">
                                  Vos conversations sont hautement cryptées de bout en bout. Découvrez vos informations de cryptage.
                                </p>
                              </div>

                              <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl space-y-3">
                                <div className="flex items-center gap-2">
                                  <Shield className="text-primary" size={18} />
                                  <p className="font-extrabold text-[10px] text-primary uppercase tracking-widest">Technologie active</p>
                                </div>
                                <p className="text-xs text-text-main font-semibold leading-relaxed">
                                  Chaque échange de chat est scellé par un algorithme cryptologique de niveau AES-256 bits. Les clés privées sont générées pour votre session et stockées de manière inviolable sur votre support physique. Ni nos techniciens ni les tiers ne peuvent intercepter vos messages.
                                </p>
                                <div className="flex flex-wrap gap-4 text-[9px] font-mono font-bold text-text-muted pt-1 border-t border-border-color/30">
                                  <span>PROTCOLE: AES-256-GCM</span>
                                  <span>CLE UNIQUE: 0x7E...4A9d4</span>
                                  <span>STATUT: ACTIF & PROTEGÉ</span>
                                </div>
                              </div>

                              <div className="space-y-4 pt-2">
                                <h4 className="text-[10px] font-black uppercase text-text-muted tracking-wide ml-1">Options de sécurité des discussions</h4>

                                <div className="p-4 bg-bg-main rounded-2xl border border-border-color space-y-3">
                                  <div>
                                    <p className="font-bold text-sm">Conservation locale des discussions</p>
                                    <p className="text-xs text-text-muted leading-relaxed mt-0.5">Décidez du délai au terme duquel vos conversations sont effacées définitivement de l'appareil.</p>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 pt-1">
                                    {[
                                      { id: 'always', label: 'Indéfiniment' },
                                      { id: '1year', label: '1 an' },
                                      { id: '3months', label: '3 mois' }
                                    ].map(opt => (
                                      <button
                                        key={opt.id}
                                        onClick={() => setMsgRetention(opt.id)}
                                        className={`p-3 rounded-xl border-2 text-xs font-bold cursor-pointer transition-all ${
                                          msgRetention === opt.id 
                                            ? 'border-primary bg-primary/5 text-primary' 
                                            : 'border-border-color hover:border-primary/20 bg-card-bg text-text-muted'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                               
                              </div>
                            </div>
                          )}

                          {/* 3. Profile Visibility Subpage */}
                          {selectedPrivacySection === 'visibility' && (
                            <div className="space-y-6">
                              <button
                                onClick={() => setSelectedPrivacySection(null)}
                                className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary transition-all cursor-pointer mb-2"
                              >
                                <ArrowLeft size={14} /> Retour à la liste
                              </button>

                              <div className="border-b border-border-color pb-4">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                  <User className="text-primary" size={22} /> Visibilité du profil
                                </h3>
                                <p className="text-xs text-text-muted font-medium mt-1">
                                  Gérez les règles d'exposition de votre profil patient et contrôlez vos données personnelles de mise en relation.
                                </p>
                              </div>

                              <div className="p-4 bg-bg-main border border-border-color rounded-2xl space-y-1">
                                <div className="flex items-center gap-2 text-primary font-bold text-xs mb-1">
                                  <CheckCircle2 size={14} />
                                  <span>Pseudonymisation activée d'office</span>
                                </div>
                                <p className="text-[11px] text-text-muted font-medium leading-relaxed">
                                  Conformément au RGPD et au secret médical, votre profil de santé n'est visible sur aucun annuaire public ni Google. Seuls les praticiens avec qui vous initiez volontairement un rendez-vous reçoivent vos détails.
                                </p>
                              </div>

                              <div className="space-y-3 pt-2">
                                <h4 className="text-[10px] font-black uppercase text-text-muted tracking-wide ml-1">Mode d'accès au profil</h4>
                                
                                <div className="grid gap-3">
                                  {[
                                    { id: 'all', title: 'Visibilité générale (Praticiens agréés)', desc: 'Tous les thérapeutes validés sur la plateforme peuvent voir votre fiche générale pour vous proposer un accompagnement.' },
                                    { id: 'active_therapists', title: 'Uniquement mes thérapeutes actifs (Recommandé)', desc: 'Seuls les thérapeutes avec qui vous avez une séance programmée ou un suivi mensuel en cours peuvent ouvrir votre dossier.' },
                                    { id: 'private', title: 'Dossier strictement privé', desc: 'Votre profil est masqué globalement. Vous seul pouvez transférer votre historique de santé à un thérapeute via une clé de consultation temporaire.' }
                                  ].map(level => (
                                    <button
                                      key={level.id}
                                      onClick={() => setProfileVisibility(level.id)}
                                      className={`w-full p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                                        profileVisibility === level.id 
                                          ? 'border-primary bg-primary/5 text-text-main' 
                                          : 'border-border-color hover:border-primary/20 bg-bg-main'
                                      }`}
                                    >
                                      <span className="font-bold text-xs flex items-center gap-1.5 text-text-main">
                                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${profileVisibility === level.id ? 'border-primary' : 'border-border-color'}`}>
                                          {profileVisibility === level.id && <span className="w-2.5 h-2.5 bg-primary rounded-full" />}
                                        </span>
                                        {level.title}
                                      </span>
                                      <span className="text-[11px] text-text-muted leading-relaxed font-semibold ml-5">{level.desc}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-4 pt-2">
                                <h4 className="text-[10px] font-black uppercase text-text-muted tracking-wide ml-1">Masquage des contacts sensibles</h4>

                                <div className="flex items-center justify-between p-4 bg-bg-main rounded-2xl border border-border-color">
                                  <div className="pr-4">
                                    <p className="font-bold text-sm">Masquer mon adresse email</p>
                                    <p className="text-xs text-text-muted leading-relaxed mt-0.5">N'affiche pas votre courriel personnel. Les praticiens doivent utiliser l'interface de discussion intégrée pour vous contacter par écrit.</p>
                                  </div>
                                  <button 
                                    onClick={() => setHideEmail(!hideEmail)}
                                    className={`w-12 h-6 rounded-full p-1 transition-all shrink-0 cursor-pointer ${hideEmail ? 'bg-primary' : 'bg-border-color'}`}
                                  >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-all ${hideEmail ? 'translate-x-6' : 'translate-x-0'}`} />
                                  </button>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-bg-main rounded-2xl border border-border-color">
                                  <div className="pr-4">
                                    <p className="font-bold text-sm">Masquer mon numéro de téléphone</p>
                                    <p className="text-xs text-text-muted leading-relaxed mt-0.5">Empêcher la consultation de vos numéros mobiles. Oblige à utiliser la téléconsultation ou la VoIP interne de l'application.</p>
                                  </div>
                                  <button 
                                    onClick={() => setHidePhone(!hidePhone)}
                                    className={`w-12 h-6 rounded-full p-1 transition-all shrink-0 cursor-pointer ${hidePhone ? 'bg-primary' : 'bg-border-color'}`}
                                  >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-all ${hidePhone ? 'translate-x-6' : 'translate-x-0'}`} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  )}

                  {activeTab === 'history' && (
                    <div className="space-y-8">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <h3 className="text-2xl font-bold mb-1">{t('historySettings', 'Historique personnel')}</h3>
                          <p className="text-xs text-text-muted font-semibold">{t('historySettingsSub', 'Gérez vos activités passées et thérapeutes consultés.')}</p>
                        </div>
                      </div>
                      
                      {loadingHistory ? (
                        <div className="t-card border-dashed border-2 border-border-color flex flex-col items-center justify-center p-12 space-y-4 text-center">
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-xs text-text-muted font-medium">Chargement de votre historique...</p>
                        </div>
                      ) : pastTherapists.length === 0 ? (
                        <div className="t-card border-dashed border-2 border-border-color flex flex-col items-center justify-center p-12 space-y-4 text-center">
                          <div className="p-4 bg-bg-main rounded-full text-text-muted">
                             <History size={32} />
                          </div>
                          <p className="font-bold text-text-muted">{t('emptyHistoryTitle', 'Aucune activité pour le moment.')}</p>
                          <p className="text-xs text-text-muted max-w-xs">{t('emptyHistoryDesc', 'Vos sessions passées apparaîtront ici après vos consultations.')}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {pastTherapists.map((therapist) => {
                            const isExpanded = expandedTherapistId === therapist.id;
                            return (
                              <div key={therapist.id} className="space-y-4">
                                <PastTherapist 
                                  therapist={therapist}
                                  isExpanded={isExpanded}
                                  onClick={() => setExpandedTherapistId(isExpanded ? null : therapist.id)}
                                />
                                {isExpanded && (
                                  <PastSessionsList sessions={therapist.sessions} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'display' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Affichage</h3>
                        <p className="text-sm text-text-muted font-medium">Personnalisez votre confort visuel.</p>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-primary">Mode Sombre</p>
                          <div className="grid grid-cols-3 gap-4">
                            {[
                              { id: 'light', label: 'Clair', icon: Sun },
                              { id: 'dark', label: 'Sombre', icon: Moon },
                              { id: 'system', label: 'Système', icon: Monitor }
                            ].map(mode => (
                              <button 
                                key={mode.id}
                                onClick={() => setDarkMode(mode.id)}
                                className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                                  darkMode === mode.id ? 'border-primary bg-primary/5 text-primary' : 'border-border-color hover:border-primary/30'
                                }`}
                              >
                                <mode.icon size={24} />
                                <span className="text-xs font-bold">{mode.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'help' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Centre d'aide</h3>
                        <p className="text-sm text-text-muted font-medium">Comment pouvons-nous vous aider ?</p>
                      </div>

                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Rechercher une solution..."
                          className="t-input w-full !p-4 pl-12"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                           <Layout size={20} />
                        </div>
                      </div>

                      <div className="grid gap-4">
                        {[
                          "Comment réserver une séance ?",
                          "Modifier mes informations",
                          "Confidentialité des données",
                          "Paiements et remboursements"
                        ].map(q => (
                          <button key={q} className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-bg-main border border-transparent hover:border-border-color mb-2 text-sm font-bold text-left group">
                            {q}
                            <ExternalLink size={16} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'report' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Signaler un problème</h3>
                        <p className="text-sm text-text-muted font-medium">Décrivez le problème technique que vous rencontrez.</p>
                      </div>

                      <div className="space-y-6">
                        <textarea 
                          rows={6}
                          placeholder="Ex: Le bouton de réservation ne répond pas..."
                          className="t-input w-full resize-none"
                        />
                        <div className="p-4 border-2 border-dashed border-border-color rounded-2xl flex flex-col items-center justify-center text-text-muted hover:border-primary/30 transition-all cursor-pointer">
                          <Layout size={24} className="mb-2" />
                          <p className="text-xs font-bold">Ajouter une capture d'écran</p>
                        </div>
                        <button className="t-btn-primary w-full py-4 shadow-xl shadow-primary/20">
                          Envoyer le signalement
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigateToPage} />
    </div>
  );
}