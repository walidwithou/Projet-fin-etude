import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, ArrowLeft, Shield } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LeafKeyIcon from '../components/LeafKeyIcon';
import { auth, setToken } from '../services/api';

export default function Login({ onBackToRegistration, onNavigateToPage }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await auth.login(formData.email, formData.password);
      setToken(response.data.token);
      setSuccess(true);
      
      const role = response.data.user.role.toUpperCase();
      const nextPage = role === 'PATIENT' ? 'PATIENT' : role === 'THERAPIST' ? 'THERAPIST' : 'ADMIN';
      
      setTimeout(() => {
        onNavigateToPage(nextPage, { role });
      }, 1500);
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
      setIsLoading(false);
    }
  };

  const currentOnNavigate = onNavigateToPage || (() => {});

  return (
    <div className="min-h-screen bg-bg-main text-text-main font-sans selection:bg-primary-light">
      <Header 
        onLogin={() => {}} 
        onAbout={() => currentOnNavigate('ABOUT')}
        onHome={() => currentOnNavigate('REGISTRATION')}
        onNavigateToPage={currentOnNavigate}
      />

      <main className="pt-32 pb-20 px-6 max-w-lg mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="t-card"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-primary-light rounded-2xl flex items-center justify-center text-primary mx-auto mb-6">
              <LeafKeyIcon className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Bon retour !</h1>
            <p className="text-text-muted">Connectez-vous pour accéder à votre espace Tassarut.</p>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-600 text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary opacity-40" />
                  <input 
                    type="email" 
                    className="t-input pl-12"
                    placeholder="votre@email.dz"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary ml-1">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary opacity-40" />
                  <input 
                    type="password" 
                    className="t-input pl-12"
                    placeholder="••••••••"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-border-color text-primary focus:ring-primary" />
                  <span className="text-sm font-medium text-text-muted group-hover:text-primary transition-colors">Se souvenir de moi</span>
                </label>
                <a href="#" className="text-sm font-bold text-primary hover:underline">Oublié ?</a>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="t-btn-primary w-full disabled:opacity-50"
              >
                {isLoading ? 'Connexion...' : 'Se connecter'}
                {!isLoading && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                <Shield className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-primary mb-2">Bienvenue !</h2>
              <p className="text-text-muted font-medium">Connexion réussie. Redirection...</p>
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-border-color text-center space-y-4">
            <p className="text-sm text-text-muted">
              Pas encore de compte ?
            </p>
            <button 
              onClick={onBackToRegistration}
              className="flex items-center gap-2 text-primary font-bold hover:underline mx-auto transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Créer un compte gratuitement
            </button>
          </div>
        </motion.div>

        <div className="mt-12 flex items-center justify-center gap-2 text-text-muted/60">
          <Shield className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Connexion chiffrée SSL</span>
        </div>
      </main>

      <Footer onNavigate={currentOnNavigate} />
    </div>
  );
}
