import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import api from '../../api.js';

const CONFIDENCE_STYLES = {
  high: 'bg-[#d8f3e5] text-[#22874e]',
  medium: 'bg-[#fff8e1] text-[#b7791f]',
  low: 'bg-slate-100 text-slate-600',
};

const STATUS_STYLES = {
  pending: 'bg-[#fff8e1] text-[#b7791f]',
  accepted: 'bg-[#d8f3e5] text-[#22874e]',
  rejected: 'bg-red-50 text-red-700',
};

function rangesOverlap(a, b) {
  return a.startDate <= b.endDate && a.endDate >= b.startDate;
}

// ---------------------------------------------------------------------------
// One AI recommendation card (dates are editable before sending)
// ---------------------------------------------------------------------------

function RecommendationCard({ rec, onSent }) {
  const { showToast } = useLeave();
  const [startDate, setStartDate] = useState(rec.suggested_start_date);
  const [endDate, setEndDate] = useState(rec.suggested_end_date);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      await api.post('/recommender/reschedules', {
        leave_request_id: rec.leave_request_id,
        proposed_start_date: startDate,
        proposed_end_date: endDate,
        reason: rec.reason,
      });
      setSent(true);
      showToast?.(`Reschedule request sent to ${rec.employee_name}`, 'success');
      onSent?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not send reschedule request');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#dfe5e8] p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-sm">
            {rec.employee_name?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#0f1d27]">{rec.employee_name}</h4>
            <p className="text-xs text-[#687781] capitalize">{rec.leave_type} leave</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rec.holiday_context && (
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-md bg-[#ebf5ff] text-[#0875e1] inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">celebration</span>
              {rec.holiday_context}
            </span>
          )}
          <span
            className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
              CONFIDENCE_STYLES[rec.confidence] || CONFIDENCE_STYLES.medium
            }`}
          >
            {rec.confidence} confidence
          </span>
        </div>
      </div>

      {/* Dates: original -> suggested */}
      <div className="flex items-center gap-4 flex-wrap bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0]">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#687781] block mb-1">
            Current (conflicting)
          </span>
          <span className="text-xs font-bold text-red-700 line-through">
            {rec.original_start_date} → {rec.original_end_date}
          </span>
        </div>
        <span className="material-symbols-outlined text-[#0875e1]">arrow_forward</span>
        <div>
          <span className="text-[10px] uppercase font-bold text-[#687781] block mb-1">
            Suggested new dates (editable)
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={sent}
              className="text-xs font-semibold text-[#0f1d27] border border-[#d8dde6] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0875e1]"
            />
            <span className="text-xs text-[#687781]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={sent}
              className="text-xs font-semibold text-[#0f1d27] border border-[#d8dde6] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0875e1]"
            />
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="flex items-start gap-2">
        <span className="material-symbols-outlined text-[18px] text-[#0875e1] shrink-0 mt-0.5">
          psychology
        </span>
        <p className="text-xs text-[#3e494a] leading-relaxed">{rec.reason}</p>
      </div>

      {/* Insights */}
      {rec.insights?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rec.insights.map((insight, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-1 rounded-md bg-[#ebf5ff] text-[#005cb9] font-medium"
            >
              {insight}
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <span className="material-symbols-outlined text-red-500 text-[16px]">error</span>
          <span className="text-xs text-red-700">{error}</span>
        </div>
      )}

      {/* Action */}
      <div className="flex justify-end">
        {sent ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22874e]">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            Reschedule request sent to employee
          </span>
        ) : (
          <Button
            variant="primary"
            size="sm"
            icon="send"
            loading={sending}
            onClick={handleSend}
          >
            Approve & Send Reschedule Request
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ReschedulePlannerPage() {
  const { currentUser } = useAuth();
  const { getPendingApprovals, showToast } = useLeave();

  const [selectedIds, setSelectedIds] = useState([]);
  const [numToReschedule, setNumToReschedule] = useState(1);
  const [managerNote, setManagerNote] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [sentRequests, setSentRequests] = useState([]);
  const [loadingSent, setLoadingSent] = useState(true);

  const pendingRequests = getPendingApprovals(currentUser?.id);

  const fetchSentRequests = useCallback(() => {
    setLoadingSent(true);
    api
      .get('/recommender/reschedules/team')
      .then((res) => setSentRequests(res.data.items || []))
      .catch(() => setSentRequests([]))
      .finally(() => setLoadingSent(false));
  }, []);

  useEffect(() => {
    fetchSentRequests();
  }, [fetchSentRequests]);

  // Requests overlapping with at least one selected request get highlighted.
  const selectedRequests = pendingRequests.filter((r) => selectedIds.includes(r.id));
  const overlapHints = useMemo(() => {
    const hints = {};
    pendingRequests.forEach((req) => {
      hints[req.id] = selectedRequests.some(
        (sel) => sel.id !== req.id && rangesOverlap(sel, req),
      );
    });
    return hints;
  }, [pendingRequests, selectedRequests]);

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setAnalysis(null);
    setAnalysisError(null);
  };

  const maxReschedulable = Math.max(1, selectedIds.length - 1);

  const handleAnalyze = async () => {
    if (selectedIds.length < 2) {
      showToast?.('Select at least two overlapping requests to analyze', 'error');
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisError(null);
    try {
      const res = await api.post('/recommender/analyze', {
        leave_request_ids: selectedIds,
        num_to_reschedule: Math.min(numToReschedule, maxReschedulable),
        manager_note: managerNote || null,
      });
      setAnalysis(res.data);
    } catch (err) {
      setAnalysisError(err.response?.data?.detail || 'Analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Reschedule Planner"
        subtitle="Resolve overlapping leave requests: the recommender agent analyses each employee's past leave behaviour and suggests who to reschedule, and to when."
      />

      {/* Step 1: pick conflicting requests */}
      <Card className="p-5 border-[#dfe5e8]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#ebf5ff] text-[#0875e1] flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f1d27]">Select conflicting requests</h3>
            <p className="text-xs text-[#687781]">
              Pick the pending requests that overlap. Requests overlapping your selection are
              flagged automatically.
            </p>
          </div>
        </div>

        {pendingRequests.length === 0 ? (
          <p className="text-sm text-[#687781] text-center py-6">
            No pending leave requests right now — nothing to resolve.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingRequests.map((req) => {
              const isSelected = selectedIds.includes(req.id);
              const overlapsSelection = overlapHints[req.id];
              return (
                <label
                  key={req.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#0875e1] bg-[#ebf5ff]/60 ring-1 ring-[#0875e1]/20'
                      : overlapsSelection
                        ? 'border-amber-300 bg-amber-50/60'
                        : 'border-[#dfe5e8] hover:border-[#0875e1]/40 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelect(req.id)}
                    className="w-4 h-4 rounded text-[#0875e1] focus:ring-[#0875e1] border-[#dfe5e8]"
                  />
                  <div className="w-9 h-9 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {req.initials || req.employeeName?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-[#0f1d27] block">
                      {req.employeeName}
                    </span>
                    <span className="text-[11px] text-[#687781]">
                      {req.leaveType} · {req.dateDisplay} · {req.durationDays} day
                      {req.durationDays > 1 ? 's' : ''}
                    </span>
                  </div>
                  {overlapsSelection && !isSelected && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                      Overlaps selection
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </Card>

      {/* Step 2: configure + analyze */}
      <Card className="p-5 border-[#dfe5e8]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#ebf5ff] text-[#0875e1] flex items-center justify-center font-bold text-sm">
            2
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f1d27]">Run the recommender agent</h3>
            <p className="text-xs text-[#687781]">
              Tell the agent how many of the selected employees must move their leave.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-[#687781] block mb-1.5">
              Employees to reschedule
            </label>
            <input
              type="number"
              min={1}
              max={maxReschedulable}
              value={numToReschedule}
              onChange={(e) => setNumToReschedule(Number(e.target.value) || 1)}
              className="w-24 text-sm font-semibold text-[#0f1d27] border border-[#d8dde6] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0875e1]"
            />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="text-[10px] uppercase font-bold text-[#687781] block mb-1.5">
              Context for the agent (optional)
            </label>
            <input
              type="text"
              value={managerNote}
              onChange={(e) => setManagerNote(e.target.value)}
              placeholder="e.g. Release week — need senior coverage in office"
              className="w-full text-sm text-[#0f1d27] border border-[#d8dde6] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0875e1]"
            />
          </div>
          <Button
            variant="primary"
            icon="smart_toy"
            loading={analyzing}
            disabled={selectedIds.length < 2}
            onClick={handleAnalyze}
          >
            {analyzing ? 'Analyzing behaviour...' : 'Get AI Recommendations'}
          </Button>
        </div>

        {analysisError && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-red-50 rounded-xl border border-red-200">
            <span className="material-symbols-outlined text-red-500 text-[18px]">error</span>
            <span className="text-xs text-red-700">{analysisError}</span>
          </div>
        )}
      </Card>

      {/* Step 3: recommendations */}
      {analysis && (
        <div className="space-y-4">
          <div className="bg-[#002244] rounded-2xl p-5 text-white shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[26px]">smart_toy</span>
                <div>
                  <h3 className="text-sm font-bold">Recommender Agent Result</h3>
                  <p className="text-xs text-white/70 mt-0.5">{analysis.conflict_summary}</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${
                  analysis.ai_generated
                    ? 'bg-[#0875e1] text-white'
                    : 'bg-amber-400/20 text-amber-200'
                }`}
              >
                {analysis.ai_generated
                  ? `AI · ${analysis.model_used}`
                  : 'Rule-based fallback (no API key)'}
              </span>
            </div>
          </div>

          {analysis.recommendations.map((rec) => (
            <RecommendationCard
              key={rec.leave_request_id}
              rec={rec}
              onSent={fetchSentRequests}
            />
          ))}
        </div>
      )}

      {/* Sent reschedule requests */}
      <Card className="p-5 border-[#dfe5e8]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#fff8e1] text-[#b7791f] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">forward_to_inbox</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0f1d27]">
                Sent Reschedule Requests ({sentRequests.length})
              </h3>
              <p className="text-xs text-[#687781]">
                Track how employees responded to your reschedule requests.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" icon="refresh" onClick={fetchSentRequests}>
            Refresh
          </Button>
        </div>

        {loadingSent ? (
          <div className="flex items-center gap-3 p-6 justify-center">
            <div className="w-5 h-5 border-2 border-[#0875e1] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#687781]">Loading...</span>
          </div>
        ) : sentRequests.length === 0 ? (
          <p className="text-sm text-[#687781] text-center py-6">
            No reschedule requests sent yet.
          </p>
        ) : (
          <div className="space-y-2">
            {sentRequests.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-[#dfe5e8] bg-white"
              >
                <div className="w-9 h-9 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {item.employee_name?.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#0f1d27]">
                      {item.employee_name}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        STATUS_STYLES[item.status] || STATUS_STYLES.pending
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#687781] mt-0.5">
                    {item.original_start_date} → {item.original_end_date}
                    <span className="mx-1.5 text-[#0875e1] font-bold">⇒</span>
                    {item.proposed_start_date} → {item.proposed_end_date}
                  </p>
                  {item.employee_message && (
                    <p className="text-[11px] text-[#3e494a] italic mt-1.5 bg-[#f8fafc] rounded-lg px-2.5 py-1.5 border border-[#e2e8f0]">
                      "{item.employee_message}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
