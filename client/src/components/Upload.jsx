import { motion } from 'motion/react';
import { Shield, Plus, CheckCircle2, ArrowRight } from 'lucide-react';

export default function Upload({ uploadedFiles, onFileUpload, onComplete }) {
  return (
    <motion.div 
      key="upload"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="t-card"
    >
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 p-3 t-badge-accent rounded-2xl text-primary mb-4 transition-colors">
          <Shield className="w-6 h-6" />
        </div>
        <h2 className="text-3xl font-bold mb-2 text-text-main">Vérification des diplômes</h2>
        <p className="text-text-muted font-medium">Veuillez charger votre licence de psychologue ou tout document attestant de votre qualification.</p>
      </div>

      <div 
        className="t-upload-zone"
        onClick={() => document.getElementById('file-upload').click()}
      >
        <input 
          id="file-upload"
          type="file" 
          multiple 
          className="hidden" 
          onChange={onFileUpload}
          accept=".pdf,.jpg,.jpeg,.png"
        />
        <div className="text-center">
          <Plus className="w-12 h-12 text-primary mx-auto mb-4 opacity-50 transition-colors" />
          <p className="font-bold text-lg mb-1">Cliquez ou glissez vos fichiers ici</p>
          <p className="text-sm opacity-60">Formats acceptés : PDF, PNG, JPG (Max 5MB)</p>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-8 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 font-mono transition-colors">Fichiers sélectionnés</h4>
          {uploadedFiles.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-bg-main border border-border-color rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">{f.name}</span>
              </div>
              <span className="text-[10px] font-mono text-text-muted/40">{f.type}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 flex justify-end">
        <button 
          disabled={uploadedFiles.length === 0}
          onClick={onComplete}
          className="t-btn-primary"
        >
          Finaliser l'inscription
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}
