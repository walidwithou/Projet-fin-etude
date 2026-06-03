import { useAuth } from '../auth/AuthContext';
import { defaultPageForUser } from '../auth/canAccess';
import Header from '../components/Header';
import Footer from '../components/Footer';

/**
 * AccessDenied
 *
 * A full-page view shown when a user reaches the ACCESS_DENIED
 * "page" in the SPA router. It explains why they can't see what
 * they tried to open (most commonly: an unverified therapist
 * trying to access the therapist dashboard), and offers a button
 * that takes them back to the right place for their role.
 */
export default function AccessDenied({ onNavigateToPage }) {
  const { user, logout } = useAuth();
  const role = user && typeof user.role === 'string' ? user.role.toUpperCase() : null;
  const verificationStatus = user?.verificationStatus || null;

  // Reason text — localized to French to match the rest of the UI.
  const isUnverifiedTherapist = role === 'THERAPIST' && verificationStatus !== 'verified';

  const reason = isUnverifiedTherapist
    ? verificationStatus === 'pending'
      ? "Votre compte thérapeute est en cours de vérification par notre équipe. Vous recevrez un e-mail dès qu'il sera approuvé."
      : verificationStatus === 'rejected'
        ? "Votre compte thérapeute a été rejeté. Veuillez contacter le support pour plus d'informations."
        : "Votre compte thérapeute n'est pas encore vérifié."
    : "Vous n'avez pas les droits nécessaires pour accéder à cette page.";

  const fallback = defaultPageForUser(user);

  return (
    <div className="min-h-screen bg-bg-main text-text-main font-sans selection:bg-primary-light">
      <Header
        onLogin={() => {}}
        onAbout={() => onNavigateToPage && onNavigateToPage('ABOUT')}
        onHome={() => onNavigateToPage && onNavigateToPage('REGISTRATION')}
        onNavigateToPage={onNavigateToPage || (() => {})}
      />

      <main className="pt-32 pb-20 px-6 max-w-2xl mx-auto text-center">
        <div className="t-card">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center text-3xl font-bold border border-red-500/20">
            403
          </div>
          <h1 className="text-3xl font-bold mb-3 text-primary">Accès refusé</h1>
          <p className="text-text-muted mb-8 leading-relaxed">{reason}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {user && fallback !== 'ACCESS_DENIED' && (
              <button
                type="button"
                className="t-btn-primary"
                onClick={() => onNavigateToPage && onNavigateToPage(fallback)}
              >
                Aller à mon espace
              </button>
            )}
            {!user && (
              <button
                type="button"
                className="t-btn-primary"
                onClick={() => onNavigateToPage && onNavigateToPage('LOGIN')}
              >
                Se connecter
              </button>
            )}
            {user && (
              <button
                type="button"
                className="t-btn-secondary"
                onClick={async () => {
                  await logout();
                  if (onNavigateToPage) onNavigateToPage('REGISTRATION');
                }}
              >
                Se déconnecter
              </button>
            )}
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigateToPage || (() => {})} />
    </div>
  );
}
