import LeafKeyIcon from './LeafKeyIcon';

export default function Footer({ onNavigate }) {
  const handleNav = (section) => {
    onNavigate('ABOUT');
    // Allow page change to complete before scrolling
    setTimeout(() => {
      const element = document.getElementById(section);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <footer className="border-t border-border-color py-16 px-6 bg-card-bg transition-colors">
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 text-center">
        <div className="col-span-1 sm:col-span-2 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => onNavigate('REGISTRATION')}>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <LeafKeyIcon className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-primary-dark">Tassarut</span>
          </div>
          <p className="text-text-muted text-sm leading-relaxed max-w-xs font-medium center-only-mobile">
            La clé de votre santé mentale. Une plateforme citoyenne reliant les Algériens au soutien dont ils ont besoin.
          </p>
        </div>
        <div className="flex flex-col items-center">
          <h4 className="font-bold text-primary text-sm uppercase tracking-widest mb-6">Plateforme</h4>
          <ul className="space-y-4 text-sm font-semibold text-text-muted">
            <li><button onClick={() => handleNav('vision')} className="hover:text-primary hover:underline transition-colors cursor-pointer">Notre Vision</button></li>
            <li><button onClick={() => handleNav('confidentialite')} className="hover:text-primary hover:underline transition-colors cursor-pointer">Confidentialité</button></li>
            <li><button onClick={() => handleNav('therapeutes')} className="hover:text-primary hover:underline transition-colors cursor-pointer">Thérapeutes</button></li>
          </ul>
        </div>
        <div className="flex flex-col items-center">
          <h4 className="font-bold text-primary text-sm uppercase tracking-widest mb-6">Contact</h4>
          <ul className="space-y-4 text-sm font-semibold text-text-muted">
            <li><button onClick={() => handleNav('support')} className="hover:text-primary hover:underline transition-colors cursor-pointer">Support</button></li>
            <li><button onClick={() => handleNav('social')} className="hover:text-primary hover:underline transition-colors cursor-pointer">Social Media</button></li>
            <li><a href="#" className="hover:text-primary hover:underline transition-colors">Tizi Ouzou, Algérie</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-16 pt-8 border-t border-border-color/50 text-center text-[10px] font-bold text-text-muted/40 uppercase tracking-[0.2em]">
        © {new Date().getFullYear()} Tassarut. Fait avec passion pour l'Algérie.
      </div>
    </footer>
  );
}
