import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  Video, 
  Phone,
  Star,
  Award,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function TherapistProfile({ 
  therapist, 
  onBack, 
  onConfirm, 
  confirmLoading = false, 
  confirmError = '', 
  confirmSuccess = false 
}) {
  if (!therapist) return null;

  // Map approach code to display label
  const getApproachLabel = (approach) => {
    const labels = {
      'TCC': 'Thérapie Cognitivo-Comportementale (TCC)',
      'PSYCHANALYSE': 'Psychanalyse',
      'HUMANISTE_GESTALT': 'Humaniste / Gestalt',
      'INTEGRATIVE': 'Approche Intégrative',
    };
    return labels[approach] || approach || 'Non spécifié';
  };

  // Map sensitivity code to display label
  const getSensitivityLabel = (sensitivity) => {
    const labels = {
      'INTEGRE_DEMANDE': 'Intègre les dimensions culturelles à la demande',
      'LAIQUE_NEUTRE': 'Approche strictement laïque et neutre',
      'AUTRE': 'Autre',
    };
    return labels[sensitivity] || sensitivity || 'Non spécifié';
  };

  const getGenderLabel = (gender) => {
    if (!gender) return 'Non spécifié';
    const labels = { 'HOMME': 'Homme', 'FEMME': 'Femme', 'AUTRE': 'Autre' };
    return labels[gender.toUpperCase()] || gender;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-primary font-bold hover:underline mb-4 transition-all"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux résultats
      </button>

      {confirmError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-red-600 font-medium text-sm">{confirmError}</p>
        </div>
      )}

      {confirmSuccess && (
        <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-2xl text-center">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-green-700 mb-1">Mise en relation confirmée !</h3>
          <p className="text-green-600 text-sm">Redirection vers votre espace patient...</p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column: Info Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="t-card p-6 text-center">
            <div className="w-32 h-32 bg-primary-light rounded-3xl flex items-center justify-center text-primary mx-auto mb-4 border-4 border-card-bg shadow-inner transition-colors">
              <span className="text-4xl font-black">
                {therapist.name ? therapist.name.charAt(0).toUpperCase() : 'T'}
              </span>
            </div>
            <h2 className="text-2xl font-bold mb-1">{therapist.name || 'Thérapeute'}</h2>
            <p className="text-primary font-semibold mb-3 text-sm">{getApproachLabel(therapist.approcheTherapeute)}</p>
            
            <div className="flex items-center justify-center gap-1 text-yellow-500 mb-4">
              {therapist.rating ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < Math.floor(therapist.rating) ? 'fill-current' : 'opacity-30'}`} />
                  ))}
                  <span className="text-xs font-bold text-text-muted ml-1">({therapist.rating.toFixed(1)})</span>
                </>
              ) : (
                <span className="text-xs text-text-muted">Pas encore d'évaluations</span>
              )}
            </div>

            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm font-medium text-text-muted">
                <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                Diplôme vérifié par Tassarut
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-text-muted">
                <Award className="w-4 h-4 text-primary shrink-0" />
                {getGenderLabel(therapist.gender)}
              </div>
            </div>
          </div>

          <div className="t-card p-6">
            <h4 className="font-bold mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Informations
            </h4>
            <div className="space-y-4">
              {therapist.approcheTherapeute && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Approche</span>
                  <p className="text-sm font-medium">{getApproachLabel(therapist.approcheTherapeute)}</p>
                </div>
              )}
              {therapist.sensibiliteTherapeute && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Sensibilité</span>
                  <p className="text-sm font-medium">{getSensitivityLabel(therapist.sensibiliteTherapeute)}</p>
                </div>
              )}
              {therapist.gender && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Genre</span>
                  <p className="text-sm font-medium">{getGenderLabel(therapist.gender)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="t-card p-6">
            <h4 className="font-bold mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Tarifs
            </h4>
            <div className="space-y-2">
              {therapist.hourlyRate ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-text-muted">Consultation</span>
                    <span className="font-bold text-primary">
                      {parseFloat(therapist.hourlyRate).toLocaleString()} {therapist.currency || 'DZD'}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted opacity-60 italic mt-2">
                    * Les tarifs peuvent varier selon le mode de consultation.
                  </p>
                </>
              ) : (
                <p className="text-sm text-text-muted">Tarif non spécifié</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Content & Booking */}
        <div className="md:col-span-2 space-y-6">
          {therapist.bio && (
            <div className="t-card">
              <h3 className="text-xl font-bold mb-4">À propos</h3>
              <p className="text-text-muted leading-relaxed mb-6 font-medium">
                {therapist.bio}
              </p>
            </div>
          )}

          {therapist.matchReasons && therapist.matchReasons.length > 0 && (
            <div className="t-card">
              <h3 className="text-xl font-bold mb-4">Raisons de la correspondance</h3>
              <div className="space-y-2">
                {therapist.matchReasons.map((reason, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-text-main">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="t-card border-2 border-primary/10 shadow-xl shadow-primary/5">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
                <Star className="w-4 h-4 text-primary fill-current" />
                <span className="font-bold text-primary">
                  {therapist.compatibility || therapist.matchScore || 0}% de compatibilité
                </span>
              </div>
              <p className="text-text-muted text-sm">
                Ce thérapeute correspond à vos critères de recherche.
              </p>
            </div>

            <div className="space-y-6">
              <button 
                onClick={() => onConfirm(therapist)}
                disabled={confirmLoading || confirmSuccess}
                className="t-btn-primary w-full py-5 rounded-2xl shadow-2xl shadow-primary/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {confirmLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Confirmation en cours...
                  </>
                ) : confirmSuccess ? (
                  <>
                    <Check className="w-5 h-5" />
                    Confirmé
                  </>
                ) : (
                  'Confirmer ma demande de mise en relation'
                )}
              </button>
              <p className="text-center text-[10px] text-text-muted font-medium italic">
                * Le thérapeute recevra votre profil anonymisé pour valider la demande.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}