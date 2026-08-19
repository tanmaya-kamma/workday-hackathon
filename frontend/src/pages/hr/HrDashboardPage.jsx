import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLeave } from "../../context/LeaveContext.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { Card } from "../../components/common/Card.jsx";
import { Button } from "../../components/common/Button.jsx";
import { StatusBadge } from "../../components/common/StatusBadge.jsx";
import { HrReviewModal } from "../../components/common/HrReviewModal.jsx";

export function HrDashboardPage() {
  const navigate = useNavigate();

  const { getOrganizationStats, getOrganizationRequests, getAuditLogs } =
    useLeave();

  const stats = getOrganizationStats();

  const allRequests = getOrganizationRequests();

  const recentLogs = getAuditLogs().slice(0, 5);

  const [selectedRequest, setSelectedRequest] = useState(null);

  const [modalMode, setModalMode] = useState("review");

  // ============================================================
  // API CONFIGURATION
  // ============================================================

  const API_BASE =
    import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

  const getAuthToken = () => {
    return localStorage.getItem("wd_token") || "";
  };

  // ============================================================
  // LEAVE POLICY STATE
  // ============================================================

  const currentYear = new Date().getFullYear();

  const [policy, setPolicy] = useState({
    annual_leave: 20,
    sick_leave: 12,
    casual_leave: 6,
    manager_approval_days: 2,
    hr_direct_approval_days: 6,
    effective_year: currentYear + 1,
  });

  const [upcomingPolicies, setUpcomingPolicies] = useState([]);

  const [policyLoading, setPolicyLoading] = useState(false);

  const [policyMessage, setPolicyMessage] = useState("");

  const [policyError, setPolicyError] = useState("");

  // ============================================================
  // REGIONAL CALENDAR STATE
  // ============================================================

  const [calendarRegion, setCalendarRegion] = useState("India");

  const [calendarFile, setCalendarFile] = useState(null);

  const [calendarLoading, setCalendarLoading] = useState(false);

  const [calendarMessage, setCalendarMessage] = useState("");

  const [calendarError, setCalendarError] = useState("");

  // ============================================================
  // LOAD LEAVE POLICY
  // ============================================================

  const loadPolicies = async () => {
    try {
      setPolicyError("");

      const response = await fetch(`${API_BASE}/hr/policies`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to load leave policies.");
      }

      setPolicy((prev) => ({
        annual_leave: data.annual_leave ?? 20,

        sick_leave: data.sick_leave ?? 12,

        casual_leave: data.casual_leave ?? 6,

        manager_approval_days: data.manager_approval_days ?? 2,

        hr_direct_approval_days: data.hr_direct_approval_days ?? 6,

        effective_year: prev.effective_year || currentYear + 1,
      }));

      setUpcomingPolicies(data.upcoming_policies || []);
    } catch (error) {
      console.error("Policy loading error:", error);

      setPolicyError(error?.message || "Unable to load leave policies.");
    }
  };

  // ============================================================
  // LOAD POLICY ON PAGE LOAD
  // ============================================================

  useEffect(() => {
    loadPolicies();
  }, []);

  // ============================================================
  // SAVE LEAVE POLICY
  // ============================================================

  const savePolicies = async () => {
    setPolicyMessage("");
    setPolicyError("");

    // The current year's policy is immutable — live balances are
    // calculated from it. Only future years can be configured.
    if (Number(policy.effective_year) <= currentYear) {
      setPolicyError(
        `The ${currentYear} leave policy is already in effect and cannot be added or changed — employee balances are being calculated from it right now. New policies can only be added for ${currentYear + 1} and onward.`,
      );
      return;
    }

    setPolicyLoading(true);

    try {
      const response = await fetch(`${API_BASE}/hr/policies`, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${getAuthToken()}`,
        },

        body: JSON.stringify(policy),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to save leave policies.");
      }

      setUpcomingPolicies(data.upcoming_policies || []);

      setPolicyMessage(
        `Policy saved — takes effect January 1, ${policy.effective_year}. Current-year balances are unchanged.`,
      );
    } catch (error) {
      console.error("Policy save error:", error);

      setPolicyError(error?.message || "Failed to save leave policies.");
    } finally {
      setPolicyLoading(false);
    }
  };

  // ============================================================
  // UPLOAD REGIONAL CALENDAR
  // ============================================================

  const uploadCalendar = async () => {
    if (!calendarFile) {
      setCalendarError("Please select an Excel file first.");

      setCalendarMessage("");

      return;
    }

    if (!calendarFile.name.toLowerCase().endsWith(".xlsx")) {
      setCalendarError("Please upload an .xlsx Excel file.");

      setCalendarMessage("");

      return;
    }

    setCalendarLoading(true);
    setCalendarMessage("");
    setCalendarError("");

    try {
      const formData = new FormData();

      formData.append("file", calendarFile);

      const response = await fetch(
        `${API_BASE}/hr/regional-calendar?region=${encodeURIComponent(
          calendarRegion,
        )}`,
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },

          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to upload regional calendar.");
      }

      setCalendarMessage(
        `${data.holiday_count} holidays uploaded successfully for ${data.region}.`,
      );

      setCalendarFile(null);

      // Reset file input visually.
      const fileInput = document.getElementById("regional-calendar-file");

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      console.error("Calendar upload error:", error);

      setCalendarError(error?.message || "Failed to upload regional calendar.");
    } finally {
      setCalendarLoading(false);
    }
  };

  // ============================================================
  // HR APPROVAL QUEUE
  // ============================================================

  const pendingRequests = allRequests.filter(
    (r) => r.status === "pending" || r.status === "pending_hr",
  );

  const recentRequests = allRequests.slice(0, 6);

  // ============================================================
  // REVIEW MODAL
  // ============================================================

  const handleOpenReview = (request, mode = "review") => {
    setSelectedRequest(request);
    setModalMode(mode);
  };

  const handleCloseReview = () => {
    setSelectedRequest(null);
  };

  return (
    <div className="space-y-6">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <PageHeader
        title="HR Overview"
        subtitle="Organization-wide leave activity and workforce overview."
      >
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon="description"
            onClick={() => navigate("/hr/reports")}
          >
            Leave Reports
          </Button>

          <Button
            variant="primary"
            icon="checklist"
            onClick={() => navigate("/hr/all-requests")}
          >
            Review All Requests
          </Button>
        </div>
      </PageHeader>

      {/* =====================================================
          LEAVE POLICY CONFIGURATION
      ====================================================== */}

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00646f]">
                tune
              </span>

              <h3 className="text-base font-bold text-[#0f1d27]">
                Leave Policy Configuration
              </h3>
            </div>

            <p className="text-xs text-[#687781] mt-1">
              Update organization-wide leave allowances and approval thresholds.
            </p>
          </div>

          <span className="px-2.5 py-1 rounded-lg bg-[#f0f4f7] text-[10px] font-bold text-[#687781]">
            HR / ADMIN
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {/* EFFECTIVE YEAR */}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#687781] block mb-1.5">
              Effective Year
            </label>

            <input
              type="number"
              min={currentYear + 1}
              value={policy.effective_year}
              onChange={(e) =>
                setPolicy((prev) => ({
                  ...prev,
                  effective_year: Number(e.target.value),
                }))
              }
              className={`w-full px-3 py-2.5 text-sm font-semibold rounded-xl border bg-white focus:outline-none ${
                Number(policy.effective_year) <= currentYear
                  ? "border-[#ba1a1a] text-[#ba1a1a] focus:border-[#ba1a1a]"
                  : "border-[#dfe5e8] focus:border-[#00646f]"
              }`}
            />

            <span className="text-[10px] text-[#687781] block mt-1">
              {currentYear + 1} or later
            </span>
          </div>

          {/* ANNUAL */}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#687781] block mb-1.5">
              Annual Leave
            </label>

            <div className="relative">
              <input
                type="number"
                min="0"
                value={policy.annual_leave}
                onChange={(e) =>
                  setPolicy((prev) => ({
                    ...prev,
                    annual_leave: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2.5 pr-12 text-sm font-semibold rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#687781] font-semibold">
                days
              </span>
            </div>
          </div>

          {/* SICK */}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#687781] block mb-1.5">
              Sick Leave
            </label>

            <div className="relative">
              <input
                type="number"
                min="0"
                value={policy.sick_leave}
                onChange={(e) =>
                  setPolicy((prev) => ({
                    ...prev,
                    sick_leave: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2.5 pr-12 text-sm font-semibold rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#687781] font-semibold">
                days
              </span>
            </div>
          </div>

          {/* CASUAL */}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#687781] block mb-1.5">
              Casual Leave
            </label>

            <div className="relative">
              <input
                type="number"
                min="0"
                value={policy.casual_leave}
                onChange={(e) =>
                  setPolicy((prev) => ({
                    ...prev,
                    casual_leave: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2.5 pr-12 text-sm font-semibold rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#687781] font-semibold">
                days
              </span>
            </div>
          </div>

          {/* MANAGER THRESHOLD */}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#687781] block mb-1.5">
              Manager Approval Up To
            </label>

            <div className="relative">
              <input
                type="number"
                min="1"
                value={policy.manager_approval_days}
                onChange={(e) =>
                  setPolicy((prev) => ({
                    ...prev,
                    manager_approval_days: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2.5 pr-12 text-sm font-semibold rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#687781] font-semibold">
                days
              </span>
            </div>
          </div>

          {/* HR THRESHOLD */}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#687781] block mb-1.5">
              HR Direct Approval From
            </label>

            <div className="relative">
              <input
                type="number"
                min="1"
                value={policy.hr_direct_approval_days}
                onChange={(e) =>
                  setPolicy((prev) => ({
                    ...prev,
                    hr_direct_approval_days: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2.5 pr-12 text-sm font-semibold rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#687781] font-semibold">
                days
              </span>
            </div>
          </div>
        </div>

        {/* UPCOMING POLICIES */}

        {upcomingPolicies.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#687781]">
              Scheduled policies:
            </span>
            {upcomingPolicies.map((p) => (
              <span
                key={p.effective_year}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#ebf5ff] text-[#005cb9] border border-[#0875e1]/20"
              >
                <span className="material-symbols-outlined text-[14px]">event_upcoming</span>
                {p.effective_year} — Annual {p.annual_leave}d · Sick {p.sick_leave}d · Casual {p.casual_leave}d
              </span>
            ))}
          </div>
        )}

        {/* POLICY FOOTER */}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-[#dfe5e8]">
          <div className="flex-1">
            {policyError && (
              <div className="flex items-start gap-2 p-3 bg-[#ffdad6]/70 border border-[#ba1a1a]/30 rounded-xl animate-in fade-in">
                <span className="material-symbols-outlined text-[#ba1a1a] text-[18px] shrink-0">
                  error
                </span>
                <span className="text-xs text-[#ba1a1a] font-semibold">
                  {policyError}
                </span>
              </div>
            )}

            {!policyError && policyMessage && (
              <span className="text-xs text-[#22874e] font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">
                  check_circle
                </span>

                {policyMessage}
              </span>
            )}
          </div>

          <Button
            variant="primary"
            icon="save"
            loading={policyLoading}
            onClick={savePolicies}
          >
            Save Leave Policy
          </Button>
        </div>
      </Card>

      {/* =====================================================
          REGIONAL HOLIDAY CALENDAR
      ====================================================== */}

      <Card className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#00646f]/10 text-[#00646f] flex items-center justify-center">
            <span className="material-symbols-outlined">upload_file</span>
          </div>

          <div>
            <h3 className="text-base font-bold text-[#0f1d27]">
              Regional Holiday Calendar
            </h3>

            <p className="text-xs text-[#687781] mt-1">
              Upload the organization's regional holiday calendar in Excel
              format.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* REGION */}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#687781] block mb-1.5">
              Region
            </label>

            <select
              value={calendarRegion}
              onChange={(e) => setCalendarRegion(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
            >
              <option value="India">India</option>

              <option value="UK">United Kingdom</option>

              <option value="US">United States</option>

              <option value="Singapore">Singapore</option>
            </select>
          </div>

          {/* FILE */}

          <div>
            <label
              htmlFor="regional-calendar-file"
              className="text-[10px] font-bold uppercase tracking-wider text-[#687781] block mb-1.5"
            >
              Excel Calendar
            </label>

            <input
              id="regional-calendar-file"
              type="file"
              accept=".xlsx"
              onChange={(e) => setCalendarFile(e.target.files?.[0] || null)}
              className="w-full text-xs border border-[#dfe5e8] rounded-xl p-2 bg-white"
            />
          </div>

          {/* UPLOAD */}

          <div className="flex items-end">
            <Button
              variant="outline"
              icon="cloud_upload"
              loading={calendarLoading}
              onClick={uploadCalendar}
              className="w-full"
            >
              Upload Calendar
            </Button>
          </div>
        </div>

        {/* MESSAGE */}

        {calendarError && (
          <div className="mt-4 p-3 rounded-xl bg-[#fff1f0] border border-[#ba1a1a]/20 text-xs text-[#ba1a1a] font-medium">
            {calendarError}
          </div>
        )}

        {calendarMessage && (
          <div className="mt-4 p-3 rounded-xl bg-[#f0faf5] border border-[#22874e]/20 text-xs text-[#22874e] font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">
              check_circle
            </span>

            {calendarMessage}
          </div>
        )}

        {/* EXCEL FORMAT */}

        <div className="mt-4 p-3 rounded-xl bg-[#f8fbfb] border border-[#dfe5e8]">
          <p className="text-[11px] text-[#687781]">
            <span className="font-bold text-[#3e494a]">Excel format:</span> Date
            | Holiday Name
          </p>
        </div>
      </Card>

      {/* =====================================================
          METRICS
      ====================================================== */}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* TOTAL STAFF */}

        <Card className="p-4 flex flex-col justify-between hover:border-[#00646f]/40 transition-colors">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Staff
            </span>

            <span className="material-symbols-outlined text-[#00646f] text-[20px]">
              groups
            </span>
          </div>

          <div>
            <span className="text-2xl font-bold text-[#0f1d27] block">
              {stats.totalEmployees}
            </span>

            <span className="text-[11px] text-[#687781]">
              Active team members
            </span>
          </div>
        </Card>

        {/* ON LEAVE */}

        <Card className="p-4 flex flex-col justify-between hover:border-[#00646f]/40 transition-colors">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              On Leave Today
            </span>

            <span className="material-symbols-outlined text-[#00646f] text-[20px]">
              beach_access
            </span>
          </div>

          <div>
            <span className="text-2xl font-bold text-[#0f1d27] block">
              {stats.onLeaveToday}
            </span>

            <span className="text-[11px] text-[#00646f] font-semibold">
              {stats.onLeavePercentage}% of workforce
            </span>
          </div>
        </Card>

        {/* PENDING */}

        <Card className="p-4 flex flex-col justify-between hover:border-[#b7791f]/50 transition-colors border-[#b7791f]/20 bg-[#fffdfa]">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Pending HR Action
            </span>

            <span className="material-symbols-outlined text-[#b7791f] text-[20px]">
              pending_actions
            </span>
          </div>

          <div>
            <span className="text-2xl font-bold text-[#b7791f] block">
              {pendingRequests.length}
            </span>

            <span className="text-[11px] text-[#687781]">Awaiting review</span>
          </div>
        </Card>

        {/* APPROVED */}

        <Card className="p-4 flex flex-col justify-between hover:border-[#22874e]/40 transition-colors">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Approved
            </span>

            <span className="material-symbols-outlined text-[#22874e] text-[20px]">
              check_circle
            </span>
          </div>

          <div>
            <span className="text-2xl font-bold text-[#22874e] block">
              {stats.approvedThisMonth}
            </span>

            <span className="text-[11px] text-[#687781]">
              {stats.approvedThisMonthDays} days taken
            </span>
          </div>
        </Card>

        {/* REJECTED */}

        <Card className="p-4 flex flex-col justify-between hover:border-[#ba1a1a]/40 transition-colors">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Rejected
            </span>

            <span className="material-symbols-outlined text-[#ba1a1a] text-[20px]">
              cancel
            </span>
          </div>

          <div>
            <span className="text-2xl font-bold text-[#0f1d27] block">
              {stats.rejectedThisMonth}
            </span>

            <span className="text-[11px] text-[#687781]">Policy conflicts</span>
          </div>
        </Card>

        {/* UPCOMING */}

        <Card className="p-4 flex flex-col justify-between hover:border-[#3d6fa8]/40 transition-colors">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Upcoming
            </span>

            <span className="material-symbols-outlined text-[#3d6fa8] text-[20px]">
              calendar_month
            </span>
          </div>

          <div>
            <span className="text-2xl font-bold text-[#3d6fa8] block">
              {stats.upcomingLeave}
            </span>

            <span className="text-[11px] text-[#687781]">Scheduled leaves</span>
          </div>
        </Card>
      </div>

      {/* =====================================================
          DEPARTMENT ANALYTICS
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#0f1d27]">
                Department Leave Utilization
              </h3>

              <p className="text-xs text-[#687781]">
                Approved leave days taken per department
              </p>
            </div>

            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#f0f4f7] text-[#3e494a]">
              YTD 2026
            </span>
          </div>

          <div className="space-y-4">
            {stats.departmentStats.map((dept) => {
              const maxDays = 50;

              const percentage = Math.min(
                100,
                Math.round((dept.totalDays / maxDays) * 100),
              );

              return (
                <div key={dept.department} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#0f1d27]">
                        {dept.department}
                      </span>

                      <span className="text-[11px] text-[#687781]">
                        ({dept.employeeCount} staff)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {dept.pendingCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#fff4e5] text-[#b7791f] text-[10px] font-bold">
                          {dept.pendingCount} pending
                        </span>
                      )}

                      <span className="font-bold text-[#00646f]">
                        {dept.totalDays} Days
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-[#f0f4f7] h-2.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-[#00646f] h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-base font-bold text-[#0f1d27] mb-1">
              Leave Types Distribution
            </h3>

            <p className="text-xs text-[#687781] mb-4">
              Total requests filed by category
            </p>

            <div className="space-y-3">
              {stats.leaveTypeStats.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fbfb] border border-[#dfe5e8]/60"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: item.color,
                      }}
                    />

                    <span className="text-xs font-semibold text-[#0f1d27]">
                      {item.type}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-[#0f1d27] block">
                      {item.count} requests
                    </span>

                    <span className="text-[10px] text-[#687781]">
                      {item.days} days approved
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-[#f8fbfb] to-[#ebf5ff]/40 border-[#00646f]/20">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-[#00646f] text-[24px]">
                verified
              </span>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#00646f]">
                  Statutory Quota Compliance
                </h4>

                <p className="text-[11px] text-[#687781]">
                  Organization-wide leave policy audit
                </p>
              </div>
            </div>

            <p className="text-xs text-[#3e494a] leading-relaxed">
              All 22 active organization balances are within mandatory
              regulatory thresholds. Average annual PTO utilization is at{" "}
              <span className="font-bold text-[#0f1d27]">44.2%</span> for Q3/Q4.
            </p>
          </Card>
        </div>
      </div>

      {/* =====================================================
          HR ACTION QUEUE
      ====================================================== */}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#0f1d27]">
              Organization Requests Awaiting Action
            </h3>

            <p className="text-xs text-[#687781]">
              Pending leaves requiring manager or HR review
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/hr/all-requests")}
          >
            View All ({allRequests.length})
          </Button>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="p-8 text-center bg-[#f8fbfb] rounded-xl border border-[#dfe5e8] text-xs text-[#687781]">
            <span className="material-symbols-outlined text-[#22874e] text-[36px] block mb-2">
              check_circle
            </span>
            No pending leave requests in the organization queue.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#dfe5e8] text-[11px] font-bold text-[#687781] uppercase tracking-wider">
                  <th className="pb-3 px-3">Employee</th>

                  <th className="pb-3 px-3">Department</th>

                  <th className="pb-3 px-3">Leave Type</th>

                  <th className="pb-3 px-3">Dates</th>

                  <th className="pb-3 px-3">Days</th>

                  <th className="pb-3 px-3">Manager</th>

                  <th className="pb-3 px-3">Status</th>

                  <th className="pb-3 px-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#dfe5e8]/60 text-xs">
                {pendingRequests.slice(0, 5).map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-[#ebf5ff]/30 transition-colors"
                  >
                    <td className="py-3 px-3 font-semibold text-[#0f1d27]">
                      {req.employeeName}
                    </td>

                    <td className="py-3 px-3 text-[#3e494a]">
                      {req.department}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-medium text-[#00646f]">
                        {req.leaveType}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-[#687781]">
                      {req.dateDisplay}
                    </td>

                    <td className="py-3 px-3 font-bold text-[#0f1d27]">
                      {req.durationDays}d
                    </td>

                    <td className="py-3 px-3 text-[#687781]">
                      {req.managerName || "Not Assigned"}
                    </td>

                    <td className="py-3 px-3">
                      <StatusBadge status={req.status} stage={req.approvalStage} />
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenReview(req, "review")}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#00646f] hover:bg-[#ebf5ff] transition-colors cursor-pointer"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* =====================================================
          REVIEW MODAL
      ====================================================== */}

      {selectedRequest && (
        <HrReviewModal
          isOpen={!!selectedRequest}
          onClose={handleCloseReview}
          request={selectedRequest}
          initialMode={modalMode}
        />
      )}
    </div>
  );
}
