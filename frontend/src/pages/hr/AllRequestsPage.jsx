import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useLeave } from "../../context/LeaveContext.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { Card } from "../../components/common/Card.jsx";
import { Button } from "../../components/common/Button.jsx";
import { StatusBadge } from "../../components/common/StatusBadge.jsx";
import { HrReviewModal } from "../../components/common/HrReviewModal.jsx";

export function AllRequestsPage({ defaultStatus = "all" }) {
  const { getOrganizationRequests } = useLeave();

  const [searchParams] = useSearchParams();

  const initialStatus = searchParams.get("status") || defaultStatus;

  // =========================================================
  // FILTER STATE
  // =========================================================

  const [searchQuery, setSearchQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState(initialStatus);

  const [typeFilter, setTypeFilter] = useState("all");

  const [departmentFilter, setDepartmentFilter] = useState("all");

  const [managerFilter, setManagerFilter] = useState("all");

  const [sortBy, setSortBy] = useState("newest");

  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 10;

  // =========================================================
  // REVIEW MODAL STATE
  // =========================================================

  const [selectedRequest, setSelectedRequest] = useState(null);

  const [modalMode, setModalMode] = useState("review");

  // =========================================================
  // ORGANIZATION REQUESTS
  // =========================================================

  const allRequests = getOrganizationRequests();

  // =========================================================
  // UNIQUE DEPARTMENTS
  // =========================================================

  const departments = useMemo(() => {
    const set = new Set(allRequests.map((r) => r.department).filter(Boolean));

    return ["all", ...Array.from(set).sort()];
  }, [allRequests]);

  // =========================================================
  // UNIQUE MANAGERS
  // =========================================================

  const managers = useMemo(() => {
    const set = new Set(allRequests.map((r) => r.managerName).filter(Boolean));

    return ["all", ...Array.from(set).sort()];
  }, [allRequests]);

  // =========================================================
  // UNIQUE LEAVE TYPES
  // =========================================================

  const leaveTypes = useMemo(() => {
    const set = new Set(allRequests.map((r) => r.leaveType).filter(Boolean));

    return ["all", ...Array.from(set).sort()];
  }, [allRequests]);

  // =========================================================
  // FILTERING
  // =========================================================

  const filteredRequests = useMemo(() => {
    return allRequests.filter((req) => {
      // -----------------------------------------------------
      // 1. SEARCH
      // -----------------------------------------------------

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();

        const nameMatch = req.employeeName?.toLowerCase().includes(q);

        const deptMatch = req.department?.toLowerCase().includes(q);

        const reasonMatch = req.reason?.toLowerCase().includes(q);

        const idMatch = req.id?.toLowerCase().includes(q);

        const typeMatch = req.leaveType?.toLowerCase().includes(q);

        if (
          !nameMatch &&
          !deptMatch &&
          !reasonMatch &&
          !idMatch &&
          !typeMatch
        ) {
          return false;
        }
      }

      // -----------------------------------------------------
      // 2. STATUS
      //
      // IMPORTANT:
      //
      // pending_hr is the second HR approval stage.
      // -----------------------------------------------------

      if (statusFilter !== "all" && req.status !== statusFilter) {
        return false;
      }

      // -----------------------------------------------------
      // 3. LEAVE TYPE
      // -----------------------------------------------------

      if (typeFilter !== "all" && req.leaveType !== typeFilter) {
        return false;
      }

      // -----------------------------------------------------
      // 4. DEPARTMENT
      // -----------------------------------------------------

      if (departmentFilter !== "all" && req.department !== departmentFilter) {
        return false;
      }

      // -----------------------------------------------------
      // 5. MANAGER
      // -----------------------------------------------------

      if (managerFilter !== "all" && req.managerName !== managerFilter) {
        return false;
      }

      return true;
    });
  }, [
    allRequests,
    searchQuery,
    statusFilter,
    typeFilter,
    departmentFilter,
    managerFilter,
  ]);

  // =========================================================
  // SORTING
  // =========================================================

  const sortedRequests = useMemo(() => {
    const list = [...filteredRequests];

    list.sort((a, b) => {
      if (sortBy === "newest") {
        return (
          new Date(b.submittedAt || b.lastUpdated || 0) -
          new Date(a.submittedAt || a.lastUpdated || 0)
        );
      }

      if (sortBy === "oldest") {
        return (
          new Date(a.submittedAt || a.lastUpdated || 0) -
          new Date(b.submittedAt || b.lastUpdated || 0)
        );
      }

      if (sortBy === "duration-desc") {
        return (b.durationDays || 0) - (a.durationDays || 0);
      }

      if (sortBy === "duration-asc") {
        return (a.durationDays || 0) - (b.durationDays || 0);
      }

      if (sortBy === "name-asc") {
        return (a.employeeName || "").localeCompare(b.employeeName || "");
      }

      return 0;
    });

    return list;
  }, [filteredRequests, sortBy]);

  // =========================================================
  // PAGINATION
  // =========================================================

  const totalPages = Math.ceil(sortedRequests.length / pageSize) || 1;

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return sortedRequests.slice(start, start + pageSize);
  }, [sortedRequests, currentPage]);

  // =========================================================
  // CLEAR FILTERS
  // =========================================================

  const handleClearFilters = () => {
    setSearchQuery("");

    setStatusFilter("all");

    setTypeFilter("all");

    setDepartmentFilter("all");

    setManagerFilter("all");

    setSortBy("newest");

    setCurrentPage(1);
  };

  // =========================================================
  // ACTIVE FILTER CHECK
  // =========================================================

  const hasActiveFilters =
    searchQuery ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    departmentFilter !== "all" ||
    managerFilter !== "all";

  // =========================================================
  // OPEN REVIEW MODAL
  // =========================================================

  const handleOpenReview = (request, mode = "review") => {
    setSelectedRequest(request);

    setModalMode(mode);
  };

  // =========================================================
  // EXPORT CSV
  // =========================================================

  const handleExportCSV = () => {
    const headers = [
      "Request ID",
      "Employee Name",
      "Department",
      "Manager",
      "Leave Type",
      "Start Date",
      "End Date",
      "Duration (Days)",
      "Status",
      "Submitted At",
      "Reason",
    ];

    const rows = sortedRequests.map((r) => [
      `"${r.id}"`,

      `"${r.employeeName || ""}"`,

      `"${r.department || ""}"`,

      `"${r.managerName || ""}"`,

      `"${r.leaveType || ""}"`,

      `"${r.startDate || ""}"`,

      `"${r.endDate || ""}"`,

      r.durationDays || 1,

      `"${r.status}"`,

      `"${r.submittedDisplay || r.submittedAt || ""}"`,

      `"${(r.reason || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.setAttribute("href", url);

    link.setAttribute(
      "download",
      `LeaveTrack_Leave_Requests_${new Date().toISOString().slice(0, 10)}.csv`,
    );

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="space-y-6">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <PageHeader
        title="All Organization Requests"
        subtitle="Search, audit, filter, and review all leave applications across all departments."
      >
        <Button
          variant="outline"
          icon="download"
          onClick={handleExportCSV}
          disabled={sortedRequests.length === 0}
        >
          Export CSV ({sortedRequests.length})
        </Button>
      </PageHeader>

      {/* =====================================================
          FILTER TOOLBAR
      ====================================================== */}

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* SEARCH */}

          <div className="relative">
            <label className="text-[10px] font-bold uppercase text-[#687781] block mb-1">
              Search
            </label>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#687781] text-[18px]">
                search
              </span>

              <input
                type="text"
                placeholder="Search staff, ID, note..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);

                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              />
            </div>
          </div>

          {/* STATUS */}

          <div>
            <label className="text-[10px] font-bold uppercase text-[#687781] block mb-1">
              Status
            </label>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);

                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
            >
              <option value="all">All Statuses</option>

              <option value="pending">Pending</option>

              <option value="pending_hr">Pending HR</option>

              <option value="approved">Approved</option>

              <option value="rejected">Rejected</option>

              <option value="draft">Draft</option>

              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* LEAVE TYPE */}

          <div>
            <label className="text-[10px] font-bold uppercase text-[#687781] block mb-1">
              Leave Type
            </label>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);

                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
            >
              {leaveTypes.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "All Leave Types" : t}
                </option>
              ))}
            </select>
          </div>

          {/* DEPARTMENT */}

          <div>
            <label className="text-[10px] font-bold uppercase text-[#687781] block mb-1">
              Department
            </label>

            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);

                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === "all" ? "All Departments" : d}
                </option>
              ))}
            </select>
          </div>

          {/* SORT */}

          <div>
            <label className="text-[10px] font-bold uppercase text-[#687781] block mb-1">
              Sort By
            </label>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);

                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
            >
              <option value="newest">Newest First</option>

              <option value="oldest">Oldest First</option>

              <option value="duration-desc">Duration (Highest)</option>

              <option value="duration-asc">Duration (Lowest)</option>

              <option value="name-asc">Employee (A - Z)</option>
            </select>
          </div>
        </div>

        {/* ===================================================
            FILTER SUMMARY
        ==================================================== */}

        <div className="flex items-center justify-between pt-2 border-t border-[#dfe5e8]/60 text-xs">
          <div className="flex items-center gap-2 text-[#687781]">
            <span>
              Showing{" "}
              <strong className="text-[#0f1d27]">
                {sortedRequests.length}
              </strong>{" "}
              of{" "}
              <strong className="text-[#0f1d27]">{allRequests.length}</strong>{" "}
              requests
            </span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-[#00646f] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                filter_alt_off
              </span>
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* =====================================================
          REQUEST TABLE
      ====================================================== */}

      <Card className="p-0 overflow-hidden">
        {paginatedRequests.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[#687781] text-[40px] block mb-2">
              find_in_page
            </span>

            <h3 className="text-sm font-bold text-[#0f1d27]">
              No requests matched your filter criteria
            </h3>

            <p className="text-xs text-[#687781] mt-1 max-w-sm mx-auto">
              Try adjusting or clearing your search queries, department
              selections, or status filters.
            </p>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleClearFilters}
              >
                Clear All Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f7f8]/80 border-b border-[#dfe5e8] text-[11px] font-bold text-[#687781] uppercase tracking-wider">
                  <th className="py-3 px-5">Employee & ID</th>

                  <th className="py-3 px-4">Department</th>

                  <th className="py-3 px-4">Manager</th>

                  <th className="py-3 px-4">Type & Duration</th>

                  <th className="py-3 px-4">Scheduled Dates</th>

                  <th className="py-3 px-4">Status</th>

                  <th className="py-3 px-4">Submitted</th>

                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#dfe5e8]/60 text-xs">
                {paginatedRequests.map((req) => {
                  /*
                   * HR can take action when:
                   *
                   * pending
                   * pending_hr
                   *
                   * Other statuses are view-only.
                   */

                  const canTakeAction =
                    req.status === "pending" || req.status === "pending_hr";

                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-[#ebf5ff]/30 transition-colors"
                    >
                      {/* EMPLOYEE */}

                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          {req.avatar ? (
                            <img
                              src={req.avatar}
                              alt={req.employeeName}
                              className="w-8 h-8 rounded-full object-cover border border-[#dfe5e8]"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-[11px]">
                              {req.initials ||
                                req.employeeName?.slice(0, 2).toUpperCase() ||
                                "EM"}
                            </div>
                          )}

                          <div>
                            <span className="font-bold text-[#0f1d27] block">
                              {req.employeeName}
                            </span>

                            <span className="font-mono text-[10px] text-[#687781]">
                              {req.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* DEPARTMENT */}

                      <td className="py-3.5 px-4 text-[#3e494a] font-medium">
                        {req.department || "Not Assigned"}
                      </td>

                      {/* MANAGER */}

                      <td className="py-3.5 px-4 text-[#687781]">
                        {req.managerName || "Not Assigned"}
                      </td>

                      {/* LEAVE TYPE */}

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-[#00646f] block">
                          {req.leaveType}
                          {req.unpaidDays > 0 && (
                            <span className="ml-1.5 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#ffdad6] text-[#ba1a1a] align-middle">
                              +{req.unpaidDays}d unpaid
                            </span>
                          )}
                        </span>

                        <span className="text-[11px] text-[#687781] font-medium">
                          {req.unpaidDays > 0
                            ? `${req.durationDays || 1} Day(s) — ${Math.max(0, (req.durationDays || 1) - req.unpaidDays)} paid · ${req.unpaidDays} unpaid`
                            : `${req.durationDays || 1} Day(s)`}
                        </span>
                      </td>

                      {/* DATES */}

                      <td className="py-3.5 px-4">
                        <span className="text-[#0f1d27] font-medium block">
                          {req.dateDisplay ||
                            `${req.startDate || ""} to ${req.endDate || ""}`}
                        </span>

                        <span className="text-[10px] text-[#687781]">
                          {req.startDate || "N/A"}

                          {" to "}

                          {req.endDate || "N/A"}
                        </span>
                      </td>

                      {/* STATUS */}

                      <td className="py-3.5 px-4">
                        <StatusBadge status={req.status} stage={req.approvalStage} />
                      </td>

                      {/* SUBMITTED */}

                      <td className="py-3.5 px-4 text-[#687781]">
                        {req.submittedDisplay || req.submittedAt || "N/A"}
                      </td>

                      {/* ACTION */}

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenReview(req, "review")}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              canTakeAction
                                ? "bg-[#00646f] text-white hover:bg-[#004e57]"
                                : "bg-[#f0f4f7] text-[#00646f] hover:bg-[#00646f] hover:text-white"
                            }`}
                          >
                            {canTakeAction ? "Review & Action" : "View Details"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ===================================================
            PAGINATION
        ==================================================== */}

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[#dfe5e8] bg-[#f8fbfb] flex items-center justify-between text-xs">
            <span className="text-[#687781]">
              Page <strong className="text-[#0f1d27]">{currentPage}</strong> of{" "}
              <strong className="text-[#0f1d27]">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              {/* PREVIOUS */}

              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-[#dfe5e8] bg-white text-[#3e494a] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f5f7f8] cursor-pointer"
              >
                Previous
              </button>

              {/* PAGE NUMBERS */}

              {Array.from(
                {
                  length: totalPages,
                },
                (_, i) => i + 1,
              ).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold cursor-pointer ${
                    currentPage === page
                      ? "bg-[#00646f] text-white"
                      : "bg-white border border-[#dfe5e8] text-[#3e494a] hover:bg-[#f5f7f8]"
                  }`}
                >
                  {page}
                </button>
              ))}

              {/* NEXT */}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="px-2.5 py-1 rounded-lg border border-[#dfe5e8] bg-white text-[#3e494a] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f5f7f8] cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* =====================================================
          HR REVIEW MODAL
      ====================================================== */}

      {selectedRequest && (
        <HrReviewModal
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          request={selectedRequest}
          initialMode={modalMode}
        />
      )}
    </div>
  );
}
