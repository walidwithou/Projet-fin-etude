import { motion } from 'motion/react';
import { Heart, Target, Shield, Users, MessageCircle, Share2, HelpCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FAQItem from '../components/FAQItem';

export default function About({ onNavigateToPage }) {
  const faqs = [
    {
      question: "Est-ce que Tassarut est gratuit ?",
      answer: "Tassarut est une organisation à but non lucratif. L'utilisation de la plateforme pour la mise en relation est gratuite. Les honoraires des séances sont fixés par les thérapeutes, mais nous travaillons activement à établir des partenariats pour proposer des tarifs solidaires."
    },
    {
      question: "Comment mes données sont-elles protégées ?",
      answer: "La confidentialité est notre priorité absolue. Vos échanges et données personnelles sont chiffrés et ne sont jamais partagés avec des tiers à des fins commerciales. Seul votre thérapeute a accès aux informations cliniques nécessaires."
    },
    {
      question: "Les thérapeutes sont-ils qualifiés ?",
      answer: "Oui, chaque professionnel inscrit sur Tassarut fait l'objet d'une vérification rigoureuse de ses diplômes (Licence/Master en psychologie ou Doctorat en psychiatrie). Nous validons manuellement chaque dossier."
    },
    {
      question: "Comment se déroulent les séances ?",
      answer: "Les séances peuvent se dérouler en présentiel, par visioconférence, audio ou chat, selon vos préférences et les disponibilités du thérapeute choisi."
    }
  ];

  return (
    <div className="min-h-screen bg-bg-main text-text-main font-sans selection:bg-primary-light">
      <Header 
        onLogin={() => onNavigateToPage('LOGIN')} 
        onAbout={() => onNavigateToPage('ABOUT')}
        onHome={() => onNavigateToPage('REGISTRATION')} 
        onNavigateToPage={onNavigateToPage}
      />

      <main className="pt-24 pb-12">
        {/* Intro Section */}
        <section className="px-6 max-w-4xl mx-auto text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="t-badge t-badge-accent mb-6">À propos de Tassarut</div>
            <h1 className="text-5xl font-bold mb-8 leading-tight">
              Rendre la thérapie <span className="text-primary">accessible</span> à chaque Algérien.
            </h1>
            <p className="text-xl text-text-muted leading-relaxed font-medium">
              Tassarut est une organisation algérienne à but non lucratif qui vise à briser les tabous 
              et à faciliter l'accès au soutien psychologique en Algérie grâce à la technologie.
            </p>
          </motion.div>
        </section>

        {/* Vision Section */}
        <section id="vision" className="px-6 py-12 bg-card-bg border-y border-border-color transition-colors">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <Heart className="w-12 h-12 text-primary mb-6" />
                <h2 className="text-3xl font-bold mb-4">Notre Vision</h2>
                <p className="text-text-muted leading-relaxed mb-6 font-medium">
                  Nous croyons que la santé mentale ne devrait pas être un luxe. Notre plateforme connecte 
                  les citoyens avec des professionnels qualifiés, en optimisant la mise en relation 
                  pour garantir un accompagnement personnalisé et efficace.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span className="font-bold text-sm">Démocratisation de l'accès aux soins</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span className="font-bold text-sm">Soutien aux jeunes diplômés algériens</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span className="font-bold text-sm">Réduction des coûts de consultation</span>
                  </li>
                </ul>
              </div>
              <div className="t-card bg-primary/5 border-primary/20 rotate-1">
                <Target className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Impact Social</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Chaque mise en relation réussite contribue à bâtir une société algérienne plus 
                  résiliente et épanouie. Nous mesurons notre succès par le nombre de vies 
                  positivement impactées.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Confidentialité Section */}
        <section id="confidentialite" className="px-6 py-12 border-b border-border-color">
          <div className="max-w-4xl mx-auto text-center">
            <Shield className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-6">Confidentialité & Sécurité</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-5 bg-card-bg rounded-2xl border border-border-color">
                <h4 className="font-bold mb-2 text-primary">Anonymat</h4>
                <p className="text-sm text-text-muted">Vos données ne sont visibles que par votre thérapeute.</p>
              </div>
              <div className="p-5 bg-card-bg rounded-2xl border border-border-color">
                <h4 className="font-bold mb-2 text-primary">Chiffrement</h4>
                <p className="text-sm text-text-muted">Des protocoles SSL de pointe protègent vos échanges.</p>
              </div>
              <div className="p-5 bg-card-bg rounded-2xl border border-border-color">
                <h4 className="font-bold mb-2 text-primary">Zéro Pub</h4>
                <p className="text-sm text-text-muted">Aucune donnée n'est revendue à des annonceurs.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Thérapeutes Section */}
        <section id="therapeutes" className="px-6 py-16 bg-primary text-white overflow-hidden">
          <div className="max-w-4xl mx-auto relative">
            <Users className="w-64 h-64 absolute -right-20 -top-20 opacity-10" />
            <h2 className="text-4xl font-bold mb-8">Nos Thérapeutes</h2>
            <p className="text-xl text-primary-light mb-12 max-w-2xl leading-relaxed">
              Nous collaborons avec des psychologues et psychiatres passionnés, tous enregistrés auprès 
              des autorités compétentes en Algérie. Ils partagent notre vision d'un accès universel 
              à la santé mentale.
            </p>
            <button 
              onClick={() => onNavigateToPage('REGISTRATION')} 
              className="px-8 py-4 bg-bg-main text-primary rounded-2xl font-bold hover:scale-105 transition-all shadow-xl"
            >
              Rejoindre en tant que praticien
            </button>
          </div>
        </section>

        {/* Support Section */}
        <section id="support" className="px-6 py-12 bg-card-bg border-b border-border-color transition-colors">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row gap-12 items-center">
              <div className="flex-1">
                <MessageCircle className="w-12 h-12 text-primary mb-6" />
                <h2 className="text-3xl font-bold mb-4">Support & Aide</h2>
                <p className="text-text-muted leading-relaxed font-medium">
                  Besoin d'aide pour utiliser la plateforme ou d'informations complémentaires ? 
                  Notre équipe est disponible pour vous accompagner dans votre démarche de soin.
                </p>
              </div>
              <div className="shrink-0 w-full md:w-auto">
                <a href="mailto:support@tassarut.dz" className="t-btn-primary !w-full md:!w-auto">
                  Nous contacter
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Social Media Section */}
        <section id="social" className="px-6 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <Share2 className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-6">Suivez-nous</h2>
            <p className="text-text-muted mb-8 font-medium">Rejoignez notre communauté sur les réseaux sociaux pour plus de conseils sur la santé mentale.</p>
            <div className="flex justify-center gap-4">
              {['Instagram', 'Facebook', 'LinkedIn', 'Twitter'].map(social => (
                <a key={social} href="#" className="px-5 py-2.5 bg-card-bg border border-border-color rounded-xl font-bold hover:border-primary hover:text-primary transition-all text-sm">
                  {social}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-6 py-16 bg-card-bg border-t border-border-color transition-colors">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-12">
              <HelpCircle className="w-10 h-10 text-primary" />
              <h2 className="text-3xl font-bold">Questions fréquentes</h2>
            </div>
            <div className="t-card p-0 overflow-hidden">
              <div className="px-10 divide-y divide-border-color">
                {faqs.map((faq, index) => (
                  <FAQItem key={index} question={faq.question} answer={faq.answer} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigateToPage} />
    </div>
  );
}
