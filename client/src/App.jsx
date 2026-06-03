import { useState, useEffect } from 'react';
import Registration from './pages/Registration';
import Login from './pages/Login';
import About from './pages/About';
import Patient from './pages/Patient';
import Therapist from './pages/Therapist';
import Settings from './pages/Settings';
import Panel from './pages/Panel';
import AccessDenied from './pages/AccessDenied';
import { useAuth } from './auth/AuthContext';
import { canAccess, defaultPageForUser } from './auth/canAccess';
import ProtectedRoute from './auth/ProtectedRoute';

/**
 * AppContent
 *
 * The application uses a custom state-based router:
 *
 *   const [currentPage, setCurrentPage] = useState('REGISTRATION')
 *
 * `currentPage` is a string identifier for the active view
 * (REGISTRATION, LOGIN, PATIENT, THERAPIST, ADMIN, ABOUT, SETTINGS,
 *  ACCESS_DENIED, ...).
 *
 * Each role-restricted view is wrapped in <ProtectedRoute page="...">,
 * which centralizes the access rules defined in `auth/canAccess.js`:
 *
 *   - PATIENT   requires role === "PATIENT"
 *   - THERAPIST requires role === "THERAPIST" AND
 *               verificationStatus === "verified"
 *   - ADMIN     requires role === "ADMIN"
 *
 * The check uses the role and verification status that come from
 * the backend session (via AuthContext) — never from the URL or
 * from component state. So even if a user manually tries to reach
 * /therapist or /admin, the guard will redirect them.
 */
function AppContent() {
  const [currentPage, setCurrentPage] = useState('REGISTRATION');
  const [initialMode, setInitialMode] = useState(null);
  const [initialTab, setInitialTab] = useState('account');
  const [sessionData, setSessionData] = useState({
    user: null,
    userRole: null, // 'PATIENT' or 'THERAPIST'
    selectedTherapist: null,
  });

  const { user, isAuthenticated, loading } = useAuth();

  // Temporary debug log — helps confirm the auth state on every render
  // when investigating the unexpected redirect to /therapist on the
  // root URL.
  // eslint-disable-next-line no-console
  console.log('[App][render]', {
    currentPage,
    loading,
    isAuthenticated,
    userRole: user?.role,
    hasUser: Boolean(user),
  });

  // Dark Mode global initialization
  useEffect(() => {
    const root = window.document.documentElement;
    const initialTheme = localStorage.getItem('theme') || 'system';
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (theme) => {
      root.classList.remove('light', 'dark');
      if (theme === 'dark' || (theme === 'system' && mediaQuery.matches)) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    };

    applyTheme(initialTheme);

    if (initialTheme === 'system') {
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // If a user is already authenticated (e.g. they refreshed the page
  // and we hydrated their session from the JWT in localStorage),
  // and the current page is the default landing page (REGISTRATION),
  // jump them straight to their default page. This means the URL
  // can never display REGISTRATION to a logged-in user.
  //
  // SECURITY: we only redirect to a private page when we are SURE the
  // user is authenticated AND the user object is present AND its role
  // is one of the known roles. A null/undefined user (or a user with
  // an unrecognized role) must keep the public page on screen.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      // Not authenticated: keep the page the user asked for (root
      // = REGISTRATION = landing). We never force-redirect an
      // anonymous visitor into a private dashboard.
      return;
    }
    if (!user) {
      // Defensive: isAuthenticated says true but the user object is
      // missing (race condition during hydrate). Treat as logged out.
      // eslint-disable-next-line no-console
      console.warn('[App][redirect] isAuthenticated=true but user is null, ignoring');
      return;
    }
    if (currentPage !== 'REGISTRATION') {
      // The user navigated to a specific page; do not override it.
      return;
    }
    const target = defaultPageForUser(user);
    // eslint-disable-next-line no-console
    console.log('[App][redirect]', { from: currentPage, to: target });
    if (target && target !== 'REGISTRATION') {
      setCurrentPage(target);
    }
  }, [loading, isAuthenticated, currentPage, user]);

  const handleNavigate = (page, data = {}) => {
    if (data.therapist) {
      setSessionData((prev) => ({ ...prev, selectedTherapist: data.therapist }));
    }
    if (data.role) {
      setSessionData((prev) => ({ ...prev, userRole: data.role }));
    }
    setInitialMode(data.mode || null);
    setInitialTab(data.tab || 'account');
    setCurrentPage(page);
  };

  // -------- Public views (no auth required) --------

  if (currentPage === 'LOGIN') {
    return (
      <Login
        onBackToRegistration={() => handleNavigate('REGISTRATION')}
        onNavigateToPage={handleNavigate}
      />
    );
  }

  if (currentPage === 'ABOUT') {
    return <About onNavigateToPage={handleNavigate} />;
  }

  if (currentPage === 'ACCESS_DENIED') {
    return <AccessDenied onNavigateToPage={handleNavigate} />;
  }

  // -------- Settings is reachable by any authenticated user --------

  if (currentPage === 'SETTINGS') {
    return (
      <ProtectedRoute page="SETTINGS" onNavigate={handleNavigate}>
        <Settings
          onNavigateToPage={handleNavigate}
          initialTab={initialTab}
          userRole={sessionData.userRole || (user?.role ? user.role.toUpperCase() : null)}
        />
      </ProtectedRoute>
    );
  }

  // -------- Role-restricted views --------

  if (currentPage === 'ADMIN' || (currentPage === 'LOGIN_SUCCESS' && sessionData.userRole === 'ADMIN')) {
    return (
      <ProtectedRoute page="ADMIN" onNavigate={handleNavigate}>
        <Panel onNavigateToPage={handleNavigate} />
      </ProtectedRoute>
    );
  }

  if (currentPage === 'PATIENT' || (currentPage === 'LOGIN_SUCCESS' && sessionData.userRole === 'PATIENT')) {
    return (
      <ProtectedRoute page="PATIENT" onNavigate={handleNavigate}>
        <Patient
          onNavigateToPage={handleNavigate}
          currentTherapist={sessionData.selectedTherapist}
        />
      </ProtectedRoute>
    );
  }

  if (currentPage === 'THERAPIST' || (currentPage === 'LOGIN_SUCCESS' && sessionData.userRole === 'THERAPIST')) {
    return (
      <ProtectedRoute page="THERAPIST" onNavigate={handleNavigate}>
        <Therapist onNavigateToPage={handleNavigate} />
      </ProtectedRoute>
    );
  }

  // Default fallback: registration. If the user is already logged in
  // and can access some page, the effect above will navigate them
  // away on the next render.
  return (
    <Registration
      onNavigateToLogin={() => handleNavigate('LOGIN')}
      onNavigateToPage={handleNavigate}
      initialMode={initialMode}
    />
  );
}

export default function App() {
  return (
    <AppContent />
  );
}
