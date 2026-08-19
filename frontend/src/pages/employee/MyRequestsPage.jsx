import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLeave } from "../../context/LeaveContext.jsx";
import { Card } from "../../components/common/Card.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { LeaveDetailsModal } from "../../components/common/LeaveDetailsModal.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";

export function MyRequestsPage() {
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();
  const { getMyRequests, deleteDraft, cancelLeaveRequest } = useLeave();

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Retrieve user's isolated leave requests
  const myRequests = getMyRequests(currentUser?.id);

  // Status Counts for tab chips
  const counts = useMemo(() => {
    return {
      all: myRequests.length,
      draft: myRequests.filter((r) => r.status === "draft").length,

      // Both manager-pending and HR-pending are active requests.
      pending: myRequests.filter(
        (r) => r.status === "pending" || r.status === "pending_hr",
      ).length,

      approved: myRequests.filter((r) => r.status === "approved").length,

      rejected: myRequests.filter((r) => r.status === "rejected").length,
    };
  }, [myRequests]);

  // Filtered & Sorted items
  const filteredRequests = useMemo(() => {
    return myRequests
      .filter((req) => {
        // Status filter
        if (statusFilter !== "all") {
          if (
            statusFilter === "pending" &&
            req.status !== "pending" &&
            req.status !== "pending_hr"
          ) {
            return false;
          }

          if (statusFilter !== "pending" && req.status !== statusFilter) {
            return false;
          }
        }
        // Type filter
        if (typeFilter !== "all" && req.typeKey !== typeFilter) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchType = req.leaveType?.toLowerCase().includes(query);
          const matchReason = req.reason?.toLowerCase().includes(query);
          const matchDates = req.dateDisplay?.toLowerCase().includes(query);
          if (!matchType && !matchReason && !matchDates) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let compare = 0;
        if (sortField === "date") {
          const dateA = a.startDate || a.submittedAt || "";
          const dateB = b.startDate || b.submittedAt || "";
          compare = dateA.localeCompare(dateB);
        } else if (sortField === "duration") {
          compare = (a.durationDays || 0) - (b.durationDays || 0);
        } else if (sortField === "status") {
          compare = (a.status || "").localeCompare(b.status || "");
        }
        return sortOrder === "desc" ? -compare : compare;
      });
  }, [myRequests, statusFilter, typeFilter, searchQuery, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage]);

  const handleEditDraft = (req) => {
    const editPath =
      role === "manager"
        ? `/manager/request-leave?id=${req.id}`
        : `/employee/request-leave?id=${req.id}`;
    navigate(editPath);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteDraft(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleConfirmCancel = () => {
    if (cancelTarget) {
      cancelLeaveRequest(cancelTarget.id, "Cancelled by user from My Leave");
      setCancelTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f1d27]">
            My Leave Requests
          </h1>
          <p className="text-xs sm:text-sm text-[#687781] mt-0.5">
            Track, filter, edit drafts, and view approval timelines for all your
            leave applications.
          </p>
        </div>
        <Button
          variant="primary"
          icon="add"
          onClick={() => {
            const reqPath =
              role === "manager"
                ? "/manager/request-leave"
                : "/employee/request-leave";
            navigate(reqPath);
          }}
        >
          Request Leave
        </Button>
      </Card>

      {/* Filter and Search Bar Card */}
      <Card className="p-4 sm:p-5 space-y-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#dfe5e8]">
          {[
            { key: "all", label: "All Requests", count: counts.all },
            { key: "pending", label: "Pending Review", count: counts.pending },
            { key: "approved", label: "Approved", count: counts.approved },
            { key: "draft", label: "Drafts", count: counts.draft },
            { key: "rejected", label: "Rejected", count: counts.rejected },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                statusFilter === tab.key
                  ? "bg-[#00646f] text-white shadow-sm"
                  : "bg-[#ebf5ff] text-[#3e494a] hover:bg-[#dfe5e8]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  statusFilter === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-white text-[#687781]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search, Type Filter & Sort Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="flex items-center bg-[#ebf5ff] px-3.5 py-2 rounded-xl border border-[#bdc9ca]/30 focus-within:ring-2 focus-within:ring-[#00646f]/30">
            <span className="material-symbols-outlined text-[#687781] text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search keyword or reason..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent border-none focus:outline-none text-xs w-full ml-2 text-[#0f1d27] placeholder:text-[#687781]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[#687781] hover:text-[#0f1d27]"
              >
                <span className="material-symbols-outlined text-[16px]">
                  close
                </span>
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex items-center bg-[#ebf5ff] px-3 py-2 rounded-xl border border-[#bdc9ca]/30">
            <span className="material-symbols-outlined text-[#687781] text-[18px] mr-2">
              category
            </span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent border-none focus:outline-none text-xs w-full text-[#0f1d27]"
            >
              <option value="all">All Leave Types</option>
              <option value="annual">Annual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="casual">Casual Leave</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
          </div>

          {/* Sort Field */}
          <div className="flex items-center bg-[#ebf5ff] px-3 py-2 rounded-xl border border-[#bdc9ca]/30">
            <span className="material-symbols-outlined text-[#687781] text-[18px] mr-2">
              sort
            </span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-xs w-full text-[#0f1d27]"
            >
              <option value="date">Sort by Date</option>
              <option value="duration">Sort by Duration</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>

          {/* Sort Order Toggle */}
          <div className="flex items-center justify-end">
            <button
              onClick={() =>
                setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
              }
              className="flex items-center gap-1.5 px-3 py-2 bg-[#ebf5ff] hover:bg-[#dfe5e8] text-xs font-semibold text-[#00646f] rounded-xl border border-[#bdc9ca]/30 transition-colors w-full justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                {sortOrder === "desc" ? "arrow_downward" : "arrow_upward"}
              </span>
              <span>
                {sortOrder === "desc" ? "Newest First" : "Oldest First"}
              </span>
            </button>
          </div>
        </div>
      </Card>

      {/* Main Leave Requests Table Card */}
      <Card className="p-0 overflow-hidden">
        {paginatedRequests.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No leave requests found"
              description="No applications match your selected filters or search terms."
              actionLabel={
                statusFilter !== "all" || searchQuery
                  ? "Reset Filters"
                  : "Request Leave"
              }
              onAction={() => {
                if (
                  statusFilter !== "all" ||
                  searchQuery ||
                  typeFilter !== "all"
                ) {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setSearchQuery("");
                } else {
                  navigate("/employee/request-leave");
                }
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f7f8] border-b border-[#dfe5e8]">
                  <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                    Leave Type
                  </th>
                  <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                    Working Days
                  </th>
                  <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe5e8]/70">
                {paginatedRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-[#ebf5ff]/35 transition-colors group"
                  >
                    {/* Leave Type */}
                    <td className="p-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`material-symbols-outlined text-[18px] p-1.5 rounded-lg ${
                            req.typeKey === "annual"
                              ? "bg-[#ebf5ff] text-[#00646f]"
                              : req.typeKey === "sick"
                                ? "bg-[#b7791f]/10 text-[#b7791f]"
                                : req.typeKey === "casual"
                                  ? "bg-[#3d6fa8]/10 text-[#3d6fa8]"
                                  : "bg-[#687781]/10 text-[#687781]"
                          }`}
                        >
                          {req.typeKey === "annual"
                            ? "flight_takeoff"
                            : req.typeKey === "sick"
                              ? "medical_services"
                              : req.typeKey === "casual"
                                ? "event_available"
                                : "calendar_today"}
                        </span>
                        <div>
                          <span className="text-sm font-semibold text-[#0f1d27] block">
                            {req.leaveType}
                            {req.unpaidDays > 0 && (
                              <span className="ml-1.5 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#ffdad6] text-[#ba1a1a] align-middle">
                                +{req.unpaidDays}d unpaid
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-[#687781]">
                            {req.submittedDisplay || "Draft"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="p-4 px-6 text-xs font-medium text-[#3e494a]">
                      {req.dateDisplay}
                    </td>

                    {/* Duration */}
                    <td className="p-4 px-6 text-xs font-bold text-[#00646f]">
                      {req.durationDays}{" "}
                      {req.durationDays === 1 ? "Day" : "Days"}
                    </td>

                    {/* Reason */}
                    <td className="p-4 px-6 text-xs text-[#687781] max-w-xs truncate">
                      {req.reason || "No description provided"}
                    </td>

                    {/* Status */}
                    <td className="p-4 px-6">
                      <Badge variant={req.status}>
                        {req.status.charAt(0).toUpperCase() +
                          req.status.slice(1)}
                      </Badge>
                    </td>

                    {/* Actions based on Request Status */}
                    <td className="p-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 1. DRAFT ACTIONS: Edit, Delete, View */}
                        {req.status === "draft" && (
                          <>
                            <button
                              onClick={() => handleEditDraft(req)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#00646f] hover:bg-[#ebf5ff] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="Edit & Submit"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                edit
                              </span>
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => setDeleteTarget(req)}
                              className="p-1 text-[#ba1a1a] hover:bg-[#ffdad6]/60 rounded-lg transition-colors cursor-pointer"
                              title="Delete Draft"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                delete
                              </span>
                            </button>
                          </>
                        )}

                        {/* 2. PENDING ACTIONS: View, Cancel */}
                        {req.status === "pending" && (
                          <>
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#00646f] hover:bg-[#ebf5ff] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                visibility
                              </span>
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => setCancelTarget(req)}
                              className="px-2 py-1 text-xs font-semibold text-[#ba1a1a] hover:bg-[#ffdad6]/60 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="Cancel Request"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                cancel
                              </span>
                              <span>Cancel</span>
                            </button>
                          </>
                        )}

                        {/* 3. APPROVED / REJECTED / CANCELLED: View Details */}
                        {req.status !== "draft" && req.status !== "pending" && (
                          <button
                            onClick={() => setSelectedRequest(req)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#00646f] hover:bg-[#ebf5ff] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              visibility
                            </span>
                            <span>Details</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredRequests.length > 0 && (
          <div className="p-4 px-6 bg-[#f5f7f8]/50 border-t border-[#dfe5e8] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#687781]">
            <div>
              Showing{" "}
              <strong className="text-[#0f1d27]">
                {(currentPage - 1) * itemsPerPage + 1}
              </strong>{" "}
              to{" "}
              <strong className="text-[#0f1d27]">
                {Math.min(currentPage * itemsPerPage, filteredRequests.length)}
              </strong>{" "}
              of{" "}
              <strong className="text-[#0f1d27]">
                {filteredRequests.length}
              </strong>{" "}
              requests
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-[#dfe5e8] hover:bg-[#ebf5ff] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_left
                </span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                      currentPage === page
                        ? "bg-[#00646f] text-white"
                        : "border border-[#dfe5e8] hover:bg-[#ebf5ff] text-[#3e494a]"
                    }`}
                  >
                    {page}
                  </button>
                ),
              )}

              <button
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="p-1.5 rounded-lg border border-[#dfe5e8] hover:bg-[#ebf5ff] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Delete Draft Modal Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#dfe5e8] space-y-4">
            <div className="flex items-center gap-3 text-[#ba1a1a]">
              <span className="material-symbols-outlined text-[24px]">
                delete
              </span>
              <h3 className="text-base font-bold text-[#0f1d27]">
                Delete Draft
              </h3>
            </div>
            <p className="text-xs text-[#687781]">
              Are you sure you want to permanently delete this leave draft (
              {deleteTarget.leaveType} - {deleteTarget.dateDisplay})? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(null)}
              >
                Keep Draft
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="delete"
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Request Modal Confirmation */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#dfe5e8] space-y-4">
            <div className="flex items-center gap-3 text-[#ba1a1a]">
              <span className="material-symbols-outlined text-[24px]">
                cancel
              </span>
              <h3 className="text-base font-bold text-[#0f1d27]">
                Cancel Leave Request
              </h3>
            </div>
            <p className="text-xs text-[#687781]">
              Are you sure you want to cancel your pending{" "}
              {cancelTarget.leaveType} request for{" "}
              <strong>{cancelTarget.dateDisplay}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCancelTarget(null)}
              >
                No, Keep
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="check"
                onClick={handleConfirmCancel}
              >
                Yes, Cancel Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Details & Timeline Modal */}
      <LeaveDetailsModal
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
      />
    </div>
  );
}
