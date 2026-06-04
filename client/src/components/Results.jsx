import { motion } from 'motion/react';
import { UserCheck, Target, ArrowLeft, Shield, Star, MapPin, Globe, Award } from 'lucide-react';

export default function Results({ role, matches, onHome, onSelectTherapist, loading, error }) {
  return (
    <motion.div 
      key="results"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8"
    >
      <div className="text-center mb-12">
        <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center text-white shadow-xl mx-auto mb-6">
          <UserCheck className="w-10 h-10" />
        </div>
        <h2 className="text-4xl font-bold text-text-main mb-4">
          {role === 'PATIENT' ? 'Nous avons trouvé des correspondances !' : 'Inscription terminée avec succès !'}
        </h2>
        <p className="text-lg text-text-muted">
          {role === 'PATIENT' 
            ? 'Voici les thérapeutes qui correspondent le mieux à votre profil et vos besoins.'
            : 'Votre dossier est en cours de vérification par notre équipe médicale. Nous vous contacterons sous 48h.'}
        </p>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-muted font-medium">Recherche des meilleures correspondances...</p>
        </div>
      )}

      {error && (
        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center">
          <p className="text-red-600 font-bold">{error}</p>
        </div>
      )}

      {role === 'PATIENT' && !loading && !error && (
        <div className="grid gap-6">
          {matches.length === 0 ? (
            <div className="p-12 bg-card-bg rounded-3xl border border-border-color text-center">
              <Shield className="w-16 h-16 text-text-muted/30 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-text-main mb-2">Aucun thérapeute trouvé</h3>
              <p className="text-text-muted">Aucun thérapeute ne correspond à vos critères pour le moment. Réessayez plus tard.</p>
            </div>
          ) : (
            matches.map((therapist, i) => (
              <motion.div 
                key={therapist.id || therapist.userId || i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card-bg rounded-3xl p-6 border border-border-color flex flex-col md:flex-row gap-6 items-center shadow-lg hover:shadow-xl transition-all"
              >
                <div className="w-24 h-24 bg-primary-light rounded-2xl flex items-center justify-center text-primary text-3xl font-black shadow-inner border-2 border-card-bg">
                  {therapist.name ? therapist.name.charAt(0).toUpperCase() : 'T'}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-wrap items-center gap-2 mb-1 justify-center md:justify-start">
                    <h3 className="text-xl font-bold text-text-main">{therapist.name || 'Thérapeute'}</h3>
                    <span className="px-2 py-0.5 bg-green-500/10 text-green-600 text-xs font-bold rounded-lg uppercase tracking-wide flex items-center gap-1">
                      <Award className="w-3 h-3" /> Vérifié
                    </span>
                  </div>
                  <p className="text-text-muted font-medium mb-3 flex items-center gap-1 justify-center md:justify-start">
                    {therapist.approcheTherapeute ? (
                      <>
                        <Star className="w-3 h-3 text-primary" />
                        {therapist.approcheTherapeute === 'TCC' && 'Thérapie Cognitivo-Comportementale (TCC)'}
                        {therapist.approcheTherapeute === 'PSYCHANALYSE' && 'Psychanalyse'}
                        {therapist.approcheTherapeute === 'HUMANISTE_GESTALT' && 'Humaniste / Gestalt'}
                        {therapist.approcheTherapeute === 'INTEGRATIVE' && 'Approche Intégrative'}
                      </>
                    ) : ''}
                  </p>
                  {therapist.rating && (
                    <div className="flex items-center gap-1 justify-center md:justify-start mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < Math.floor(therapist.rating) ? 'text-yellow-500 fill-yellow-500' : 'text-text-muted/30'}`} />
                      ))}
                      <span className="text-xs font-bold text-text-muted ml-1">({therapist.rating})</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center md:items-end gap-3 min-w-[140px]">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Target className="w-4 h-4" />
                    <span className="font-bold text-lg">{therapist.compatibility || therapist.matchScore || 0}%</span>
                    <span className="text-[10px] text-text-muted font-medium">Match</span>
                  </div>
                  {therapist.matchReasons && therapist.matchReasons.length > 0 && (
                    <div className="hidden md:flex flex-wrap gap-1 justify-end max-w-[200px]">
                      {therapist.matchReasons.slice(0, 2).map((reason, idx) => (
                        <span key={idx} className="text-[9px] px-2 py-0.5 bg-primary/5 rounded-full text-primary font-medium">{reason}</span>
                      ))}
                    </div>
                  )}
                  <button 
                    onClick={() => onSelectTherapist(therapist)}
                    className="w-full px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] transition-transform hover:shadow-xl"
                  >
                    Consulter
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {role === 'THERAPEUT' && (
        <div className="bg-primary/5 border-2 border-dashed border-primary/30 rounded-3xl p-12 text-center">
          <Shield className="w-16 h-16 text-primary/40 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-primary-dark mb-2">Étape suivante : Validation du diplôme</h3>
          <p className="text-text-muted mb-8">Veuillez préparer votre licence de psychologie ou diplôme de psychiatrie pour la vérification.</p>
          <button className="px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:shadow-primary transition-all">
            Charger mes documents
          </button>
        </div>
      )}

      <div className="flex justify-center mt-12">
        <button onClick={onHome} className="text-primary font-bold flex items-center gap-2 hover:underline transition-all">
          <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
        </button>
      </div>
    </motion.div>
  );
}