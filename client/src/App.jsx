import { useState, useEffect, useRef } from 'react';
import Registration from './pages/Registration';
import Login from './pages/Login';
import About from './pages/About';
import Patient from './pages/Patient';
import Therapist from './pages/Therapist';
import Settings from './pages/Settings';
import Panel from './pages/Panel';
import AccessDenied from './pages/AccessDenied';
import { useAuth } from './auth/AuthContext';
import { canAccess, defaultPageForUser, isPrivatePage } from './auth/canAccess';
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

  // ---------------------------------------------------------------
  // LIFECYCLE LOGS — capture the exact sequence of events that
  // lead to (or prevent) a redirect on the root URL.
  // ---------------------------------------------------------------
  // 1) Initial render: which page is requested and what is the
  //    auth state at the very first render? This is the "flash"
  //    that is visible to the user.
  // eslint-disable-next-line no-console
  console.log('[App][render]', {
    currentPage,
    loading,
    isAuthenticated,
    userRole: user?.role,
    hasUser: Boolean(user),
  });

  // ---------------------------------------------------------------
  // 2) End of auth check: fires exactly once when `loading`
  //    transitions from true to false. Lets us know whether the
  //    hydrate call succeeded or was skipped (no token).
  // ---------------------------------------------------------------
  const wasLoadingRef = useRef(loading);
  useEffect(() => {
    if (wasLoadingRef.current && !loading) {
      // eslint-disable-next-line no-console
      console.log('[App][auth-check-finished]', {
        isAuthenticated,
        userRole: user?.role,
        hasUser: Boolean(user),
        currentPage,
      });
    }
    wasLoadingRef.current = loading;
  }, [loading, isAuthenticated, user, currentPage]);

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

  // ---------------------------------------------------------------
  // Redirect-on-mount logic.
  //
  // SECURITY — we apply the following strict guards, in order:
  //   G1. `loading` must be false (hydrate has finished)
  //   G2. `isAuthenticated` must be true (token + user both set)
  //   G3. `user` must be a non-null object with a known role
  //   G4. The current page must be the public landing page
  //   G5. The computed target must be a known private route
  //      (we use the isPrivatePage helper from canAccess.js as the
  //       single source of truth)
  //
  // If any guard fails we DO NOT touch currentPage: the user
  // keeps the page they were viewing (REGISTRATION on the root).
  // ---------------------------------------------------------------
  useEffect(() => {
    // G1 — wait for hydration
    if (loading) {
      // eslint-disable-next-line no-console
      console.log('[App][redirect] skipped: still loading');
      return;
    }
    // G2 — require an authenticated session
    if (!isAuthenticated) {
      // eslint-disable-next-line no-console
      console.log('[App][redirect] skipped: not authenticated, keeping public page');
      return;
    }
    // G3 — require a usable user object with a known role
    if (!user || typeof user !== 'object' || typeof user.role !== 'string') {
      // eslint-disable-next-line no-console
      console.warn('[App][redirect] skipped: isAuthenticated=true but user is invalid', {
        user,
      });
      return;
    }
    // G4 — only redirect when we are on the public landing page
    if (currentPage !== 'REGISTRATION') {
      // eslint-disable-next-line no-console
      console.log('[App][redirect] skipped: current page is not REGISTRATION', {
        currentPage,
      });
      return;
    }
    const target = defaultPageForUser(user);
    // G5 — only redirect to a known private page (single source
    // of truth lives in canAccess.js). ACCESS_DENIED is also a
    // legitimate private target (e.g. unverified therapist).
    if (!isPrivatePage(target) && target !== 'ACCESS_DENIED') {
      // eslint-disable-next-line no-console
      console.log('[App][redirect] skipped: target is not a private page', { target });
      return;
    }
    // eslint-disable-next-line no-console
    console.log('[App][redirect] navigation déclenchée', { from: currentPage, to: target });
    setCurrentPage(target);
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
