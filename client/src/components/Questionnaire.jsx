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
  role 
}) {
  const currentQuestion = questions[step];

  const handleSelection = (val) => {
    onSelection(val);
  };

  const isNextDisabled = () => {
    if (currentQuestion.type === 'registration') {
      return !formData.nom || !formData.email || formData.motDePasse.length < 4;
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
        <button onClick={onPrev} className="p-2 hover:bg-primary-light rounded-full transition-colors">
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

      <div className="space-y-3">
        {currentQuestion.type === 'select' ? (
          <div className="relative">
            <select 
              className="t-select pr-12"
              value={formData[currentQuestion.field]}
              onChange={(e) => handleSelection(e.target.value)}
            >
              <option value="" className="bg-card-bg">Sélectionnez une option</option>
              {currentQuestion.options.map(opt => <option key={opt} value={opt} className="bg-card-bg">{opt}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-primary">
              <ArrowRight className="w-4 h-4 rotate-90" />
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
                  className={`t-option ${isSelected ? 'selected' : ''}`}
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
          className="t-btn-primary"
        >
          {step === questions.length - 1 ? (role === 'PATIENT' ? 'S\'inscrire et voir les matchs' : 'S\'inscrire') : 'Continuer'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}
