import { motion } from 'motion/react';
import { UserCheck, Users, Target, ArrowLeft, Shield } from 'lucide-react';

export default function Results({ role, matches, onHome, onSelectTherapist }) {
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

      {role === 'PATIENT' && (
        <div className="grid gap-6">
          {matches.map((therapist, i) => (
            <motion.div 
              key={therapist.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card-bg rounded-3xl p-6 border border-border-color flex flex-col md:flex-row gap-6 items-center shadow-lg hover:shadow-xl transition-all"
            >
              <div className="w-24 h-24 bg-primary-light rounded-2xl flex items-center justify-center text-primary">
                <Users className="w-10 h-10" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-wrap items-center gap-2 mb-1 justify-center md:justify-start">
                  <h3 className="text-xl font-bold text-text-main">{therapist.name}</h3>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-lg uppercase tracking-wide">Vérifié</span>
                </div>
                <p className="text-text-muted font-medium mb-3">{therapist.speciality} • {therapist.wilaya}</p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {therapist.languages.map(l => (
                    <span key={l} className="text-xs font-semibold px-3 py-1 bg-bg-main border border-border-color rounded-full text-text-muted">{l}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center md:items-end gap-3 min-w-[140px]">
                <div className="flex items-center gap-1 text-primary">
                  <Target className="w-4 h-4 fill-current" />
                  <span className="font-bold">{therapist.score}% Match</span>
                </div>
                <button 
                  onClick={() => onSelectTherapist(therapist)}
                  className="w-full px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] transition-transform"
                >
                  Consulter
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {role === 'THERAPEUTE' && (
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
