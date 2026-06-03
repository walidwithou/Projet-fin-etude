import { motion } from 'motion/react';
import { Shield, Smile, Stethoscope } from 'lucide-react';

export default function Landing({ onSelectRole }) {
  return (
    <motion.div 
      key="landing"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center"
    >
      <div className="t-badge t-badge-accent mb-8 inline-flex items-center gap-2">
        <Shield className="w-3 h-3" /> Plateforme Algérienne Sécurisée
      </div>
      <h1 className="text-5xl md:text-6xl font-bold leading-[1.1] mb-8">
        Ouvrez la porte vers un <span className="text-primary">mieux-être</span> durable.
      </h1>
      <p className="text-xl text-text-muted mb-12 max-w-2xl mx-auto leading-relaxed">
        Rejoignez Tassarut. La clé de votre épanouissement réside dans une rencontre authentique avec le bon professionnel.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <button 
          onClick={() => onSelectRole('PATIENT')}
          className="t-card !bg-primary text-white p-8 overflow-hidden shadow-2xl flex flex-col justify-between h-full hover:scale-[1.02] transition-transform group"
        >
          <div className="relative z-10">
            <Smile className="w-12 h-12 mb-4 opacity-80" />
            <h3 className="text-2xl font-bold mb-2">Je cherche un thérapeute</h3>
            <p className="text-primary-light text-sm leading-relaxed">Répondez à quelques questions pour être mis en relation avec le psychologue idéal.</p>
          </div>
        </button>

        <button 
          onClick={() => onSelectRole('THERAPIST')}
          className="t-card border-2 border-border-color p-8 overflow-hidden flex flex-col justify-between h-full hover:bg-bg-main hover:scale-[1.02] transition-all"
        >
          <div className="relative z-10">
            <Stethoscope className="w-12 h-12 mb-4 text-primary opacity-80" />
            <h3 className="text-2xl font-bold mb-2">Je suis un professionnel</h3>
            <p className="text-text-muted text-sm leading-relaxed">Inscrivez votre cabinet et commencez à accompagner des patients qui correspondent à votre expertise.</p>
          </div>
        </button>
      </div>
    </motion.div>
  );
}
