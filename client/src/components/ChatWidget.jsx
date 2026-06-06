import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, ArrowLeft, Image as ImageIcon, X, Loader2, AlertCircle, MessageSquare } from 'lucide-react'; 
import { apiCall } from '../services/api';

export default function ChatWidget({ therapist, conversationId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const lastScrollHeight = useRef(0);

  // Fetch messages when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      setError(null);
      setPage(1);
      setMessages([]);
      
      try {
        const res = await apiCall(`/messages/conversations/${conversationId}?page=1&limit=50`, {
          method: 'GET',
        });
        
        if (res.success && Array.isArray(res.data)) {
          setMessages(res.data);
          setHasMore(res.pagination?.page < res.pagination?.totalPages);
        } else {
          setMessages([]);
        }
      } catch (err) {
        if (err.status === 404) {
          // No conversation yet — that's fine, it will be created on first message
          setMessages([]);
        } else {
          setError(err.message || 'Erreur lors du chargement des messages');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [conversationId]);

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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || !conversationId) return;
    setIsLoadingMore(true);
    
    if (scrollContainerRef.current) {
      lastScrollHeight.current = scrollContainerRef.current.scrollHeight;
    }

    try {
      const nextPage = page + 1;
      const res = await apiCall(`/messages/conversations/${conversationId}?page=${nextPage}&limit=50`, {
        method: 'GET',
      });
      
      if (res.success && Array.isArray(res.data)) {
        setMessages(prev => [...res.data, ...prev]);
        setPage(nextPage);
        setHasMore(res.pagination?.page < res.pagination?.totalPages);
      }
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Preserve scroll position when loading more
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
    if (!loading && messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom("instant");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Auto-scroll when new messages are added
  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (lastScrollHeight.current === 0 && messages.length > prevMessagesLength.current && !loading) {
      scrollToBottom("smooth");
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length, loading]);

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

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !selectedImage) return;
    if (!therapist?.id && !conversationId) return;

    setSending(true);

    // Optimistic update
    const tempId = Date.now();
    const tempMsg = {
      id: tempId,
      content: newMessage.trim(),
      senderId: 'patient',
      messageType: 'text',
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      // Send via API — receiver is the therapist
      const receiverId = therapist?.id;
      if (receiverId && newMessage.trim()) {
        await apiCall('/messages', {
          method: 'POST',
          body: JSON.stringify({
            receiverId,
            content: tempMsg.content,
            messageType: 'text',
          }),
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get therapist ID from conversationId if not provided
  const getTherapistName = () => {
    return therapist?.name || 'Thérapeute';
  };

  if (!conversationId && !therapist?.id) {
    return (
      <div className="h-full flex items-center justify-center p-12">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={28} />
          </div>
          <h3 className="text-lg font-bold mb-2">Aucune conversation</h3>
          <p className="text-sm text-text-muted">Sélectionnez un correspondant pour commencer à échanger.</p>
        </div>
      </div>
    );
  }

  // For therapist view, show patient name
  const chatPartnerName = getTherapistName();

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
              {chatPartnerName?.charAt(0) || 'P'}
            </div>
          </div>
          <div>
            <p className="font-bold text-xs">{chatPartnerName}</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-bg-main/30 scroll-smooth relative"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-text-muted">{error}</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <Send size={20} />
              </div>
              <p className="text-sm font-bold text-text-main">Aucun message</p>
              <p className="text-xs text-text-muted mt-1">Commencez la conversation en envoyant un message.</p>
            </div>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center mb-4">
                <button 
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="text-[10px] font-bold text-primary uppercase tracking-widest px-4 py-2 hover:bg-primary/5 rounded-full transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoadingMore ? 'Chargement...' : 'Afficher plus de messages'}
                </button>
              </div>
            )}

            {messages.map((msg) => {
              const isPatient = msg.senderId === 'patient' || msg.sender === 'patient';
              const displayText = msg.content || msg.text;
              const displayTime = msg.createdAt 
                ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : msg.time;
              
              return (
                <div 
                  key={msg.id} 
                  className={`flex ${isPatient ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-2.5 px-3.5 rounded-2xl text-[13px] font-medium shadow-sm transition-all ${
                    isPatient 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-card-bg text-text-main rounded-tl-none border border-border-color'
                  }`}>
                    {displayText && <p className="leading-snug break-words whitespace-pre-wrap">{displayText}</p>}
                    <span className={`text-[8px] block mt-1 opacity-60 font-bold ${isPatient ? 'text-right' : 'text-left'}`}>
                      {displayTime}
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div ref={chatEndRef} className="h-2" />
      </div>

      {/* Input Area */}
      <form 
        onSubmit={handleSendMessage} 
        className="p-3 bg-card-bg border-t border-border-color flex flex-col gap-2 sticky bottom-0"
      >
        {selectedImage && (
          <div className="flex items-center gap-3 p-2 bg-bg-main border border-border-color rounded-xl max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/5 shrink-0 relative group">
              <img src={selectedImage} alt="Aperçu" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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

          <button 
            type="submit" 
            disabled={(!newMessage.trim() && !selectedImage) || sending}
            className="bg-primary text-white p-2.5 px-3 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 disabled:scale-100 mb-0.5 shrink-0"
            aria-label="Envoyer"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </form>
    </motion.div>
  );
}