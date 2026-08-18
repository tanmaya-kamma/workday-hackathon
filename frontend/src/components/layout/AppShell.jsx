import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { Breadcrumbs } from '../common/Breadcrumbs.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';

export function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { toast, closeToast } = useLeave();

  return (
    <div className="min-h-screen bg-[#f5f7f8] flex">
      {/* Sidebar Navigation */}
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col lg:pl-[260px] min-w-0">
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} />

        <main className="flex-1 pt-20 px-4 sm:px-6 lg:px-8 pb-12 max-w-[1440px] w-full mx-auto">
          <Breadcrumbs />
          {children || <Outlet />}
        </main>
      </div>

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs sm:text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-[#2e7d5b] text-white border-[#2e7d5b]'
                : toast.type === 'warning'
                ? 'bg-[#b7791f] text-white border-[#b7791f]'
                : toast.type === 'danger'
                ? 'bg-[#ba1a1a] text-white border-[#ba1a1a]'
                : 'bg-[#00646f] text-white border-[#00646f]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {toast.type === 'success'
                ? 'check_circle'
                : toast.type === 'warning'
                ? 'warning'
                : toast.type === 'danger'
                ? 'error'
                : 'info'}
            </span>
            <span>{toast.message}</span>
            <button
              onClick={closeToast}
              className="ml-2 hover:opacity-80 p-0.5 rounded cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
