import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, X, Loader2, ChevronRight, Clock, AlertCircle, BellOff, Inbox } from 'lucide-react';
import { notification } from '../services/api';
import { connectSocket, getSocket } from '../services/socket';

/**
 * NotificationCenter
 *
 * Bell icon with unread badge → dropdown panel.
 * Uses existing backend endpoints:
 *   - notification.getAll()
 *   - notification.getUnreadCount()
 *   - notification.markAsRead(id)
 *   - notification.markAllAsRead()
 */
export default function NotificationCenter({ className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // 'read' | 'markAll' | null
  const [error, setError] = useState(null);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const pollingRef = useRef(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        notification.getAll({ limit: 50 }),
        notification.getUnreadCount(),
      ]);
      setNotifications(notifRes.data || []);
      setUnreadCount(countRes.data?.count || 0);
      setError(null);
    } catch (err) {
      console.error('[NotificationCenter] fetch error:', err);
    }
  }, []);

  const fetchCount = useCallback(async () => {
    try {
      const res = await notification.getUnreadCount();
      setUnreadCount(res.data?.count || 0);
    } catch {
      // silent
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Poll unread count every 30s (fallback)
  useEffect(() => {
    pollingRef.current = setInterval(fetchCount, 30_000);
    return () => clearInterval(pollingRef.current);
  }, [fetchCount]);

  // Socket.IO : écouter les notifications en temps réel
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handleNewNotification = (notif) => {
      setNotifications(prev => {
        // Éviter les doublons
        if (prev.some(n => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
      setUnreadCount(prev => prev + 1);
    };

    const handleUnreadCount = ({ count }) => {
      setUnreadCount(count);
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('unread:count', handleUnreadCount);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('unread:count', handleUnreadCount);
    };
  }, []);

  // ── Click outside / Escape ───────────────────────────────────────────────────

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (isOpen && e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // ── Toggle panel ─────────────────────────────────────────────────────────────

  const handleToggle = () => {
    if (!isOpen) {
      fetchAll(); // fresh data when opening
    }
    setIsOpen((prev) => !prev);
  };

  // ── Mark single as read ──────────────────────────────────────────────────────

  const handleMarkAsRead = async (id) => {
    setActionLoading(id);
    try {
      await notification.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[NotificationCenter] markAsRead error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Mark all as read ─────────────────────────────────────────────────────────

  const handleMarkAllAsRead = async () => {
    setActionLoading('markAll');
    try {
      await notification.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[NotificationCenter] markAllAsRead error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Relative date helper ─────────────────────────────────────────────────────

  const formatRelativeDate = (isoStr) => {
    const now = new Date();
    const date = new Date(isoStr);
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);

    if (diffSec < 60) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHour < 24) return `Il y a ${diffHour} h`;
    if (diffDay < 7) return `Il y a ${diffDay} jour${diffDay > 1 ? 's' : ''}`;
    if (diffWeek < 4) return `Il y a ${diffWeek} semaine${diffWeek > 1 ? 's' : ''}`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ── Notification type icon ───────────────────────────────────────────────────

  const getTypeIcon = (type) => {
    switch (type) {
      case 'patient_new_assignment':
      case 'therapist_changed':
      case 'patient_unassigned':
        return <Bell size={14} className="text-primary" />;
      default:
        return <Bell size={14} className="text-text-muted" />;
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={`relative ${className}`}>
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative p-2 hover:bg-bg-main rounded-xl text-text-muted hover:text-primary transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-red-500 rounded-full shadow-lg shadow-red-500/30 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-[400px] max-w-[calc(100vw-2rem)] bg-card-bg border border-border-color rounded-2xl shadow-2xl shadow-black/30 z-[200] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-primary" />
                <h3 className="font-bold text-sm text-text-main">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded-full leading-none">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={actionLoading === 'markAll'}
                  className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  {actionLoading === 'markAll' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  Tout marquer comme lu
                </button>
              )}
            </div>

            {/* Body */}
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <AlertCircle size={32} className="text-red-500 mb-3" />
                  <p className="text-sm font-bold text-text-main mb-1">Erreur de chargement</p>
                  <p className="text-xs text-text-muted">{error}</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                    <BellOff size={28} />
                  </div>
                  <p className="text-sm font-bold text-text-main mb-1">Aucune notification</p>
                  <p className="text-xs text-text-muted font-medium">
                    Vous serez informé ici des changements importants concernant vos patients.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border-color/50">
                  {notifications.map((notif) => {
                    const isUnread = !notif.isRead;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (isUnread) handleMarkAsRead(notif.id);
                        }}
                        className={`
                          relative flex items-start gap-3 px-5 py-4 transition-all cursor-pointer
                          ${isUnread
                            ? 'bg-primary/[0.03] hover:bg-primary/[0.06] border-l-2 border-l-primary'
                            : 'hover:bg-bg-main/50 border-l-2 border-l-transparent'
                          }
                        `}
                      >
                        {/* Unread dot */}
                        {isUnread && (
                          <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/40" />
                        )}

                        {/* Icon */}
                        <div className="shrink-0 mt-0.5">
                          {getTypeIcon(notif.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${isUnread ? 'font-bold text-text-main' : 'font-semibold text-text-muted'}`}>
                            {notif.title}
                          </p>
                          <p className={`text-xs mt-0.5 leading-relaxed ${isUnread ? 'text-text-muted' : 'text-text-muted/70'}`}>
                            {notif.message}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Clock size={10} className="text-text-muted/50" />
                            <span className="text-[10px] font-medium text-text-muted/50">
                              {formatRelativeDate(notif.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Read action spinner */}
                        {actionLoading === notif.id && (
                          <div className="shrink-0 flex items-center">
                            <Loader2 size={14} className="animate-spin text-primary" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer hint */}
            {notifications.length > 0 && (
              <div className="px-5 py-3 border-t border-border-color bg-bg-main/30">
                <p className="text-[10px] font-medium text-text-muted/50 text-center">
                  Cliquez sur une notification pour la marquer comme lue
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}