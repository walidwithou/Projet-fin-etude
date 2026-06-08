import { Star } from 'lucide-react';

export default function SessionReport({ session, isEmbedded = false, onBack = null }) {
  if (!session) return null;

  return (
    <div className={`space-y-6 ${isEmbedded ? 'p-6 bg-card-bg/60 border border-border-color rounded-2xl' : 't-card'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          {onBack && (
            <button 
              onClick={onBack}
              className="text-xs font-bold text-primary hover:underline mb-2 flex items-center gap-1"
            >
              ← Retour au compte-rendu
            </button>
          )}
          <h3 className="text-lg md:text-xl font-bold text-text-main">Compte-rendu de séance</h3>
          <p className="text-primary text-xs font-bold mt-1">
            {session.date} • {session.duration} {session.status && `• ${session.status}`}
          </p>
        </div>
        {session.rated && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-0.5 text-yellow-500">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  size={14} 
                  className={i < session.rating ? 'fill-current' : 'opacity-20'} 
                />
              ))}
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">Avis publié</span>
          </div>
        )}
      </div>

      {session.rated && session.note && (
        <div className="p-4 bg-bg-main rounded-2xl border border-border-color border-l-4 border-l-amber-500 text-left">
          <h5 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Votre commentaire</h5>
          <p className="text-xs text-text-main italic font-semibold">"{session.note}"</p>
        </div>
      )}

      <div className="space-y-6 text-left">
        <div>
          <h4 className="text-[11px] font-black uppercase tracking-wider text-primary mb-2">Résumé de la séance</h4>
          <p className="p-4 bg-bg-main/60 rounded-2xl border border-border-color text-xs leading-relaxed font-semibold text-text-main">
            {session.report?.summary || "Résumé non disponible."}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-primary mb-2">Exercices (À faire)</h4>
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl text-xs font-bold text-primary italic leading-relaxed">
              {session.report?.homework || "Aucun exercice spécifique pour cette séance."}
            </div>
          </div>
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-primary mb-2">Prochains objectifs</h4>
            <ul className="space-y-2">
              {(session.report?.nextGoals || []).length > 0 ? (
                (session.report?.nextGoals || []).map((goal, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs font-bold text-text-muted">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />
                    <span>{goal}</span>
                  </li>
                ))
              ) : (
                <li className="text-xs text-text-muted italic font-medium">Aucun objectif défini.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

   
    </div>
  );
}
