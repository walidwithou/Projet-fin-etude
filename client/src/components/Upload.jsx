import { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Plus, CheckCircle2, ArrowRight, Loader2, AlertCircle, X } from 'lucide-react';
import { therapist } from '../services/api';

export default function Upload({ uploadedFiles, onFileUpload, onRemoveFile, onComplete, isLoading, error }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleSubmit = async () => {
    if (uploadedFiles.length === 0) return;

    setUploading(true);
    setUploadError('');

    try {
      // Build FormData from the uploaded files
      const formData = new FormData();

      // Use the File objects stored in uploadedFiles prop
      // Registration.jsx's handleFileUpload stores { name, type, file, size } where
      // 'file' is the actual File object from the input element
      const fileObjects = uploadedFiles
        .map(f => f.file)
        .filter(Boolean);

      if (fileObjects.length === 0) {
        // Fallback: try reading from the DOM input element
        const fileInput = document.getElementById('file-upload');
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          for (let i = 0; i < fileInput.files.length; i++) {
            formData.append('documents', fileInput.files[i]);
          }
        } else {
          setUploadError('Fichiers non trouvés. Veuillez les sélectionner à nouveau.');
          setUploading(false);
          return;
        }
      } else {
        // Append all actual File objects to FormData
        for (const file of fileObjects) {
          formData.append('documents', file);
        }
      }

      await therapist.uploadDocuments(formData);
      setUploadSuccess(true);
      setUploading(false);
      onComplete();
    } catch (err) {
      setUploadError(err.message || 'Erreur lors du téléchargement');
      setUploading(false);
    }
  };

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
            <div key={i} className="flex items-center justify-between p-3 bg-bg-main border border-border-color rounded-xl transition-colors group hover:border-red-200">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{f.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-mono text-text-muted/40 hidden sm:inline">{f.type}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(i)}
                  className="p-1.5 rounded-lg text-text-muted/30 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Supprimer ce fichier"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {uploadError}
        </div>
      )}

      {uploadSuccess && (
        <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-green-600 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Documents téléchargés avec succès !
        </div>
      )}

      <div className="mt-12 flex justify-end">
        <button 
          disabled={uploadedFiles.length === 0 || uploading}
          onClick={handleSubmit}
          className="t-btn-primary disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Téléchargement...
            </>
          ) : (
            <>
              Finaliser l'inscription
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}