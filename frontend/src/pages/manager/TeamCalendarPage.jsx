import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { LeaveApprovalModal } from '../../components/common/LeaveApprovalModal.jsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function TeamCalendarPage() {
  const { currentUser } = useAuth();
  const { getTeamRequests, getTeamMembers } = useLeave();

  // Calendar State (Default to October 2026 for rich mock state)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(9); // 9 = October
  const [selectedMemberId, setSelectedMemberId] = useState('all');
  const [selectedDay, setSelectedDay] = useState(12); // Oct 12
  const [reviewRequest, setReviewRequest] = useState(null);

  // Direct reports & team requests for this manager
  const teamMembers = getTeamMembers(currentUser?.id);
  const teamRequests = getTeamRequests(currentUser?.id);

  // Navigation Handlers
  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
  };

  const handleResetToday = () => {
    setCurrentYear(2026);
    setCurrentMonthIndex(9);
    setSelectedDay(12);
  };

  // Calendar Math
  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonthIndex, 1).getDay(); // 0 = Sunday

  // Filter requests by member if selected
  const activeRequests = useMemo(() => {
    let list = teamRequests.filter((r) => r.status !== 'cancelled' && r.status !== 'draft');
    if (selectedMemberId !== 'all') {
      list = list.filter((r) => r.userId === selectedMemberId);
    }
    return list;
  }, [teamRequests, selectedMemberId]);

  // Calculate day-by-day leave distribution
  const calendarDayMap = useMemo(() => {
    const map = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const padMonth = String(currentMonthIndex + 1).padStart(2, '0');
      const padDay = String(day).padStart(2, '0');
      const dateStr = `${currentYear}-${padMonth}-${padDay}`;

      const events = activeRequests.filter((req) => {
        return req.startDate <= dateStr && req.endDate >= dateStr;
      });

      map[day] = {
        dateStr,
        events,
        approved: events.filter((e) => e.status === 'approved'),
        pending: events.filter((e) => e.status === 'pending'),
      };
    }
    return map;
  }, [currentYear, currentMonthIndex, daysInMonth, activeRequests]);

  // Overlap Detection: Find days with 2 or more team members away simultaneously
  const overlapDays = useMemo(() => {
    const overlapping = [];
    Object.entries(calendarDayMap).forEach(([day, data]) => {
      // Distinct employees away
      const distinctUsers = new Set(data.events.map((e) => e.userId));
      if (distinctUsers.size >= 2) {
        overlapping.push({
          day: Number(day),
          dateStr: data.dateStr,
          employees: data.events.map((e) => e.employeeName),
        });
      }
    });
    return overlapping;
  }, [calendarDayMap]);

  // Away This Month Summary
  const awayThisMonth = useMemo(() => {
    const startOfMonth = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-01`;
    const endOfMonth = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    return activeRequests.filter(
      (r) => r.startDate <= endOfMonth && r.endDate >= startOfMonth
    );
  }, [activeRequests, currentYear, currentMonthIndex, daysInMonth]);

  const selectedDayData = calendarDayMap[selectedDay] || { events: [], approved: [], pending: [] };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Team Leave Calendar"
        subtitle={`Schedule overview & capacity planning for ${currentUser?.department || 'your'} team.`}
      >
        <div className="flex items-center flex-wrap gap-2">
          {/* Member Filter */}
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="text-xs bg-white border border-[#dfe5e8] rounded-xl px-3 py-2 text-[#0f1d27] focus:outline-none focus:border-[#00646f] shadow-2xs"
          >
            <option value="all">All Team Members ({teamMembers.length})</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.position})
              </option>
            ))}
          </select>

          {/* Month Stepper */}
          <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-[#dfe5e8] shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-[#ebf5ff] rounded-lg text-[#687781] hover:text-[#0f1d27] transition-colors cursor-pointer"
              title="Previous Month"
            >
              <span className="material-symbols-outlined text-[18px] block">chevron_left</span>
            </button>
            <span className="text-xs font-bold text-[#0f1d27] px-2 min-w-[110px] text-center">
              {MONTH_NAMES[currentMonthIndex]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-[#ebf5ff] rounded-lg text-[#687781] hover:text-[#0f1d27] transition-colors cursor-pointer"
              title="Next Month"
            >
              <span className="material-symbols-outlined text-[18px] block">chevron_right</span>
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={handleResetToday}>
            Today
          </Button>
        </div>
      </PageHeader>

      {/* Overlap Coverage Warning Alert Banner */}
      {overlapDays.length > 0 && (
        <div className="p-4 bg-linear-to-r from-[#effdff] to-[#e0f7fa] rounded-2xl border border-[#00646f]/30 flex items-start justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00646f] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <span className="material-symbols-outlined text-[20px]">group_off</span>
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#0f1d27]">
                Team Coverage Alert: Multiple Absences Detected
              </h4>
              <p className="text-xs text-[#3e494a] mt-0.5">
                On <strong>{MONTH_NAMES[currentMonthIndex]} {overlapDays.map((d) => d.day).join(', ')}</strong>, 2 or more team members have concurrent leave scheduled. Review sprint deliverables and standup delegations.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#00646f] bg-white px-2.5 py-1 rounded-lg border border-[#00646f]/30 whitespace-nowrap shadow-2xs">
            {overlapDays.length} Conflict Day{overlapDays.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Main Grid: Calendar + Right Details Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid Container (3 cols) */}
        <Card className="lg:col-span-3 p-4 sm:p-6 overflow-hidden border-[#dfe5e8]">
          {/* Legend */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-4 mb-4 border-b border-[#dfe5e8]">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-[#22874e]"></span>
                <span className="text-[#3e494a] font-medium">Approved Leave</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-[#b7791f]"></span>
                <span className="text-[#3e494a] font-medium">Pending Review</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-[#00646f]/20 border border-[#00646f]"></span>
                <span className="text-[#3e494a] font-medium">Selected Date</span>
              </div>
            </div>
            <span className="text-xs text-[#687781]">Click any date to inspect details</span>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-bold uppercase text-[#687781] pb-2">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Empty slots before month starts */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="h-24 sm:h-28 bg-[#f5f7f8]/50 rounded-xl border border-transparent p-1.5"
              />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNumber = i + 1;
              const dayData = calendarDayMap[dayNumber] || { events: [], approved: [], pending: [] };
              const isSelected = selectedDay === dayNumber;
              const isToday = currentMonthIndex === 9 && currentYear === 2026 && dayNumber === 12;
              const hasConflict = dayData.events.length >= 2;

              return (
                <div
                  key={`day-${dayNumber}`}
                  onClick={() => setSelectedDay(dayNumber)}
                  className={`h-24 sm:h-28 rounded-xl border p-1.5 sm:p-2 flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#effdff] border-[#00646f] ring-2 ring-[#00646f]/30 shadow-xs'
                      : isToday
                      ? 'bg-[#f0fdf4] border-[#22874e]/60'
                      : hasConflict
                      ? 'bg-[#fffdfa] border-[#b7791f]/40 hover:border-[#b7791f]'
                      : 'bg-white border-[#dfe5e8] hover:border-[#00646f]/40'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isSelected
                          ? 'bg-[#00646f] text-white'
                          : isToday
                          ? 'bg-[#22874e] text-white'
                          : 'text-[#0f1d27]'
                      }`}
                    >
                      {dayNumber}
                    </span>

                    {hasConflict && (
                      <span
                        className="material-symbols-outlined text-[#b7791f] text-[14px]"
                        title="Multiple members on leave"
                      >
                        warning
                      </span>
                    )}
                  </div>

                  {/* Day Events Stack */}
                  <div className="space-y-1 overflow-y-auto max-h-[52px] scrollbar-none">
                    {dayData.events.map((evt, idx) => {
                      const isApproved = evt.status === 'approved';
                      return (
                        <div
                          key={idx}
                          className={`text-[10px] truncate px-1.5 py-0.5 rounded-md font-semibold ${
                            isApproved
                              ? evt.typeKey === 'sick'
                                ? 'bg-[#ffdad6]/70 text-[#ba1a1a]'
                                : 'bg-[#d8f3e5] text-[#1a6e3e]'
                              : 'bg-[#fff8e1] text-[#b7791f] border border-[#b7791f]/30'
                          }`}
                          title={`${evt.employeeName} (${evt.leaveType} - ${evt.status})`}
                        >
                          {evt.employeeName.split(' ')[0]} ({evt.typeKey?.slice(0, 3)})
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right Sidebar: Selected Day & Month Summary (1 col) */}
        <div className="space-y-6">
          {/* Selected Date Detail Card */}
          <Card className="p-5 border-[#dfe5e8]">
            <div className="flex items-center justify-between pb-3 border-b border-[#dfe5e8]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#687781] block">
                  Selected Date Details
                </span>
                <h4 className="text-sm font-bold text-[#0f1d27]">
                  {MONTH_NAMES[currentMonthIndex]} {selectedDay}, {currentYear}
                </h4>
              </div>
              <span className="text-xs font-semibold text-[#00646f] bg-[#ebf5ff] px-2.5 py-1 rounded-lg">
                {selectedDayData.events.length} Absent
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {selectedDayData.events.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#687781]">
                  <span className="material-symbols-outlined text-[#22874e] text-[28px] block mb-1">
                    check_circle
                  </span>
                  <p className="font-semibold text-[#0f1d27]">Full Team Available</p>
                  <p className="text-[11px] text-[#687781] mt-0.5">
                    No scheduled leaves or pending requests for this date.
                  </p>
                </div>
              ) : (
                selectedDayData.events.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => setReviewRequest(evt)}
                    className="p-3 bg-[#f8fbfb] rounded-xl border border-[#dfe5e8] hover:border-[#00646f] transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0f1d27] group-hover:text-[#00646f]">
                        {evt.employeeName}
                      </span>
                      <StatusBadge status={evt.status} />
                    </div>
                    <p className="text-[11px] text-[#687781] mt-1">
                      {evt.leaveType} • {evt.durationDays} day(s)
                    </p>
                    <p className="text-[11px] text-[#3e494a] italic mt-1 line-clamp-1">
                      "{evt.reason}"
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Away This Month Summary */}
          <Card className="p-5 border-[#dfe5e8]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#687781] mb-3">
              All Team Leaves in {MONTH_NAMES[currentMonthIndex]} ({awayThisMonth.length})
            </h4>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
              {awayThisMonth.length === 0 ? (
                <p className="text-xs text-[#687781] py-4 text-center">
                  No leaves scheduled for this month.
                </p>
              ) : (
                awayThisMonth.map((req) => (
                  <div
                    key={req.id}
                    onClick={() => setReviewRequest(req)}
                    className="p-2.5 bg-white rounded-xl border border-[#dfe5e8] hover:border-[#00646f] transition-all cursor-pointer text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#0f1d27]">{req.employeeName}</span>
                      <span className="text-[10px] font-semibold text-[#00646f]">
                        {req.durationDays}d
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-[#687781] mt-1">
                      <span>{req.dateDisplay}</span>
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Review Modal on click */}
      <LeaveApprovalModal
        isOpen={Boolean(reviewRequest)}
        onClose={() => setReviewRequest(null)}
        request={reviewRequest}
        initialMode="review"
      />
    </div>
  );
}
