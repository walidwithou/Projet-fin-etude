import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  auth as authApi,
  getToken,
  setToken as persistToken,
  removeToken as clearToken,
  UNAUTHORIZED_EVENT,
} from '../services/api';

/**
 * AuthContext
 *
 * Single source of truth for the current user / role / verification status.
 * The context exposes:
 *   - user         : the user object returned by /auth/me, or null when not logged in
 *   - role         : normalized uppercase role string ('ADMIN' | 'THERAPIST' | 'PATIENT' | null)
 *   - token        : the JWT stored in localStorage (or null)
 *   - loading      : true while we are restoring the session
 *   - error        : last login error message, or null
 *   - login()      : logs in and stores the user + token
 *   - logout()     : clears the local session
 *   - refresh()    : re-fetches the current user (e.g. after role/verification change)
 *   - isAuthenticated
 *
 * The role and verification status come from the persisted User record /
 * Therapist record on the backend, never from the URL or component state.
 *
 * If any API call returns 401, services/api.js dispatches the
 * `tassarut:unauthorized` event, which we listen for here to clear
 * the local session. This means an expired token immediately
 * redirects the user to the login page on the next render.
 */

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  user: 'tassarut:user',
};

const safeParse = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Merge the new polymorphic `profile` payload into the `user` object
 * we keep in localStorage. The frontend's canAccess.js / AccessDenied.jsx
 * still reads `user.verificationStatus` (and similar fields) at the top
 * level for backward compatibility, but we also keep the rich
 * `user.profile` object intact so dashboard views can read
 * dashboard-specific fields directly.
 */
const mergeUserWithProfile = (user, profile) => {
  if (!user) return user;
  if (!profile) return { ...user };

  // Merge profile fields into user, BUT preserve the original User.id
  // (UUID). `profile.id` is the Patient.id or Therapist.id (CUID) and
  // must never overwrite user.id, which is the global User identifier
  // used for messaging (conversationId) and session lookups.
  const merged = { ...user, ...profile, id: user.id };
  // The profile object IS the source of truth for these fields.
  // Overwrite any stale value the server might have echoed in `user`.
  if (profile.verificationStatus !== undefined) {
    merged.verificationStatus = profile.verificationStatus;
  }
  // Keep the full profile reachable for dashboard code.
  merged.profile = profile;
  return merged;
};

const persistUser = (user) => {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.user);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
};

const readStoredUser = () => {
  const token = getToken();
  const user = safeParse(localStorage.getItem(STORAGE_KEYS.user));
  // If we have a token but no cached user, return null — the effect
  // will fetch the user via /auth/me on mount. If we have neither,
  // we are definitively logged out.
  return { token, user };
};

export function AuthProvider({ children }) {
  const [{ token, user }, setSession] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [error, setError] = useState(null);

  // Temporary debug log to investigate the unexpected redirect on root URL.
  // Helps verify the initial state restored from localStorage.
  // eslint-disable-next-line no-console
  console.log('[AuthContext][init]', {
    hasToken: Boolean(getToken()),
    storedUser: readStoredUser(),
    loading: Boolean(getToken()),
  });

  // Hydrate the user from the server when a token exists. We ALWAYS
  // verify with /auth/me on initial mount (even when a cached user is
  // present in localStorage) so a stale token + stale cached user
  // cannot trick the app into believing the user is signed in.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const existingToken = getToken();

      // eslint-disable-next-line no-console
      console.log('[AuthContext][hydrate] start', {
        hasToken: Boolean(existingToken),
        hasCachedUser: Boolean(user),
      });

      if (!existingToken) {
        // No token in storage: nothing to verify. Make sure the
        // local state is clean and we are not loading.
        clearToken();
        persistUser(null);
        setSession({ token: null, user: null });
        setLoading(false);
        return;
      }

      try {
        const response = await authApi.getCurrentUser();
        if (cancelled) return;
        // The server now returns { token, user, profile? }.
        // Flatten the polymorphic profile onto the user object so
        // canAccess.js / AccessDenied.jsx keep working unchanged.
        const { token: _t, user: serverUser, profile } = response.data || {};
        if (!serverUser) {
          // Server answered 2xx but did not return a user — treat as
          // unauthenticated so we never keep a ghost session.
          // eslint-disable-next-line no-console
          console.warn('[AuthContext][hydrate] empty user payload, clearing session');
          clearToken();
          persistUser(null);
          setSession({ token: null, user: null });
          return;
        }
        const mergedUser = mergeUserWithProfile(serverUser, profile);
        persistUser(mergedUser);
        setSession({ token: existingToken, user: mergedUser });
        // eslint-disable-next-line no-console
        console.log('[AuthContext][hydrate] success', {
          role: mergedUser?.role,
        });
      } catch (err) {
        if (cancelled) return;
        // The token is no longer valid (401), the server is down, or
        // the database has been purged. In every case we MUST wipe the
        // local state so the app does not display a protected view
        // for a user that is no longer authenticated.
        // eslint-disable-next-line no-console
        console.warn('[AuthContext][hydrate] failed, clearing session', {
          status: err?.status,
          message: err?.message,
        });
        clearToken();
        persistUser(null);
        setSession({ token: null, user: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
    // We intentionally only re-run when the token changes to avoid
    // refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Listen for 401s coming from any API call and clear the session.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handler = () => {
      clearToken();
      persistUser(null);
      setSession({ token: null, user: null });
      setLoading(false);
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const response = await authApi.login(email, password);
      const { token: newToken, user: serverUser, profile } = response.data || {};
      if (!newToken || !serverUser) {
        throw new Error('Invalid login response from server');
      }
      // Flatten the polymorphic profile onto the user object so
      // canAccess.js / AccessDenied.jsx keep working unchanged.
      const newUser = mergeUserWithProfile(serverUser, profile);
      persistToken(newToken);
      persistUser(newUser);
      setSession({ token: newToken, user: newUser });
      return newUser;
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Best-effort: tell the server. Even if it fails we still clear
      // the local session because JWTs are stateless.
      await authApi.logout().catch(() => {});
    } finally {
      clearToken();
      persistUser(null);
      setSession({ token: null, user: null });
      setError(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return null;
    try {
      const response = await authApi.getCurrentUser();
      const { user: serverUser, profile } = response.data || {};
      const mergedUser = mergeUserWithProfile(serverUser, profile);
      persistUser(mergedUser);
      setSession((prev) => ({ ...prev, user: mergedUser }));
      return mergedUser;
    } catch (err) {
      // Token expired — drop the session.
      clearToken();
      persistUser(null);
      setSession({ token: null, user: null });
      return null;
    }
  }, []);

  const value = useMemo(() => {
    const role = user && typeof user.role === 'string' ? user.role.toUpperCase() : null;
    return {
      user,
      role,
      token,
      loading,
      error,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      refresh,
    };
  }, [user, token, loading, error, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
