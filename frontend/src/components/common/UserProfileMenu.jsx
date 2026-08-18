import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ProfileModal } from './ProfileModal.jsx';

export function UserProfileMenu() {
  const { currentUser, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/login');
  };

  if (!currentUser) return null;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 pl-3 border-l border-[#dfe5e8] hover:opacity-85 transition-opacity cursor-pointer text-left focus:outline-none"
        >
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-[#0f1d27]">{currentUser.name}</div>
            <div className="text-[11px] text-[#687781] capitalize">{currentUser.position}</div>
          </div>

          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-9 h-9 rounded-full object-cover border border-[#d8dde6] shadow-xs"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#0875e1] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {currentUser.initial || currentUser.name?.charAt(0) || 'U'}
            </div>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#d8dde6] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            {/* User Identity Banner */}
            <div className="px-4 py-3 border-b border-[#d8dde6]/70">
              <p className="text-xs font-bold text-[#1b2533]">{currentUser.name}</p>
              <p className="text-[11px] text-[#5c6574] truncate">{currentUser.email}</p>
              <span className="inline-block mt-1.5 px-2.5 py-0.5 text-[10px] uppercase font-bold rounded-full bg-[#ebf5ff] text-[#0875e1]">
                {currentUser.role} Account
              </span>
            </div>

            {/* Profile Action */}
            <div className="p-1.5 border-b border-[#d8dde6]/70">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowProfileModal(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-[#1b2533] hover:bg-[#ebf5ff] hover:text-[#0875e1] flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-[#5c6574]">
                  account_circle
                </span>
                <span>My Profile</span>
              </button>
            </div>

            {/* Logout Action */}
            <div className="p-1.5">
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-[#d92d20] hover:bg-[#fef3f2] flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
}
