import React, { useState, useRef, useEffect } from 'react';
import { useLeave } from '../../context/LeaveContext.jsx';

export function NotificationBell() {
  const { notifications, unreadCount, markNotificationsRead, markNotificationRead } = useLeave();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    markNotificationsRead();
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
                  onClick={() => markNotificationRead(n.id)}
                  className={`p-3.5 px-4 hover:bg-[#f5f7f8] transition-colors flex items-start gap-3 cursor-pointer ${
                    !n.read ? 'bg-[#ebf5ff]/40' : ''
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      n.type === 'success'
                        ? 'bg-[#2e7d5b]/10 text-[#2e7d5b]'
                        : n.type === 'danger'
                        ? 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                        : n.type === 'warning'
                        ? 'bg-[#b7791f]/10 text-[#b7791f]'
                        : 'bg-[#00646f]/10 text-[#00646f]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {n.type === 'success'
                        ? 'check_circle'
                        : n.type === 'danger'
                        ? 'cancel'
                        : n.type === 'warning'
                        ? 'warning'
                        : 'info'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-semibold truncate ${
                          !n.read ? 'text-[#0f1d27]' : 'text-[#3e494a]'
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="text-[10px] text-[#687781] shrink-0">{n.time}</span>
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
