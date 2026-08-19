import React, { useState, useEffect, useCallback } from 'react';
import { useLeave } from '../../context/LeaveContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import api from '../../api.js';

const STATUS_STYLES = {
  pending: 'bg-[#fff8e1] text-[#b7791f]',
  accepted: 'bg-[#d8f3e5] text-[#22874e]',
  rejected: 'bg-red-50 text-red-700',
};

// ---------------------------------------------------------------------------
// One incoming reschedule request card
// ---------------------------------------------------------------------------

function RescheduleCard({ item, onResponded }) {
  const { showToast, fetchRequestsFromDB } = useLeave();
  const [message, setMessage] = useState('');
  const [responding, setResponding] = useState(null); // 'accept' | 'reject' | null
  const [error, setError] = useState(null);

  const isPending = item.status === 'pending';

  const handleRespond = async (action) => {
    setResponding(action);
    setError(null);
    try {
      await api.post(`/recommender/reschedules/${item.id}/respond`, {
        action,
        message: message || null,
      });
      showToast?.(
        action === 'accept'
          ? 'Reschedule accepted — your leave has been moved to the new dates.'
          : 'Reschedule rejected — your manager has been notified.',
        action === 'accept' ? 'success' : 'error',
      );
      // Accepting changes the underlying leave request dates.
      fetchRequestsFromDB?.();
      onResponded?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit your response');
    } finally {
      setResponding(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#dfe5e8] p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#002244] text-white flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">supervisor_account</span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#0f1d27]">
              {item.manager_name || 'Your manager'} requested a reschedule
            </h4>
            <p className="text-xs text-[#687781] capitalize">
              {item.leave_type} leave · requested{' '}
              {new Date(item.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
            STATUS_STYLES[item.status] || STATUS_STYLES.pending
          }`}
        >
          {item.status}
        </span>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-4 flex-wrap bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0]">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#687781] block mb-1">
            Your current dates
          </span>
          <span className="text-xs font-bold text-[#0f1d27]">
            {item.original_start_date} → {item.original_end_date}
          </span>
        </div>
        <span className="material-symbols-outlined text-[#0875e1]">arrow_forward</span>
        <div>
          <span className="text-[10px] uppercase font-bold text-[#687781] block mb-1">
            Proposed new dates
          </span>
          <span className="text-xs font-bold text-[#0875e1]">
            {item.proposed_start_date} → {item.proposed_end_date}
          </span>
        </div>
      </div>

      {/* Manager's reason */}
      <div className="flex items-start gap-2">
        <span className="material-symbols-outlined text-[16px] text-[#687781] shrink-0 mt-0.5">
          chat_bubble_outline
        </span>
        <p className="text-xs text-[#3e494a] italic leading-relaxed">"{item.reason}"</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
          <span className="material-symbols-outlined text-red-500 text-[16px]">error</span>
          <span className="text-xs text-red-700">{error}</span>
        </div>
      )}

      {/* Respond */}
      {isPending ? (
        <div className="space-y-3 pt-1 border-t border-[#dfe5e8]/70">
          <div className="pt-3">
            <label className="text-[10px] uppercase font-bold text-[#687781] block mb-1.5">
              Message to your manager (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="e.g. The new dates work for me / I have a family event that week..."
              className="w-full text-sm text-[#0f1d27] border border-[#d8dde6] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0875e1] resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="danger"
              size="sm"
              icon="cancel"
              loading={responding === 'reject'}
              disabled={responding !== null}
              onClick={() => handleRespond('reject')}
            >
              Reject
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="check_circle"
              loading={responding === 'accept'}
              disabled={responding !== null}
              onClick={() => handleRespond('accept')}
              className="bg-[#22874e] hover:bg-[#1a6e3e]"
            >
              Accept New Dates
            </Button>
          </div>
        </div>
      ) : (
        item.employee_message && (
          <p className="text-[11px] text-[#3e494a] italic bg-[#f8fafc] rounded-lg px-2.5 py-1.5 border border-[#e2e8f0]">
            Your response: "{item.employee_message}"
          </p>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function RescheduleRequestsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReschedules = useCallback(() => {
    setLoading(true);
    api
      .get('/recommender/reschedules/my')
      .then((res) => setItems(res.data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchReschedules();
  }, [fetchReschedules]);

  const pending = items.filter((i) => i.status === 'pending');
  const past = items.filter((i) => i.status !== 'pending');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reschedule Requests"
        subtitle="Your manager may ask you to move an upcoming leave to different dates. Review and respond here."
      >
        <Button variant="ghost" size="sm" icon="refresh" onClick={fetchReschedules}>
          Refresh
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center gap-3 p-10 justify-center">
          <div className="w-5 h-5 border-2 border-[#0875e1] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#687781]">Loading reschedule requests...</span>
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center border-[#dfe5e8]">
          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#d8f3e5] text-[#22874e] flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[36px]">event_available</span>
            </div>
            <h3 className="text-lg font-bold text-[#0f1d27]">No Reschedule Requests</h3>
            <p className="text-xs sm:text-sm text-[#687781] leading-relaxed">
              You have no reschedule requests from your manager. If one arrives, you'll also
              get a notification in the bell menu.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#0f1d27] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#b7791f]">
                  pending_actions
                </span>
                Awaiting Your Response ({pending.length})
              </h3>
              {pending.map((item) => (
                <RescheduleCard key={item.id} item={item} onResponded={fetchReschedules} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#0f1d27] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#687781]">
                  history
                </span>
                Past Requests ({past.length})
              </h3>
              {past.map((item) => (
                <RescheduleCard key={item.id} item={item} onResponded={fetchReschedules} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
