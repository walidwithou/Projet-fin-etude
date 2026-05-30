import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ChevronDown, Clock, Star } from 'lucide-react';
import SessionReport from './SessionReport';

export default function PastSessionsList({ sessions }) {
  const [activeSessionId, setActiveSessionId] = useState(null);

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-text-muted font-bold">
        Aucune séance enregistrée pour ce thérapeute.
      </div>
    );
  }

  const handleToggleSession = (sessionId) => {
    setActiveSessionId(prev => (prev === sessionId ? null : sessionId));
  };

  return (
    <div className="space-y-3 pl-4 md:pl-6 border-l-2 border-border-color/60 ml-6 md:ml-10 py-1">
      <h5 className="text-[10px] uppercase font-black tracking-widest text-text-muted mb-2">Historique des séances de ce praticien</h5>
      <div className="space-y-3">
        {sessions.map((session) => {
          const isExpanded = activeSessionId === session.id;
          return (
            <div key={session.id} className="border border-border-color rounded-2xl overflow-hidden bg-bg-main/25">
              {/* Compact session trigger row */}
              <div 
                onClick={() => handleToggleSession(session.id)}
                className={`p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-bg-main leading-none transition-colors select-none ${
                  isExpanded ? 'bg-bg-main border-b border-border-color' : ''
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 md:gap-3 text-left">
                  <div className="flex items-center gap-1.5 text-xs text-text-main font-bold">
                    <Calendar size={13} className="text-primary/70 shrink-0" />
                    <span>{session.date}</span>
                  </div>
                  <span className="text-[10px] text-text-muted leading-none">•</span>
                  <div className="flex items-center gap-1 text-xs text-text-muted font-bold">
                    <Clock size={13} className="text-text-muted/60 shrink-0" />
                    <span>{session.duration}</span>
                  </div>
                  {session.status && (
                    <>
                      <span className="text-[10px] text-text-muted leading-none">•</span>
                      <span className="text-[10px] font-black uppercase text-primary tracking-wider">{session.status}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {session.rated ? (
                    <div className="flex gap-0.5 text-yellow-500">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          size={12} 
                          className={i < session.rating ? 'fill-current' : 'opacity-20'} 
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-[9px] uppercase tracking-wider font-extrabold bg-amber-500/10 text-amber-600 px-2 py-1 rounded-full border border-amber-500/15 animate-pulse">
                      À évaluer
                    </span>
                  )}
                  <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180 text-primary' : ''}`} />
                </div>
              </div>

              {/* Accordion container for SessionReport */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <div className="p-4 md:p-6 bg-card-bg">
                      <SessionReport session={session} isEmbedded={true} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
