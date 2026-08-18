import React from 'react';
import { NotificationBell } from '../common/NotificationBell.jsx';
import { UserProfileMenu } from '../common/UserProfileMenu.jsx';

export function Topbar({ onOpenMobileMenu }) {
  return (
    <header className="fixed top-0 left-0 lg:left-[260px] right-0 h-16 bg-white/90 backdrop-blur-md z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-[#dfe5e8] shadow-[0_1px_8px_rgba(0,0,0,0.02)]">
      {/* Mobile Toggle & Search Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-[#3e494a] hover:bg-[#ebf5ff] rounded-lg"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <div className="flex items-center bg-[#ebf5ff] px-3.5 py-1.5 rounded-xl w-64 sm:w-80 md:w-96 border border-[#bdc9ca]/30 focus-within:ring-2 focus-within:ring-[#087f8c]/30 focus-within:bg-white transition-all">
          <span className="material-symbols-outlined text-[#687781] text-[20px]">search</span>
          <input
            type="text"
            placeholder="Search employees or records..."
            className="bg-transparent border-none focus:outline-none text-xs sm:text-sm w-full ml-2 text-[#0f1d27] placeholder:text-[#687781]"
          />
        </div>
      </div>

      {/* Right Controls: Notifications & User Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        <NotificationBell />
        <UserProfileMenu />
      </div>
    </header>
  );
}
