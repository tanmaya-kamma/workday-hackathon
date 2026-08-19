import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Select } from '../../components/common/Select.jsx';
import {
  calculateWorkingDays,
  getTodayIsoString,
  CONFIGURED_HOLIDAYS_2026,
  isCompanyHoliday,
} from '../../utils/dateUtils.js';

export function RequestLeavePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const { currentUser, role } = useAuth();
  const { getUserBalances, getLeaveRequest, saveDraft, submitLeaveRequest } = useLeave();

  const balances = getUserBalances(currentUser?.id);

  // Form State
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prefill if editing a draft
  useEffect(() => {
    if (editId) {
      const existing = getLeaveRequest(editId);
      if (existing) {
        setLeaveType(existing.typeKey || 'annual');
        setStartDate(existing.startDate || '');
        setEndDate(existing.endDate || '');
        setReason(existing.reason || '');
      }
    }
  }, [editId]);

  // Leave Type Options
  const leaveTypeOptions = [
    { value: 'annual', label: `Annual Leave (${balances.annual?.remaining ?? 8} days remaining)` },
    { value: 'sick', label: `Sick Leave (${balances.sick?.remaining ?? 8} days remaining)` },
    { value: 'casual', label: `Casual Leave (${balances.casual?.remaining ?? 2} days remaining)` },
    { value: 'unpaid', label: 'Unpaid Leave (No balance limit)' },
  ];

  const leaveTypeNames = {
    annual: 'Annual Leave',
    sick: 'Sick Leave',
    casual: 'Casual Leave',
    unpaid: 'Unpaid Leave',
  };

  // Calculations
  const todayStr = getTodayIsoString();

  const workingDays = useMemo(() => {
    return calculateWorkingDays(startDate, endDate);
  }, [startDate, endDate]);

  const currentAvailableBalance = useMemo(() => {
    if (leaveType === 'unpaid') return 999;
    return balances[leaveType]?.remaining ?? 0;
  }, [leaveType, balances]);

  const remainingAfterRequest = useMemo(() => {
    if (leaveType === 'unpaid') return 0;
    return currentAvailableBalance - workingDays;
  }, [currentAvailableBalance, workingDays, leaveType]);

  // Check if chosen range contains any company holidays
  const holidaysInRange = useMemo(() => {
    if (!startDate || !endDate) return [];
    return CONFIGURED_HOLIDAYS_2026.filter((h) => h.date >= startDate && h.date <= endDate);
  }, [startDate, endDate]);

  // Validation function
  const validateForm = (isDraft = false) => {
    const errs = {};

    if (!leaveType) {
      errs.leaveType = 'Please select a leave type.';
    }

    if (!startDate) {
      errs.startDate = 'Start date is required.';
    }

    if (!endDate) {
      errs.endDate = 'End date is required.';
    }

    if (startDate && endDate) {
      if (endDate < startDate) {
        errs.endDate = 'End date cannot be earlier than start date.';
      } else if (workingDays === 0) {
        errs.endDate = 'Selected date range contains 0 working days (weekends/holidays).';
      }
    }

    if (!isDraft) {
      if (!reason.trim()) {
        errs.reason = 'Please provide a reason for your leave request.';
      } else if (reason.trim().length < 5) {
        errs.reason = 'Reason must be at least 5 characters.';
      }

      // Exceeding the balance no longer blocks submission — the
      // excess days are classified as unpaid (warned inline below).
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Days beyond the available balance become unpaid leave.
  const unpaidDays = useMemo(() => {
    if (leaveType === 'unpaid') return workingDays;
    return Math.max(0, workingDays - Math.max(0, currentAvailableBalance));
  }, [leaveType, workingDays, currentAvailableBalance]);

  // 1. Handle Save Draft
  const handleSaveDraft = () => {
    if (!validateForm(true)) return;

    setIsSubmitting(true);
    saveDraft(
      {
        leaveType,
        leaveTypeName: leaveTypeNames[leaveType],
        startDate: startDate || todayStr,
        endDate: endDate || startDate || todayStr,
        duration: workingDays || 1,
        reason: reason.trim(),
      },
      editId
    );
    setIsSubmitting(false);

    const redirectPath = role === 'manager' ? '/manager/my-leave' : '/employee/my-leave';
    navigate(redirectPath);
  };

  // 2. Handle Submit Request
  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!validateForm(false)) return;

    setIsSubmitting(true);
    submitLeaveRequest(
      {
        leaveType,
        leaveTypeName: leaveTypeNames[leaveType],
        startDate,
        endDate,
        duration: workingDays,
        reason: reason.trim(),
      },
      editId
    );
    setIsSubmitting(false);

    const redirectPath = role === 'manager' ? '/manager/my-leave' : '/employee/my-leave';
    navigate(redirectPath);
  };

  // 3. Handle Cancel
  const handleCancel = () => {
    const cancelPath = role === 'manager' ? '/manager/my-leave' : '/employee/my-leave';
    navigate(cancelPath);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header Card */}
      <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f1d27]">
            {editId ? 'Edit Leave Request Draft' : 'Request Time Off'}
          </h1>
          <p className="text-xs sm:text-sm text-[#687781] mt-0.5">
            Submit a time off request for manager approval or save as a draft.
          </p>
        </div>
        <Button variant="outline" icon="arrow_back" onClick={handleCancel}>
          Back to My Leave
        </Button>
      </Card>

      {/* Main Form & Calculation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Fields (2 Cols) */}
        <Card className="lg:col-span-2 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Unpaid spill-over warning (does not block submission) */}
            {unpaidDays > 0 && leaveType !== 'unpaid' && (
              <div className="p-4 bg-[#ffdad6]/70 border border-[#ba1a1a]/30 rounded-xl text-xs font-semibold text-[#ba1a1a] flex items-start gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <span>
                  You are requesting {workingDays} working days but only have{' '}
                  {Math.max(0, currentAvailableBalance)} {leaveTypeNames[leaveType]} day
                  {currentAvailableBalance === 1 ? '' : 's'} available.{' '}
                  <strong>{unpaidDays} day{unpaidDays > 1 ? 's' : ''} will be UNPAID.</strong>{' '}
                  You can still submit — your manager will see the paid/unpaid split.
                </span>
              </div>
            )}

            {/* Leave Type */}
            <Select
              id="leave-type-select"
              label="Leave Type"
              options={leaveTypeOptions}
              value={leaveType}
              onChange={(e) => {
                setLeaveType(e.target.value);
                setErrors((prev) => ({ ...prev, leaveType: null, balance: null }));
              }}
              error={errors.leaveType}
              required
            />

            {/* Date Range: Start & End */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="leave-start-date"
                label="Start Date"
                type="date"
                value={startDate}
                min={todayStr}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setErrors((prev) => ({ ...prev, startDate: null, balance: null }));
                  if (!endDate || endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
                error={errors.startDate}
                required
              />

              <Input
                id="leave-end-date"
                label="End Date"
                type="date"
                value={endDate}
                min={startDate || todayStr}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setErrors((prev) => ({ ...prev, endDate: null, balance: null }));
                }}
                error={errors.endDate}
                required
              />
            </div>

            {/* Holiday notice if dates overlap */}
            {holidaysInRange.length > 0 && (
              <div className="p-3 bg-[#ebf5ff] rounded-xl border border-[#dfe5e8] text-xs text-[#00646f] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">celebration</span>
                <span>
                  Includes holiday:{' '}
                  <strong>{holidaysInRange.map((h) => h.name).join(', ')}</strong> (excluded from deduction)
                </span>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-1.5">
              <label
                htmlFor="leave-reason"
                className="block text-xs font-semibold uppercase tracking-wider text-[#3e494a]"
              >
                Reason for Leave <span className="text-[#ba1a1a]">*</span>
              </label>
              <textarea
                id="leave-reason"
                rows="4"
                placeholder="Please describe the reason for taking leave (e.g. medical appointment, annual family trip, etc.)..."
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrors((prev) => ({ ...prev, reason: null }));
                }}
                className={`w-full bg-white border rounded-xl p-3.5 text-xs sm:text-sm text-[#0f1d27] placeholder:text-[#687781] focus:outline-none focus:ring-2 focus:ring-[#00646f]/30 transition-all ${
                  errors.reason ? 'border-[#ba1a1a]' : 'border-[#bdc9ca]/40'
                }`}
              />
              {errors.reason && (
                <span className="text-[11px] text-[#ba1a1a] font-medium block">
                  {errors.reason}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#dfe5e8]">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  icon="edit_note"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none"
                >
                  Save Draft
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  icon="send"
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </div>
          </form>
        </Card>

        {/* Live Calculation & Balance Summary Sidebar (1 Col) */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-base font-bold text-[#0f1d27] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00646f]">calculate</span>
              <span>Leave Summary</span>
            </h3>

            <div className="space-y-4">
              {/* Working Days */}
              <div className="p-4 bg-[#ebf5ff] rounded-xl border border-[#dfe5e8]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#687781]">
                  Requested Duration
                </div>
                <div className="text-2xl font-bold text-[#00646f] mt-0.5">
                  {workingDays} {workingDays === 1 ? 'Working Day' : 'Working Days'}
                </div>
                <p className="text-[11px] text-[#687781] mt-1">
                  Excludes Saturdays, Sundays, and public holidays.
                </p>
              </div>

              {/* Balances Breakdown */}
              <div className="space-y-2.5 pt-2 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-[#dfe5e8]">
                  <span className="text-[#687781]">Leave Category</span>
                  <span className="font-semibold text-[#0f1d27]">
                    {leaveTypeNames[leaveType]}
                  </span>
                </div>

                {leaveType !== 'unpaid' && (
                  <>
                    <div className="flex justify-between items-center py-1.5 border-b border-[#dfe5e8]">
                      <span className="text-[#687781]">Available Balance</span>
                      <span className="font-bold text-[#0f1d27]">
                        {currentAvailableBalance} Days
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-[#dfe5e8]">
                      <span className="text-[#687781]">Paid Deduction</span>
                      <span className="font-bold text-[#ba1a1a]">
                        - {Math.min(workingDays, Math.max(0, currentAvailableBalance))} Days
                      </span>
                    </div>

                    {unpaidDays > 0 && (
                      <div className="flex justify-between items-center py-1.5 border-b border-[#dfe5e8]">
                        <span className="text-[#ba1a1a] font-semibold">Unpaid Days</span>
                        <span className="font-bold text-[#ba1a1a]">
                          {unpaidDays} Days
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-2 bg-[#f5f7f8] px-3 rounded-lg">
                      <span className="font-semibold text-[#0f1d27]">Balance After Request</span>
                      <span
                        className={`font-bold text-sm ${
                          unpaidDays > 0 ? 'text-[#ba1a1a]' : 'text-[#2e7d5b]'
                        }`}
                      >
                        {Math.max(0, remainingAfterRequest)} Days
                      </span>
                    </div>
                  </>
                )}

                {leaveType === 'unpaid' && (
                  <div className="p-3 bg-[#f5f7f8] rounded-lg text-[11px] text-[#687781]">
                    Unpaid leave does not deduct from your paid annual allowances.
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Approver Information Card */}
          <Card className="p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#687781] mb-2">
              Assigned Approver
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00646f]/10 text-[#00646f] flex items-center justify-center font-bold text-sm">
                {currentUser?.managerName
                  ? currentUser.managerName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                  : 'SM'}
              </div>
              <div>
                <div className="text-xs font-bold text-[#0f1d27]">
                  {currentUser?.managerName || currentUser?.department || 'Manager'}
                </div>
                <div className="text-[11px] text-[#687781]">
                  {role === 'manager'
                    ? 'VP / HR Director • Executive'
                    : `Reporting Manager • ${currentUser?.department || 'Department'}`}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
