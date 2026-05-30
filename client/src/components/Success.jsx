import { motion } from 'motion/react';
import { CheckCircle2, Users, ArrowLeft } from 'lucide-react';

export default function Success({ role, userName, onNext, onHome }) {
  return (
    <motion.div 
      key="success"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center bg-card-bg rounded-[3rem] p-16 border border-border-color shadow-2xl transition-colors"
    >
      <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center text-green-600 mx-auto mb-8 shadow-inner border border-green-500/20">
        <CheckCircle2 className="w-12 h-12" />
      </div>
      <h2 className="text-4xl font-bold mb-4 text-text-main">Bienvenue sur Tassarut, {userName} !</h2>
      <p className="text-xl text-text-muted mb-12 leading-relaxed font-medium">
        {role === 'PATIENT' 
          ? "Votre compte a été créé avec succès. Vous pouvez maintenant découvrir les praticiens qui correspondent à votre profil."
          : "Votre dossier d'inscription a bien été reçu. Nos experts procéderont à la vérification de vos documents sous 48 heures ouvrées."}
      </p>
      
      <div className="flex flex-col md:flex-row gap-4 justify-center">
        {role === 'PATIENT' ? (
          <button 
            onClick={onNext}
            className="t-btn-primary mx-auto"
          >
            Voir mes correspondances
            <Users className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={onHome}
            className="t-btn-primary mx-auto"
          >
            Retour à l'accueil
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
