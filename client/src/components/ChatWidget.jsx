import { useState, useRef, useEffect, Fragment } from 'react';
import { motion } from 'motion/react';
import { Send, ArrowLeft, Image as ImageIcon, X, Loader2, AlertCircle, MessageSquare, Edit, Check, Trash2 } from 'lucide-react'; 
import { apiCall } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import { connectSocket, getSocket, isConnected } from '../services/socket';

// ---------------------------------------------------------------------------
// Utilitaires d'horodatage humain et séparateurs de dates
// ---------------------------------------------------------------------------
const getDateLabel = (dateStr) => {
  if (!dateStr) return '';
  const msgDate = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDateStr = msgDate.toDateString();
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();
  if (msgDateStr === todayStr) return "Aujourd'hui";
  if (msgDateStr === yesterdayStr) return "Hier";
  return msgDate.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
};

const getHumanTime = (dateStr) => {
  if (!dateStr) return '';
  const msgDate = new Date(dateStr);
  const time = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const label = getDateLabel(dateStr);
  return `${label} ${time}`;
};

const isNewDateGroup = (index, messages) => {
  if (index === 0) return true;
  const current = new Date(messages[index].createdAt).toDateString();
  const previous = new Date(messages[index - 1].createdAt).toDateString();
  return current !== previous;
};
// ---------------------------------------------------------------------------

// IMPORTANT: conversationId doit être construit uniquement avec des User.id.
// Ne jamais utiliser Patient.id ou Therapist.id.
// Le résultat doit être déterministe : [userId1, userId2].sort().
// Backend et frontend doivent utiliser EXACTEMENT le même algorithme.
// Le conversationId est passé en prop depuis Patient.jsx / Therapist.jsx.
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
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const lastScrollHeight = useRef(0);
  const lastMessageTimestamp = useRef(Date.now());
  const initialLoadDone = useRef(false);

  const { user } = useAuth();
  const currentUserId = user?.id;

  // Reset du flag d'animation à chaque changement de conversation
  useEffect(() => {
    initialLoadDone.current = false;
  }, [conversationId]);

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
          setMessages([]);
        } else {
          setError(err.message || 'Erreur lors du chargement des messages');
        }
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    };

    fetchMessages();
  }, [conversationId]);

  // Socket.IO : écouter les events temps réel
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    // Nouveau message reçu
    const handleNewMessage = (message) => {
      setMessages(prev => {
        // Si déjà présent via un id correspondant → ignorer (pas de doublon)
        if (prev.some(m => m.id === message.id)) return prev;
        // Tenter de remplacer un message temporaire correspondant (même sender + contenu)
        const tempIdx = prev.findIndex(m => 
          m.id !== message.id && m.senderId === message.senderId && m.content === message.content
        );
        if (tempIdx !== -1) {
          const updated = [...prev];
          updated[tempIdx] = message;
          return updated;
        }
        // Nouveau message venant de l'autre utilisateur
        return [...prev, message];
      });
      lastMessageTimestamp.current = Date.now();
    };

    // Message marqué comme lu
    const handleMessageRead = ({ messageId }) => {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
      ));
    };

    // Message modifié en temps réel
    const handleMessageUpdated = (updatedMessage) => {
      setMessages(prev => prev.map(m => 
        m.id === updatedMessage.id ? updatedMessage : m
      ));
    };

    // Message supprimé en temps réel
    const handleMessageDeleted = (deletedMessage) => {
      setMessages(prev => prev.map(m => 
        m.id === deletedMessage.id ? deletedMessage : m
      ));
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleMessageRead);
    socket.on('message:updated', handleMessageUpdated);
    socket.on('message:deleted', handleMessageDeleted);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
      socket.off('message:updated', handleMessageUpdated);
      socket.off('message:deleted', handleMessageDeleted);
    };
  }, []);

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
    if (!therapist?.userId && !conversationId) return;

    setSending(true);

    // Optimistic update
    const tempId = Date.now();
    const tempMsg = {
      id: tempId,
      content: newMessage.trim(),
      senderId: currentUserId || 'current-user',
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
      // Déterminer le receiverId :
      // - Si on est patient : therapist?.userId (User.id du thérapeute)
      // - Si on est thérapeute : on reçoit patientId en prop
      const receiverId = therapist?.userId;

      if (receiverId && newMessage.trim()) {
        // Privilégier l'envoi via Socket.IO
        const socket = getSocket();
        if (socket?.connected) {
          const payload = { receiverId, content: tempMsg.content, messageType: 'text' };
          socket.emit('message:send', payload, (response) => {
            if (response?.success) {
              // Remplacer le message temporaire par le vrai message du serveur
              setMessages(prev => prev.map(m => m.id === tempId ? response.data : m));
            }
          });
        } else {
          // Fallback HTTP
          await apiCall('/messages', {
            method: 'POST',
            body: JSON.stringify({
              receiverId,
              content: tempMsg.content,
              messageType: 'text',
            }),
          });
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  // Démarrer l'édition d'un message
  const handleStartEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content || msg.text || '');
  };

  // Annuler l'édition
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  // Enregistrer la modification via Socket.IO
  const handleSaveEdit = () => {
    if (!editContent.trim() || !editingMessageId) return;
    
    const socket = getSocket();
    if (!socket?.connected) return;

    socket.emit('message:edit', { messageId: editingMessageId, content: editContent.trim() }, (response) => {
      if (response?.success) {
        // La mise à jour du state se fait via l'event 'message:updated' reçu
        setEditingMessageId(null);
        setEditContent('');
      }
    });
  };

  // Suppression logique d'un message via Socket.IO
  const handleDelete = (messageId) => {
    const socket = getSocket();
    if (!socket?.connected) return;

    socket.emit('message:delete', { messageId }, (response) => {
      if (!response?.success) {
        console.error('Failed to delete message');
      }
      // La mise à jour du state se fait via l'event 'message:deleted' reçu
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get therapist name
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

            {messages.map((msg, index) => {
              const isOwn = msg.senderId === currentUserId;
              const isEditing = editingMessageId === msg.id;
              const isDeleted = msg.isDeleted === true;
              
              return (
                <Fragment key={msg.id}>
                  {isNewDateGroup(index, messages) && (
                    <div className="flex items-center justify-center my-4">
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 h-px bg-border-color" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted/60 shrink-0 px-2">
                          {getDateLabel(msg.createdAt)}
                        </span>
                        <div className="flex-1 h-px bg-border-color" />
                      </div>
                    </div>
                  )}
                  <div 
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end gap-1 group`}
                  >
                    {/* Boutons d'action (uniquement pour ses propres messages, pas supprimés, pas en édition) */}
                    {isOwn && !isEditing && !isDeleted && (
                      <>
                        <button
                          onClick={() => handleStartEdit(msg)}
                          className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary/10 text-text-muted hover:text-primary transition-all cursor-pointer mb-1"
                          title="Modifier"
                          aria-label="Modifier le message"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(msg.id)}
                          className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 text-text-muted hover:text-red-500 transition-all cursor-pointer mb-1"
                          title="Supprimer"
                          aria-label="Supprimer le message"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}

                    <motion.div
                      initial={initialLoadDone.current ? { opacity: 0, y: 12 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className={`max-w-[85%] p-2.5 px-3.5 rounded-2xl text-[13px] font-medium shadow-sm transition-all ${
                        isOwn 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : 'bg-card-bg text-text-main rounded-tl-none border border-border-color'
                      } ${isDeleted ? (isOwn ? 'bg-primary/60' : 'opacity-60') : ''}`}
                    >
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-white/20 text-white rounded-lg p-1.5 text-[12px] resize-none outline-none focus:ring-1 focus:ring-white/50 min-h-[50px]"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex justify-end gap-1 mt-1">
                            <button
                              onClick={handleCancelEdit}
                              className="text-[9px] px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-all cursor-pointer"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              disabled={!editContent.trim()}
                              className="text-[9px] px-2 py-1 rounded-lg bg-white text-primary font-bold hover:bg-white/90 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            >
                              <Check size={10} />
                              Enregistrer
                            </button>
                          </div>
                        </div>
                      ) : isDeleted ? (
                        <p className="leading-snug italic opacity-80 text-[12px]">🗑 Ce message a été supprimé</p>
                      ) : (
                        <>
                          {(msg.content || msg.text) && <p className="leading-snug break-words whitespace-pre-wrap">{msg.content || msg.text}</p>}
                        </>
                      )}
                      <span className={`text-[8px] block mt-1 opacity-60 font-bold ${isOwn ? 'text-right' : 'text-left'}`}>
                        {getHumanTime(msg.createdAt)}
                        {!isDeleted && msg.isEdited && <span className="italic opacity-70 ml-1">(modifié)</span>}
                        {isOwn && !isDeleted && msg.isRead && <span className="ml-1">✓✓</span>}
                      </span>
                    </motion.div>
                  </div>
                </Fragment>
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
      {/* Modale de confirmation de suppression */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card-bg rounded-2xl p-6 max-w-sm mx-4 shadow-2xl border border-border-color">
            <p className="text-sm font-medium text-text-main mb-4">
              ⚠️ L'autre participant verra que vous avez supprimé ce message.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-bg-main text-text-muted hover:bg-border-color transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  handleDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all cursor-pointer"
              >
                Supprimer pour tous
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}