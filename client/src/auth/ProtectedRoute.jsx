import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { canAccess, defaultPageForUser } from './canAccess';

/**
 * <ProtectedRoute page="THERAPIST" onNavigate={...}>
 *
 * A reusable route guard for the custom state-based router used
 * in App.jsx (currentPage in a useState). It enforces the access
 * rules defined in canAccess.js:
 *
 *   - If the session is still being restored (loading), it shows
 *     a minimal loading state.
 *   - If the page requires authentication and the user is not
 *     authenticated, it redirects to the LOGIN page.
 *   - If the user is authenticated but cannot access the page
 *     (wrong role, unverified therapist, ...), it shows the
 *     ACCESS_DENIED page and offers navigation back to the user's
 *     own default page.
 *   - Otherwise it renders `children`.
 *
 * SECURITY: this guard NEVER lets the child component render
 * unless we can prove that the user is authenticated AND has
 * access to the requested page. A null/undefined user — even when
 * isAuthenticated happens to be true (race condition during
 * hydration) — is treated as anonymous and triggers the redirect.
 *
 * Usage in App.jsx:
 *
 *   if (currentPage === 'THERAPIST') {
 *     return (
 *       <ProtectedRoute page="THERAPIST" onNavigate={handleNavigate}>
 *         <Therapist onNavigateToPage={handleNavigate} />
 *       </ProtectedRoute>
 *     );
 *   }
 */
export default function ProtectedRoute({ page, children, onNavigate }) {
  const { user, loading, isAuthenticated } = useAuth();

  // Defensive: even if isAuthenticated happens to be true, we treat
  // a missing user object as "not logged in". This prevents a brief
  // window during hydration where a stale state could leak the
  // protected view.
  const effectivelyAuthenticated = Boolean(isAuthenticated && user);

  const hasAccess = canAccess(page, effectivelyAuthenticated ? user : null);

  // Temporary debug log — helps confirm guard decisions while we
  // investigate the unexpected redirect to /therapist.
  // eslint-disable-next-line no-console
  console.log('[ProtectedRoute]', {
    page,
    loading,
    isAuthenticated,
    hasUser: Boolean(user),
    effectivelyAuthenticated,
    hasAccess,
  });

  useEffect(() => {
    if (loading) return;
    if (!effectivelyAuthenticated) {
      // No valid session — bounce to login. We use the same navigate
      // function the rest of the app uses to keep the URL/state
      // model consistent.
      if (typeof onNavigate === 'function') {
        // eslint-disable-next-line no-console
        console.log('[ProtectedRoute] redirecting to LOGIN', { page });
        onNavigate('LOGIN');
      }
    }
  }, [loading, effectivelyAuthenticated, onNavigate, page]);

  // 1) Still hydrating the session from localStorage /api/auth/me
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main text-text-muted">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">Chargement de votre session…</p>
        </div>
      </div>
    );
  }

  // 2) Not logged in — render nothing; the effect will redirect.
  //    We also explicitly render nothing when isAuthenticated is true
  //    but the user object is missing (defensive).
  if (!effectivelyAuthenticated) {
    return null;
  }

  // 3) Logged in but the role/verification status does not allow
  //    access to this page. Render an inline access-denied message
  //    (we don't navigate automatically because the user may want
  //    to know why access was blocked).
  if (!hasAccess) {
    const fallback = defaultPageForUser(user);
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main px-6">
        <div className="max-w-md w-full t-card text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center text-2xl font-bold">
            !
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Accès refusé</h1>
          <p className="text-text-muted mb-6">
            {page === 'THERAPIST'
              ? "Votre compte thérapeute doit être vérifié par un administrateur avant de pouvoir accéder à cet espace."
              : "Vous n'avez pas les droits nécessaires pour accéder à cette page."}
          </p>
          <button
            type="button"
            className="t-btn-primary"
            onClick={() => {
              if (typeof onNavigate === 'function') onNavigate(fallback);
            }}
          >
            Retour à mon espace
          </button>
        </div>
      </div>
    );
  }

  // 4) All good — render the protected view.
  return children;
}
