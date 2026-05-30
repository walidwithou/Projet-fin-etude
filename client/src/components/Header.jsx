import { useState } from 'react';
import { User, Settings, HelpCircle, LogOut, ChevronDown, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LeafKeyIcon from './LeafKeyIcon';

export default function Header({ onLogin, onAbout, onHome, user, onLogout, onNavigateToPage }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="fixed top-0 w-full bg-card-bg/80 backdrop-blur-md border-b border-border-color z-50 px-6 py-3 flex justify-between items-center transition-all">
      <div className="flex items-center gap-2 cursor-pointer" onClick={onHome}>
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <LeafKeyIcon className="w-6 h-6" />
        </div>
        <span className="text-xl font-bold tracking-tight text-primary-dark hidden sm:block">Tassarut</span>
      </div>
      
      <div className="flex items-center gap-4">
        

        {user ? (
          <div className="relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-bg-main transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center text-primary font-bold overflow-hidden shadow-inner border border-primary/10">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-xs">{user.name?.charAt(0) || 'U'}</span>
                )}
              </div>
              <ChevronDown size={14} className={`text-text-muted transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProfileOpen(false)} 
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-72 bg-card-bg rounded-2xl shadow-2xl border border-border-color z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-border-color">
                      <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-bg-main transition-colors">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold overflow-hidden">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            user.name?.charAt(0) || 'U'
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{user.name || 'Utilisateur'}</p>
                          <p className="text-xs text-text-muted">Voir votre profil</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      <button 
                        onClick={() => { onNavigateToPage('SETTINGS', { tab: 'account' }); setIsProfileOpen(false); }}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-bg-main transition-all group"
                      >
                        <div className="flex items-center gap-3 font-bold text-sm">
                          <div className="p-2 bg-bg-main rounded-full group-hover:bg-card-bg transition-colors">
                            <Settings size={18} />
                          </div>
                          Paramètres et confidentialité
                        </div>
                        <ChevronDown size={16} className="-rotate-90 text-text-muted" />
                      </button>

                      <button 
                        onClick={() => { onNavigateToPage('SETTINGS', { tab: 'help' }); setIsProfileOpen(false); }}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-bg-main transition-all group"
                      >
                        <div className="flex items-center gap-3 font-bold text-sm">
                          <div className="p-2 bg-bg-main rounded-full group-hover:bg-card-bg transition-colors">
                            <HelpCircle size={18} />
                          </div>
                          Aide et assistance
                        </div>
                        <ChevronDown size={16} className="-rotate-90 text-text-muted" />
                      </button>

                      <button 
                        onClick={() => { onNavigateToPage('SETTINGS', { tab: 'display' }); setIsProfileOpen(false); }}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-bg-main transition-all group"
                      >
                        <div className="flex items-center gap-3 font-bold text-sm">
                          <div className="p-2 bg-bg-main rounded-full group-hover:bg-card-bg transition-colors">
                            <Moon size={18} />
                          </div>
                          Affichage et accessibilité
                        </div>
                        <ChevronDown size={16} className="-rotate-90 text-text-muted" />
                      </button>

                      <button 
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-red-600 transition-all font-bold text-sm group"
                      >
                        <div className="p-2 bg-bg-main rounded-full group-hover:bg-card-bg transition-colors">
                          <LogOut size={18} />
                        </div>
                        Se déconnecter
                      </button>
                    </div>
                    
                    <div className="p-4 bg-bg-main text-[10px] text-text-muted font-medium flex flex-wrap gap-2">
                      <span>Confidentialité</span> • <span>Conditions</span> • <span>Publicités</span> • <span>Plus</span>
                      <p className="mt-1">Tassarut © 2024</p>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        ) : (

          <><button
            onClick={onAbout}
            className="text-sm font-semibold text-text-muted hover:text-primary transition-colors cursor-pointer hidden sm:block"
          >
            À propos
          </button><button
            onClick={onLogin}
            className="px-5 py-2.5 bg-primary-light text-primary rounded-full text-sm font-bold hover:bg-primary hover:text-white transition-all cursor-pointer"
          >
            Connexion
          </button></>
        )}
      </div>
    </header>
  );
}
