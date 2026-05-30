import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, ArrowLeft, Image as ImageIcon, X } from 'lucide-react';

export default function ChatWidget({ therapist, initialMessages = [], onBack }) {
  const [messages, setMessages] = useState(initialMessages.length > 0 ? initialMessages : [
    { id: 1, text: "Bonjour ! Comment vous sentez-vous aujourd'hui ?", sender: 'therapist', time: '10:00' },
    { id: 2, text: "Je me sens un peu anxieux par rapport au travail.", sender: 'patient', time: '10:05' },
    { id: 3, text: "C'est tout à fait compréhensible. Nous en parlerons lors de notre prochaine séance demain.", sender: 'therapist', time: '10:07' },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const lastScrollHeight = useRef(0);

  const scrollToBottom = (behavior = "smooth") => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior
        });
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // Limit to max 120px height
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  const handleLoadMore = () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    
    // Store current scroll height before updating messages
    if (scrollContainerRef.current) {
      lastScrollHeight.current = scrollContainerRef.current.scrollHeight;
    }

    // Simulate API delay
    setTimeout(() => {
      const olderMessages = [
        { id: Date.now() - 100, text: "Ceci est un message plus ancien chargé dynamiquement.", sender: 'therapist', time: '09:45' },
        { id: Date.now() - 200, text: "Comment se passait votre week-end ?", sender: 'therapist', time: '09:40' },
      ];
      
      setMessages(prev => [...olderMessages, ...prev]);
      setIsLoadingMore(false);
    }, 800);
  };

  // Preserve scroll position when loading more (prepending)
  useEffect(() => {
    if (scrollContainerRef.current && lastScrollHeight.current > 0) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight;
      const heightDifference = newScrollHeight - lastScrollHeight.current;
      
      if (heightDifference > 0) {
        scrollContainerRef.current.scrollTop = heightDifference;
      }
      lastScrollHeight.current = 0;
    }
  }, [messages]);

  // Initial scroll to bottom
  useEffect(() => {
    const timer = setTimeout(() => {
        scrollToBottom("instant");
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom only when NEW messages are sent (appended)
  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    // If not loading more and messages increased -> it's a new message
    if (lastScrollHeight.current === 0 && messages.length > prevMessagesLength.current) {
        scrollToBottom("smooth");
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  const handleTriggerFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !selectedImage) return;

    const msg = {
      id: Date.now(),
      text: newMessage.trim(),
      sender: 'patient',
      image: selectedImage || null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, msg]);
    setNewMessage('');
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Focus back on textarea without causing unexpected scrolls
    if (textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="t-card !p-0 flex-1 flex flex-col overflow-hidden border-2 border-primary/5 shadow-2xl bg-card-bg min-h-[400px] h-full max-h-[calc(100vh-140px)] md:max-h-[calc(100vh-160px)]"
    >
      {/* Chat Header */}
      <div className="p-3 border-b border-border-color flex justify-between items-center bg-card-bg z-10 sticky top-0">
        <div className="flex items-center gap-2 font-sans">
          {onBack && (
            <button 
              onClick={onBack}
              className="md:hidden p-1.5 hover:bg-bg-main rounded-xl text-text-muted transition-colors mr-1 cursor-pointer"
              aria-label="Retour"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="relative">
            <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center text-primary text-[10px] font-bold">
              {therapist?.name?.charAt(4) || 'A'}
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card-bg rounded-full"></div>
          </div>
          <div>
            <p className="font-bold text-xs">{therapist?.name || 'Thérapeute'}</p>
            <p className="text-[9px] uppercase font-bold text-green-500 tracking-widest">En ligne</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {/* Actions d'appel retirées pour conserver la confidentialité */}
        </div>
      </div>

      {/* Messages Container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-bg-main/30 scroll-smooth relative"
      >
        <div className="flex justify-center mb-4">
          <button 
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="text-[10px] font-bold text-primary uppercase tracking-widest px-4 py-2 hover:bg-primary/5 rounded-full transition-all disabled:opacity-50 cursor-pointer"
          >
            {isLoadingMore ? 'Chargement...' : 'Afficher plus de messages'}
          </button>
        </div>

        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.sender === 'patient' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] p-2.5 px-3.5 rounded-2xl text-[13px] font-medium shadow-sm transition-all ${
              msg.sender === 'patient' 
                ? 'bg-primary text-white rounded-tr-none' 
                : 'bg-card-bg text-text-main rounded-tl-none border border-border-color'
            }`}>
              {msg.image && (
                <div className="relative mb-1.5 overflow-hidden rounded-xl bg-black/10 max-w-full">
                  <img src={msg.image} alt="Pièce jointe" className="max-h-60 object-contain w-full rounded-xl" referrerPolicy="no-referrer" />
                </div>
              )}
              {msg.text && <p className="leading-snug break-words whitespace-pre-wrap">{msg.text}</p>}
              <span className={`text-[8px] block mt-1 opacity-60 font-bold ${msg.sender === 'patient' ? 'text-right' : 'text-left'}`}>
                {msg.time}
              </span>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} className="h-2" />
      </div>

      {/* Input Area */}
      <form 
        onSubmit={handleSendMessage} 
        className="p-3 bg-card-bg border-t border-border-color flex flex-col gap-2 sticky bottom-0"
      >
        {/* Selected Image Preview with close button */}
        {selectedImage && (
          <div className="flex items-center gap-3 p-2 bg-bg-main border border-border-color rounded-xl max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/5 shrink-0 relative group">
              <img src={selectedImage} alt="Aperçu de la pièce jointe" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-text-main truncate">image_attachee.png</p>
              <button 
                type="button" 
                onClick={handleClearImage}
                className="text-[9px] font-bold text-red-500 hover:underline cursor-pointer"
              >
                Supprimer
              </button>
            </div>
            <button
              type="button"
              onClick={handleClearImage}
              className="p-1.5 hover:bg-bg-main border border-border-color text-text-muted hover:text-red-500 rounded-md cursor-pointer shrink-0 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 w-full">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <textarea 
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez votre message ici..."
            rows={1}
            className="flex-1 !p-2 px-3 text-xs bg-bg-main border border-border-color rounded-xl outline-none focus:ring-1 focus:ring-primary/30 transition-all resize-none overflow-y-auto max-h-[120px] min-h-[36px]"
          />
          
          {/* Picture Attach Button */}
          <button 
            type="button" 
            onClick={handleTriggerFilePicker}
            className={`p-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all text-text-muted cursor-pointer shrink-0 border mb-0.5 ${
              selectedImage 
                ? 'bg-primary/10 border-primary/20 text-primary' 
                : 'bg-bg-main border-border-color hover:bg-primary/5 hover:text-primary'
            }`}
            aria-label="Ajouter une image"
          >
            <ImageIcon size={16} />
          </button>

          {/* Send Button */}
          <button 
            type="submit" 
            disabled={!newMessage.trim() && !selectedImage}
            className="bg-primary text-white p-2.5 px-3 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 disabled:scale-100 mb-0.5 shrink-0"
            aria-label="Envoyer"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </motion.div>
  );
}
