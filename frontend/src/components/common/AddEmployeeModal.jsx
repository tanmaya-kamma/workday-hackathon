import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Button } from './Button.jsx';
import { Input } from './Input.jsx';

export function AddEmployeeModal({ isOpen, onClose, onEmployeeAdded }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState('employee');
  const [department, setDepartment] = useState('Engineering');
  const [region, setRegion] = useState('IN');
  const [managerId, setManagerId] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState(new Date().toISOString().slice(0, 10));
  const [password, setPassword] = useState('password123');
  const [annualLeave, setAnnualLeave] = useState(20);
  const [sickLeave, setSickLeave] = useState(12);
  const [casualLeave, setCasualLeave] = useState(6);

  const [managers, setManagers] = useState([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch managers for dropdown
  useEffect(() => {
    if (isOpen) {
      setError('');
      setLoadingManagers(true);
      api.get('/hr/managers')
        .then((res) => {
          if (res.data && Array.isArray(res.data)) {
            setManagers(res.data);
            if (res.data.length > 0 && !managerId) {
              setManagerId(res.data[0].id);
            }
          }
        })
        .catch((e) => console.warn('Could not fetch managers list:', e))
        .finally(() => setLoadingManagers(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !email.trim()) {
      setError('Full Name and Email Address are required.');
      return;
    }

    setSubmitting(true);

    try {
      const selectedMgr = managers.find((m) => m.id === managerId);
      const payload = {
        fullName: fullName.trim(),
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        employeeId: employeeId.trim() || undefined,
        employee_id: employeeId.trim() || undefined,
        role,
        department,
        region,
        managerId: role === 'hr' ? undefined : (managerId || undefined),
        manager_id: role === 'hr' ? undefined : (managerId || undefined),
        managerName: selectedMgr?.full_name || undefined,
        dateOfJoining,
        date_of_joining: dateOfJoining ? new Date(dateOfJoining).toISOString() : undefined,
        password: password || 'password123',
        annualLeave: Number(annualLeave),
        sickLeave: Number(sickLeave),
        casualLeave: Number(casualLeave),
      };

      const result = await onEmployeeAdded(payload);
      setSubmitting(false);

      if (result?.success) {
        onClose();
      } else if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      setSubmitting(false);
      setError(err.response?.data?.detail || err.message || 'An error occurred while creating employee.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f1d27]/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#dfe5e8] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-6 border-b border-[#dfe5e8] flex items-center justify-between bg-[#f8fbfb]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00646f]/10 text-[#00646f] flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">person_add</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0f1d27]">Add New Employee</h2>
              <p className="text-xs text-[#687781]">
                Register a new workforce member and store in MongoDB LMS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#687781] hover:bg-[#dfe5e8]/50 hover:text-[#0f1d27] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-[#ffdad6]/70 border border-[#ba1a1a]/30 rounded-xl text-xs text-[#ba1a1a] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Basic Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="new-emp-name"
              label="Full Name *"
              placeholder="e.g. Ananya Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              id="new-emp-email"
              label="Corporate Email *"
              type="email"
              placeholder="ananya.sharma@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              id="new-emp-id"
              label="Employee ID"
              placeholder="e.g. EMP019 (auto-generated if empty)"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-emp-role" className="text-xs font-semibold uppercase tracking-wider text-[#687781]">
                System Role *
              </label>
              <select
                id="new-emp-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              >
                <option value="employee">Employee (Staff / IC)</option>
                <option value="manager">Manager (Team Lead)</option>
                <option value="hr">HR Administrator</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-emp-region" className="text-xs font-semibold uppercase tracking-wider text-[#687781]">
                Region *
              </label>
              <select
                id="new-emp-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              >
                <option value="IN">India (IN)</option>
                <option value="US">United States (US)</option>
                <option value="UK">United Kingdom (UK)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-emp-dept" className="text-xs font-semibold uppercase tracking-wider text-[#687781]">
                Department *
              </label>
              <select
                id="new-emp-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              >
                <option value="Engineering">Engineering</option>
                <option value="HR">Human Resources</option>
                <option value="Product">Product Management</option>
                <option value="Design">Design</option>
                <option value="Marketing">Marketing</option>
                <option value="Sales">Sales</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
              </select>
            </div>

            {role !== 'hr' ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-emp-mgr" className="text-xs font-semibold uppercase tracking-wider text-[#687781]">
                  Reporting Manager *
                </label>
                <select
                  id="new-emp-mgr"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  disabled={loadingManagers}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
                >
                  {managers.map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.full_name} ({mgr.department}) - {mgr.employee_id}
                    </option>
                  ))}
                  {managers.length === 0 && <option value="">No managers found</option>}
                </select>
              </div>
            ) : (
              <Input
                id="new-emp-mgr-na"
                label="Reporting Manager"
                value="N/A (HR Admin reports to Board)"
                disabled
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="new-emp-doj"
              label="Date of Joining"
              type="date"
              value={dateOfJoining}
              onChange={(e) => setDateOfJoining(e.target.value)}
            />

            <Input
              id="new-emp-pwd"
              label="Initial Password"
              type="text"
              placeholder="password123"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Initial Leave Balances Section */}
          <div className="p-4 bg-[#f8fbfb] rounded-xl border border-[#dfe5e8] space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0f1d27]">
              <span className="material-symbols-outlined text-[#00646f] text-[18px]">account_balance_wallet</span>
              <span>Initial 2026 Leave Balances (Days)</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#687781] block mb-1">Annual Leave</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={annualLeave}
                  onChange={(e) => setAnnualLeave(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-[#00646f] rounded-lg border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#687781] block mb-1">Sick Leave</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={sickLeave}
                  onChange={(e) => setSickLeave(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-[#0f1d27] rounded-lg border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#687781] block mb-1">Casual Leave</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={casualLeave}
                  onChange={(e) => setCasualLeave(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-[#3d6fa8] rounded-lg border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
                />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#dfe5e8] flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting} icon="check">
              Save & Add to MongoDB
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
