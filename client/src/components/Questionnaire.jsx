import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Questionnaire({ 
  questions, 
  step, 
  formData, 
  onSelection, 
  onPrev, 
  onNext, 
  onUpdateFormData,
  role,
  isLoading = false,
  error = ''
}) {
  const currentQuestion = questions[step];

  const handleSelection = (val) => {
    onSelection(val);
  };

  const isNextDisabled = () => {
    if (currentQuestion.type === 'registration') {
      return !formData.nom || !formData.email || formData.motDePasse.length < 4;
    }
    if (currentQuestion.type === 'profile') {
      return !formData.dateOfBirth || !formData.phone || !formData.address;
    }
    const val = formData[currentQuestion.field];
    return !val || (Array.isArray(val) && val.length === 0);
  };

  return (
    <motion.div 
      key="form"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="t-card"
    >
      <div className="flex justify-between items-center mb-12">
        <button onClick={onPrev} disabled={isLoading} className="p-2 hover:bg-primary-light rounded-full transition-colors disabled:opacity-50">
          <ArrowLeft className="w-6 h-6 text-text-muted" />
        </button>
        <div className="flex gap-1.5 flex-1 mx-8">
          {questions.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${i === step ? 'bg-primary' : 'bg-border-color'}`} />
          ))}
        </div>
        <div className="text-xs font-bold text-primary">{step + 1} / {questions.length}</div>
      </div>

      <div className="mb-10">
        <div className="inline-flex items-center gap-2 p-3 bg-primary-light rounded-2xl text-primary mb-4 transition-colors">
          {currentQuestion.icon}
        </div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-2 transition-colors">{currentQuestion.title}</h2>
        <h3 className="text-3xl font-bold leading-tight">{currentQuestion.subtitle}</h3>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-600 text-sm mb-6">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {currentQuestion.type === 'select' ? (
          <div className="relative">
            <select 
              className="t-select pr-12"
              value={formData[currentQuestion.field]}
              onChange={(e) => handleSelection(e.target.value)}
              disabled={isLoading}
            >
              <option value="" className="bg-card-bg">Sélectionnez une option</option>
              {currentQuestion.options.map(opt => <option key={opt} value={opt} className="bg-card-bg">{opt}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-primary">
              <ArrowRight className="w-4 h-4 rotate-90" />
            </div>
          </div>
        ): currentQuestion.type === 'profile' ? (
          <div className="grid gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-primary uppercase mb-1 ml-1">Date de naissance</label>
                <input type="date" className="t-input" value={formData.dateOfBirth} onChange={(e) => onUpdateFormData({ dateOfBirth: e.target.value })} disabled={isLoading} />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-primary uppercase mb-1 ml-1">Sexe</label>
                <select className="t-select" value={formData.gender} onChange={(e) => onUpdateFormData({ gender: e.target.value })} disabled={isLoading}>
                  <option value="HOMME">Homme</option>
                  <option value="FEMME">Femme</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-primary uppercase mb-1 ml-1">Téléphone</label>
              <input type="tel" className="t-input" placeholder="0550123456" value={formData.phone} onChange={(e) => onUpdateFormData({ phone: e.target.value })} disabled={isLoading} />
            </div>
            <div>
              <label className="block text-xs font-bold text-primary uppercase mb-1 ml-1">Adresse</label>
              <input type="text" className="t-input" placeholder="Didouche Mourad" value={formData.address} onChange={(e) => onUpdateFormData({ address: e.target.value })} disabled={isLoading} />
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-primary uppercase mb-1 ml-1">Contact d'urgence</label>
                <input type="text" className="t-input" placeholder="Père" value={formData.emergencyContact} onChange={(e) => onUpdateFormData({ emergencyContact: e.target.value })} disabled={isLoading} />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-primary uppercase mb-1 ml-1">Tel Urgence</label>
                <input type="tel" className="t-input" placeholder="021XXXXXX" value={formData.emergencyPhone} onChange={(e) => onUpdateFormData({ emergencyPhone: e.target.value })} disabled={isLoading} />
              </div>
            </div>
          </div>
        ) : currentQuestion.type === 'registration' ? (
          <div className="grid gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-primary uppercase mb-1 ml-1 transition-colors">Prénom</label>
                <input 
                  type="text" 
                  className="t-input"
                  placeholder="Amine"
                  value={formData.prenom}
                  onChange={(e) => onUpdateFormData({ prenom: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-primary uppercase mb-1 ml-1 transition-colors">Nom</label>
                <input 
                  type="text" 
                  className="t-input"
                  placeholder="Bensmail"
                  value={formData.nom}
                  onChange={(e) => onUpdateFormData({ nom: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-primary uppercase mb-1 ml-1 transition-colors">E-mail</label>
              <input 
                type="email" 
                className="t-input"
                placeholder="exemple@mon-email.dz"
                value={formData.email}
                onChange={(e) => onUpdateFormData({ email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-primary uppercase mb-1 ml-1 transition-colors">Mot de passe</label>
              <input 
                type="password" 
                className="t-input"
                placeholder="••••••••"
                value={formData.motDePasse}
                onChange={(e) => onUpdateFormData({ motDePasse: e.target.value })}
              />
            </div>
            <p className="text-[10px] text-center opacity-60">En continuant, vous acceptez nos conditions générales.</p>
          </div>
        ) : (
          <div className="t-grid-selection">
            {currentQuestion.options.map((opt) => {
              const isSelected = currentQuestion.type === 'multiselect' 
                ? formData[currentQuestion.field]?.includes(opt)
                : formData[currentQuestion.field] === opt;
              
              return (
                <button
                  key={opt}
                  onClick={() => handleSelection(opt)}
                  disabled={isLoading}
                  className={`t-option ${isSelected ? 'selected' : ''} disabled:opacity-50`}
                >
                  <span className="font-medium">{opt}</span>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-12 flex justify-end">
        <button 
          disabled={isNextDisabled()}
          onClick={onNext}
          className="t-btn-primary disabled:opacity-50"
        >
          {isLoading ? 'Enregistrement...' : (step === questions.length - 1 ? (role === 'PATIENT' ? 'S\'inscrire et voir les matchs' : 'S\'inscrire') : 'Continuer')}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}
