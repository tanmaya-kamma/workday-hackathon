import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';

export function ProfileModal({ isOpen, onClose }) {
  const { currentUser } = useAuth();

  if (!currentUser) return null;

  const rawBal = currentUser.balances || currentUser.leave_balances || {};
  const annRemaining = typeof rawBal.annual === 'object' ? (rawBal.annual?.remaining ?? 20) : (rawBal.annual ?? 20);
  const sickRemaining = typeof rawBal.sick === 'object' ? (rawBal.sick?.remaining ?? 12) : (rawBal.sick ?? 12);
  const casRemaining = typeof rawBal.casual === 'object' ? (rawBal.casual?.remaining ?? 6) : (rawBal.casual ?? 6);

  const regionLabels = {
    IN: 'India (IN)',
    US: 'United States (US)',
    UK: 'United Kingdom (UK)',
  };
  const locationDisplay = regionLabels[currentUser.region] || currentUser.region || 'HQ';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Profile"
      subtitle="Corporate employee information and credentials"
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Header with Avatar & Details */}
        <div className="flex items-center gap-3.5 p-4 bg-[#ebf5ff] rounded-2xl border border-[#bcd7f7]">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#0875e1] text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              {currentUser.initial || currentUser.name?.charAt(0) || 'U'}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[#1b2533] truncate">{currentUser.name}</h3>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#0875e1] text-white tracking-wider">
                {currentUser.role}
              </span>
            </div>
            <p className="text-xs text-[#5c6574] mt-0.5 truncate">{currentUser.position || `${currentUser.role} staff`}</p>
            <p className="text-xs text-[#0875e1] font-mono mt-0.5 truncate">{currentUser.email}</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-[#f4f6f8] rounded-xl border border-[#d8dde6]">
            <span className="text-[#5c6574] block mb-0.5 text-[11px]">Employee ID</span>
            <span className="font-semibold text-[#1b2533] font-mono">
              {currentUser.employeeId || currentUser.employee_id || currentUser.id}
            </span>
          </div>

          <div className="p-3 bg-[#f4f6f8] rounded-xl border border-[#d8dde6]">
            <span className="text-[#5c6574] block mb-0.5 text-[11px]">Department</span>
            <span className="font-semibold text-[#1b2533]">{currentUser.department || 'Engineering'}</span>
          </div>

          <div className="p-3 bg-[#f4f6f8] rounded-xl border border-[#d8dde6]">
            <span className="text-[#5c6574] block mb-0.5 text-[11px]">Reporting Hierarchy</span>
            <span className="font-semibold text-[#1b2533]">
              {currentUser.role === 'hr' ? 'HR Leadership' : (currentUser.role === 'manager' ? 'HR Admin (Priya Mehta)' : (currentUser.managerName || 'Manager'))}
            </span>
          </div>

          <div className="p-3 bg-[#f4f6f8] rounded-xl border border-[#d8dde6]">
            <span className="text-[#5c6574] block mb-0.5 text-[11px]">Work Location</span>
            <span className="font-semibold text-[#1b2533]">{locationDisplay}</span>
          </div>
        </div>

        {/* Leave Balances Summary */}
        <div className="p-3.5 bg-white rounded-xl border border-[#d8dde6]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#5c6574] mb-2.5">
            Current Leave Balances
          </h4>
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-2 bg-[#ebf5ff] rounded-lg border border-[#bcd7f7]">
              <span className="text-[10px] font-semibold text-[#5c6574] block uppercase">Annual</span>
              <span className="text-sm font-bold text-[#0875e1]">{annRemaining} Days</span>
            </div>
            <div className="p-2 bg-[#fef7e0] rounded-lg border border-[#fce8b2]">
              <span className="text-[10px] font-semibold text-[#b06000] block uppercase">Sick</span>
              <span className="text-sm font-bold text-[#b06000]">{sickRemaining} Days</span>
            </div>
            <div className="p-2 bg-[#e8f0fe] rounded-lg border border-[#d2e3fc]">
              <span className="text-[10px] font-semibold text-[#1a73e8] block uppercase">Casual</span>
              <span className="text-sm font-bold text-[#1a73e8]">{casRemaining} Days</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
