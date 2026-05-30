import { ChevronDown, ChevronRight, Calendar, FileText, Star } from 'lucide-react';

export default function PastTherapist({ therapist, isExpanded, onClick }) {
  if (!therapist) return null;

  return (
    <div 
      onClick={onClick}
      className={`t-card cursor-pointer border hover:border-primary/40 transition-all duration-300 select-none ${
        isExpanded 
          ? 'ring-2 ring-primary/10 border-primary bg-primary/[0.01]' 
          : 'border-border-color hover:translate-y-[-2px] bg-card-bg'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Therapist Meta */}
        <div className="flex items-center gap-4 text-left">
          <div className="w-14 h-14 bg-primary-light rounded-2xl flex items-center justify-center text-primary font-black text-2xl shadow-inner border-2 border-card-bg shrink-0 overflow-hidden">
            {therapist.avatarUrl ? (
              <img 
                src={therapist.avatarUrl} 
                alt={therapist.name} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : (
              therapist.name.replace(/^(Dr\.|Mme|Mr\.)\s*/i, '').charAt(0) || 'T'
            )}
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-text-main text-base leading-none flex items-center gap-2">
              {therapist.name}
              {therapist.rating && (
                <span className="flex items-center gap-0.5 text-xs text-amber-500 font-bold bg-amber-500/5 px-2 py-0.5 rounded-full">
                  <Star size={10} className="fill-current" /> {therapist.rating}
                </span>
              )}
            </h4>
            <p className="text-primary text-xs font-bold uppercase tracking-wider">{therapist.speciality}</p>
            <p className="text-[10px] text-text-muted font-semibold">{therapist.wilaya || '16 - Alger'}</p>
          </div>
        </div>

        {/* Info Stats & Action Trigger */}
        <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-border-color">
          <div className="flex gap-4 text-left">
            {therapist.sessionCount && (
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider text-text-muted font-bold block">Séances</span>
                <span className="text-xs font-black text-text-main flex items-center gap-1">
                  <FileText size={12} className="text-primary/70 shrink-0" /> {therapist.sessionCount}
                </span>
              </div>
            )}
            {therapist.lastSessionDate && (
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider text-text-muted font-bold block">Dernière séance</span>
                <span className="text-xs font-black text-text-main flex items-center gap-1">
                  <Calendar size={12} className="text-primary/70 shrink-0" /> {therapist.lastSessionDate}
                </span>
              </div>
            )}
          </div>

          <div className={`p-2 rounded-xl border border-border-color bg-bg-main transition-transform ${isExpanded ? 'rotate-180 border-primary text-primary' : 'text-text-muted'}`}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </div>
      </div>
    </div>
  );
}
