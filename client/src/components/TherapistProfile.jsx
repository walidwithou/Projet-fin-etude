import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  MessageSquare, 
  Video, 
  Phone,
  Star,
  Award,
  Wallet
} from 'lucide-react';

export default function TherapistProfile({ therapist, onBack, onConfirm }) {
  if (!therapist) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-primary font-bold hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux résultats
      </button>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column: Info Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="t-card p-6 text-center">
            <div className="w-32 h-32 bg-primary-light rounded-3xl flex items-center justify-center text-primary mx-auto mb-4 border-4 border-card-bg shadow-inner transition-colors">
              <span className="text-4xl font-black">{therapist.name.charAt(4)}</span>
            </div>
            <h2 className="text-2xl font-bold mb-1">{therapist.name}</h2>
            <p className="text-primary font-semibold mb-3">{therapist.speciality}</p>
            
            <div className="flex items-center justify-center gap-1 text-yellow-500 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < Math.floor(therapist.rating) ? 'fill-current' : ''}`} />
              ))}
              <span className="text-xs font-bold text-text-muted ml-1">({therapist.rating})</span>
            </div>

            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm font-medium text-text-muted">
                <MapPin className="w-4 h-4 text-primary" />
                {therapist.wilaya}
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-text-muted">
                <ShieldCheck className="w-4 h-4 text-green-500" />
                Diplôme vérifié par Tassarut
              </div>
            </div>
          </div>

          <div className="t-card p-6">
            <h4 className="font-bold mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" /> Tarifs
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-text-muted">Consultation standard</span>
                <span className="font-bold text-primary">3500 DA</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-primary/5 rounded-xl border border-primary/10">
                <span className="text-xs font-bold text-primary italic">Tarif Solidaire *</span>
                <span className="font-bold text-primary">1500 DA</span>
              </div>
              <p className="text-[10px] text-text-muted opacity-60 leading-relaxed">
                * Réservé aux étudiants et personnes à revenus limités sous conditions.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Content & Booking */}
        <div className="md:col-span-2 space-y-6">
          <div className="t-card">
            <h3 className="text-xl font-bold mb-4">À propos</h3>
            <p className="text-text-muted leading-relaxed mb-6 font-medium">
              Spécialisé en {therapist.speciality}, j'accompagne mes patients dans une démarche bienveillante et structurée. 
              Mon approche est centrée sur l'écoute active et la recherche de solutions concrètes pour surmonter les 
              épreuves de la vie quotidienne, le stress et les troubles anxieux.
            </p>
            
            <h4 className="font-bold mb-4">Expertise</h4>
            <div className="flex flex-wrap gap-2 mb-8">
              {['Anxiété', 'Dépression', 'Gestion du stress', 'Couple', 'Traumas'].map(tag => (
                <span key={tag} className="t-badge t-badge-accent">{tag}</span>
              ))}
            </div>

            <h4 className="font-bold mb-4">Modes de consultation</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-2 p-4 bg-bg-main rounded-2xl border border-border-color">
                <Video className="w-6 h-6 text-primary" />
                <span className="text-xs font-bold">Vidéo</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-bg-main rounded-2xl border border-border-color opacity-50">
                <MessageSquare className="w-6 h-6 text-primary" />
                <span className="text-xs font-bold">Chat</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-bg-main rounded-2xl border border-border-color">
                <Phone className="w-6 h-6 text-primary" />
                <span className="text-xs font-bold">Audio</span>
              </div>
            </div>
          </div>

          <div className="t-card border-2 border-primary/10 shadow-xl shadow-primary/5">

            <div className="space-y-6">
              <button 
                onClick={() => onConfirm(therapist)}
                className="t-btn-primary w-full mt-6 py-5 rounded-2xl shadow-2xl shadow-primary/40 cursor-pointer"
              >
                Confirmer ma demande de mise en relation
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
