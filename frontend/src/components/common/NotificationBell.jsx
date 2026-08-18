import React, { useState, useRef, useEffect } from 'react';
import api from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function NotificationBell() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await api.get('/notifications/');
      if (res.data) {
        setNotifications(res.data.items || []);
      }
    } catch (e) {
      // Silently fail — notifications are non-critical
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      // ignore
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 text-[#3e494a] hover:text-[#0f1d27] hover:bg-[#ebf5ff] rounded-full transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-[#ba1a1a] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white rounded-2xl shadow-xl border border-[#dfe5e8] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-2.5 border-b border-[#dfe5e8] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0f1d27]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#ba1a1a]/10 text-[#ba1a1a]">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-[#00646f] hover:underline font-semibold cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#dfe5e8]/50">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#687781] space-y-1">
                <span className="material-symbols-outlined text-[#bdc9ca] text-[32px] block mx-auto">
                  notifications_paused
                </span>
                <span>No notifications yet</span>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={`p-3.5 px-4 hover:bg-[#f5f7f8] transition-colors flex items-start gap-3 cursor-pointer ${
                    !n.is_read ? 'bg-[#ebf5ff]/40' : ''
                  }`}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[#00646f]/10 text-[#00646f]">
                    <span className="material-symbols-outlined text-[16px]">
                      {n.type === 'leave_approved' ? 'check_circle'
                        : n.type === 'leave_rejected' ? 'cancel'
                        : 'info'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-semibold truncate ${
                          !n.is_read ? 'text-[#0f1d27]' : 'text-[#3e494a]'
                        }`}
                      >
                        {n.title}
                      </span>
                    </div>
                    <p className="text-xs text-[#687781] mt-0.5 leading-relaxed">{n.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
