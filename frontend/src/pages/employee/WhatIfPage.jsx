import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { BalanceComparisonChart } from '../../components/charts/BalanceComparisonChart.jsx';
import { getTodayIsoString } from '../../utils/dateUtils.js';
import api from '../../api.js';

const LEAVE_TYPE_OPTIONS = [
  { value: 'vacation', label: 'Vacation Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal Leave' },
];

const TYPE_LABELS = {
  vacation: 'Vacation',
  sick: 'Sick',
  personal: 'Personal',
};

const TYPE_COLORS = {
  vacation: { icon: 'flight_takeoff', color: '#00646f', bg: '#ebf5ff' },
  sick: { icon: 'medical_services', color: '#b7791f', bg: '#b7791f1a' },
  personal: { icon: 'event_available', color: '#3d6fa8', bg: '#3d6fa81a' },
};

function formatShortDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function createEmptyScenario() {
  return { id: Date.now(), leave_type: 'vacation', start_date: '', end_date: '' };
}

export function WhatIfPage() {
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();
  const { getUserBalances } = useLeave();
  const balances = getUserBalances(currentUser?.id);

  const [scenarios, setScenarios] = useState([createEmptyScenario()]);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [liveBalances, setLiveBalances] = useState(null);

  // Load balances from the accrual engine so the sidebar matches what the
  // simulation will report (the local context uses different keys/values).
  useEffect(() => {
    const employeeId = currentUser?.employee_id || currentUser?.employeeId;
    if (!employeeId) return;
    let cancelled = false;
    api
      .get(`/accrual/${employeeId}`, { baseURL: 'http://localhost:8000/api' })
      .then((res) => {
        if (!cancelled) setLiveBalances(res.data?.data?.balances || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const todayStr = getTodayIsoString();
  const backPath = role === 'manager' ? '/manager/dashboard' : '/employee/dashboard';

  const addScenario = () => {
    setScenarios((prev) => [...prev, createEmptyScenario()]);
    setResult(null);
  };

  const removeScenario = (id) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    setResult(null);
  };

  const updateScenario = (id, field, value) => {
    setScenarios((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: value };
        if (field === 'start_date' && (!updated.end_date || updated.end_date < value)) {
          updated.end_date = value;
        }
        return updated;
      })
    );
    setResult(null);
  };

  const isValid = useMemo(() => {
    return scenarios.every((s) => s.leave_type && s.start_date && s.end_date && s.end_date >= s.start_date);
  }, [scenarios]);

  const handleSimulate = async () => {
    if (!isValid) return;
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        hypothetical_leaves: scenarios.map((s) => ({
          leave_type: s.leave_type,
          start_date: s.start_date,
          end_date: s.end_date,
        })),
      };

      const employeeId = currentUser?.employee_id || currentUser?.employeeId;
      const res = await api.post(
        `/scenarios/${employeeId}/simulate`,
        payload,
        { baseURL: 'http://localhost:8000/api' }
      );

      setResult(res.data.data);
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Simulation failed. Please check your inputs and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ebf5ff] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#00646f] text-[22px]">model_training</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f1d27]">What-If Scenarios</h1>
            <p className="text-xs sm:text-sm text-[#687781] mt-0.5">
              Plan ahead by simulating how leave requests would impact your balances
            </p>
          </div>
        </div>
        <Button variant="outline" icon="arrow_back" onClick={() => navigate(backPath)}>
          Back to Dashboard
        </Button>
      </Card>

      {/* Main Grid: Scenario Builder + Current Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenario Builder */}
        <Card className="lg:col-span-2 p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[#00646f]">edit_calendar</span>
            <h2 className="text-base font-semibold text-[#0f1d27]">Hypothetical Leave Periods</h2>
          </div>

          <div className="space-y-4">
            {scenarios.map((scenario, idx) => (
              <div
                key={scenario.id}
                className="p-4 bg-[#f5f7f8] rounded-xl border border-[#dfe5e8] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#687781]">
                    Leave Period {idx + 1}
                  </span>
                  {scenarios.length > 1 && (
                    <button
                      onClick={() => removeScenario(scenario.id)}
                      className="text-[#687781] hover:text-[#ba1a1a] p-1 rounded-lg hover:bg-[#ba1a1a]/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Leave Type */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#3e494a] mb-1">
                      Leave Type
                    </label>
                    <select
                      value={scenario.leave_type}
                      onChange={(e) => updateScenario(scenario.id, 'leave_type', e.target.value)}
                      className="w-full bg-white border border-[#bdc9ca]/40 rounded-xl px-3 py-2.5 text-sm text-[#0f1d27] focus:outline-none focus:ring-2 focus:ring-[#00646f]/30"
                    >
                      {LEAVE_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#3e494a] mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={scenario.start_date}
                      min={todayStr}
                      onChange={(e) => updateScenario(scenario.id, 'start_date', e.target.value)}
                      className="w-full bg-white border border-[#bdc9ca]/40 rounded-xl px-3 py-2.5 text-sm text-[#0f1d27] focus:outline-none focus:ring-2 focus:ring-[#00646f]/30"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#3e494a] mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={scenario.end_date}
                      min={scenario.start_date || todayStr}
                      onChange={(e) => updateScenario(scenario.id, 'end_date', e.target.value)}
                      className="w-full bg-white border border-[#bdc9ca]/40 rounded-xl px-3 py-2.5 text-sm text-[#0f1d27] focus:outline-none focus:ring-2 focus:ring-[#00646f]/30"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 mt-6 pt-5 border-t border-[#dfe5e8]">
            <Button
              type="button"
              variant="ghost"
              icon="add_circle"
              onClick={addScenario}
            >
              Add Leave Period
            </Button>
            <Button
              type="button"
              variant="primary"
              icon="psychology"
              onClick={handleSimulate}
              disabled={!isValid || isLoading}
            >
              {isLoading ? 'Analyzing...' : 'Analyze Impact'}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-[#ffdad6]/70 border border-[#ba1a1a]/30 rounded-xl text-xs font-semibold text-[#ba1a1a] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}
        </Card>

        {/* Current Balances Sidebar */}
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#00646f]">account_balance_wallet</span>
              <h3 className="text-base font-semibold text-[#0f1d27]">Current Balances</h3>
            </div>

            <div className="space-y-4">
              {Object.entries(TYPE_COLORS).map(([type, cfg]) => {
                const bal = result?.current_balances?.[type] ?? liveBalances?.[type] ?? null;
                // LeaveContext stores vacation under 'annual' and personal under 'casual'
                const localKey = type === 'vacation' ? 'annual' : type === 'personal' ? 'casual' : type;
                const remaining = bal ? bal.usable : (balances[localKey]?.remaining ?? 0);
                const total = bal ? bal.annual_entitlement : (balances[localKey]?.total ?? 20);

                return (
                  <div key={type} className="p-3 rounded-xl border border-[#dfe5e8]">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="material-symbols-outlined text-[18px] p-1 rounded-lg"
                        style={{ color: cfg.color, backgroundColor: cfg.bg }}
                      >
                        {cfg.icon}
                      </span>
                      <span className="text-xs font-semibold text-[#0f1d27]">
                        {TYPE_LABELS[type]}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-1.5">
                      <span className="text-2xl font-bold text-[#0f1d27]">{remaining}</span>
                      <span className="text-xs text-[#687781]">days usable</span>
                    </div>
                    <div className="w-full bg-[#d5e4f3] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (remaining / (total || 1)) * 100)}%`,
                          backgroundColor: cfg.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Impact Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(result.projected_balances).map(([type, proj]) => {
              const cfg = TYPE_COLORS[type];
              if (!cfg) return null;
              if (proj.current_usable === 0 && proj.hypothetical_days === 0) return null;

              const statusColor = !proj.sufficient
                ? '#ba1a1a'
                : proj.projected_remaining < 3
                  ? '#b7791f'
                  : '#2e7d5b';

              return (
                <Card key={type} className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className="material-symbols-outlined text-[18px] p-1.5 rounded-lg"
                      style={{ color: cfg.color, backgroundColor: cfg.bg }}
                    >
                      {cfg.icon}
                    </span>
                    <h3 className="text-sm font-semibold text-[#0f1d27]">{TYPE_LABELS[type]}</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#687781]">Current Usable</span>
                      <span className="font-bold text-[#0f1d27]">{proj.current_usable} days</span>
                    </div>

                    {proj.hypothetical_days > 0 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#687781]">Hypothetical Deduction</span>
                        <span className="font-bold text-[#ba1a1a]">- {proj.hypothetical_days} days</span>
                      </div>
                    )}

                    <div
                      className="flex justify-between items-center text-xs p-3 rounded-lg"
                      style={{ backgroundColor: `${statusColor}10` }}
                    >
                      <span className="font-semibold text-[#0f1d27]">Projected Balance</span>
                      <span className="font-bold text-sm" style={{ color: statusColor }}>
                        {proj.projected_remaining} days
                      </span>
                    </div>

                    {!proj.sufficient && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#ba1a1a] font-medium">
                        <span className="material-symbols-outlined text-[16px]">warning</span>
                        Insufficient balance
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Chart */}
          <BalanceComparisonChart projectedBalances={result.projected_balances} />

          {/* Leave Period Detail Table */}
          {result.hypothetical_leaves && result.hypothetical_leaves.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="p-5 px-6 border-b border-[#dfe5e8] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00646f]">table_chart</span>
                <h3 className="text-base font-semibold text-[#0f1d27]">Leave Period Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f5f7f8]/70 border-b border-[#dfe5e8]">
                      <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">Type</th>
                      <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">Dates</th>
                      <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">Working Days</th>
                      <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">Weekends</th>
                      <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">Holidays</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dfe5e8]/60">
                    {result.hypothetical_leaves.map((h, idx) => (
                      <tr key={idx} className="hover:bg-[#ebf5ff]/40 transition-colors">
                        <td className="p-4 px-6">
                          <div className="flex items-center gap-2">
                            <span
                              className="material-symbols-outlined text-[18px]"
                              style={{ color: TYPE_COLORS[h.leave_type]?.color || '#687781' }}
                            >
                              {TYPE_COLORS[h.leave_type]?.icon || 'calendar_today'}
                            </span>
                            <span className="text-sm font-medium text-[#0f1d27]">
                              {TYPE_LABELS[h.leave_type] || h.leave_type}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 px-6 text-xs text-[#3e494a]">
                          {h.start_date} to {h.end_date}
                        </td>
                        <td className="p-4 px-6 text-xs font-semibold text-[#0f1d27]">
                          {h.working_days_charged} {h.working_days_charged === 1 ? 'day' : 'days'}
                        </td>
                        <td className="p-4 px-6 text-xs text-[#687781]">
                          <div>{h.weekends_excluded} excluded</div>
                          {h.weekend_dates && h.weekend_dates.length > 0 && (
                            <div className="mt-1 text-[11px] text-[#8a97a0]">
                              {h.weekend_dates.map(formatShortDate).join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="p-4 px-6">
                          {h.holidays_in_range && h.holidays_in_range.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {h.holidays_in_range.map((hol, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#ebf5ff] text-[#00646f] px-2 py-0.5 rounded-full"
                                >
                                  <span className="material-symbols-outlined text-[12px]">celebration</span>
                                  {hol.name} · {formatShortDate(hol.date)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[#687781]">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
