import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { LeaveApprovalModal } from '../../components/common/LeaveApprovalModal.jsx';

export function TeamRequestsPage() {
  const { currentUser } = useAuth();
  const { getTeamRequests } = useLeave();

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalMode, setModalMode] = useState('review');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Strict manager scope: request.managerId === currentUser.id && request.userId !== currentUser.id
  const teamRequests = getTeamRequests(currentUser?.id);

  // Filter & Sort
  const filteredAndSortedRequests = useMemo(() => {
    let result = [...teamRequests];

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(q) ||
          r.leaveType.toLowerCase().includes(q) ||
          (r.department && r.department.toLowerCase().includes(q)) ||
          (r.reason && r.reason.toLowerCase().includes(q))
      );
    }

    // 2. Status Filter
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }

    // 3. Type Filter
    if (typeFilter !== 'all') {
      result = result.filter((r) => r.typeKey === typeFilter);
    }

    // 4. Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.submittedAt || b.lastUpdated || 0) - new Date(a.submittedAt || a.lastUpdated || 0);
      }
      if (sortBy === 'oldest') {
        return new Date(a.submittedAt || a.lastUpdated || 0) - new Date(b.submittedAt || b.lastUpdated || 0);
      }
      if (sortBy === 'name') {
        return a.employeeName.localeCompare(b.employeeName);
      }
      if (sortBy === 'duration') {
        return (b.durationDays || 0) - (a.durationDays || 0);
      }
      return 0;
    });

    return result;
  }, [teamRequests, searchQuery, statusFilter, typeFilter, sortBy]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedRequests.length / itemsPerPage) || 1;
  const paginatedRequests = filteredAndSortedRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenReview = (req, mode = 'review') => {
    setSelectedRequest(req);
    setModalMode(mode);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Leave Requests"
        subtitle={`All submitted and processed leave requests for ${currentUser?.department || 'your'} team.`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#687781] font-semibold">
            Total: {teamRequests.length} records
          </span>
        </div>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#dfe5e8] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#687781] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by employee name, leave type, or reason..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#f5f7f8] border border-[#dfe5e8] rounded-xl text-[#0f1d27] placeholder-[#687781] focus:outline-none focus:border-[#00646f]"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center bg-[#f5f7f8] p-1 rounded-xl border border-[#dfe5e8] overflow-x-auto">
            {['all', 'pending', 'approved', 'rejected'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-white text-[#00646f] shadow-2xs'
                    : 'text-[#687781] hover:text-[#0f1d27]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Leave Type Dropdown */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs bg-[#f5f7f8] border border-[#dfe5e8] rounded-xl px-3 py-2 text-[#0f1d27] focus:outline-none focus:border-[#00646f]"
          >
            <option value="all">All Leave Types</option>
            <option value="annual">Annual Leave</option>
            <option value="sick">Sick Leave</option>
            <option value="casual">Casual Leave</option>
            <option value="unpaid">Unpaid Leave</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs bg-[#f5f7f8] border border-[#dfe5e8] rounded-xl px-3 py-2 text-[#0f1d27] focus:outline-none focus:border-[#00646f]"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Employee Name (A-Z)</option>
            <option value="duration">Longest Duration</option>
          </select>

          {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || sortBy !== 'newest') && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-[#00646f] hover:underline font-semibold px-2 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Requests Table */}
      <Card className="p-0 overflow-hidden border-[#dfe5e8]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fbfb] border-b border-[#dfe5e8]">
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Employee
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Department
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Leave Type
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Start Date
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  End Date
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Duration
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Status
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Submitted
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfe5e8]/60">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-14 text-center text-xs text-[#687781]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[#687781] text-[36px]">
                        search_off
                      </span>
                      <p className="font-semibold text-sm text-[#0f1d27]">
                        No team requests matching your filter criteria.
                      </p>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="text-xs text-[#00646f] hover:underline font-semibold mt-1 cursor-pointer"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => handleOpenReview(req, 'review')}
                    className="hover:bg-[#ebf5ff]/30 transition-colors cursor-pointer"
                  >
                    <td className="p-4 px-6">
                      <div className="flex items-center gap-3">
                        {req.avatar ? (
                          <img
                            src={req.avatar}
                            alt={req.employeeName}
                            className="w-8 h-8 rounded-full object-cover border border-[#dfe5e8]"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-xs">
                            {req.initials || req.employeeName?.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-[#0f1d27] hover:text-[#00646f]">
                            {req.employeeName}
                          </p>
                          <p className="text-[11px] text-[#687781]">{req.position || 'Team Member'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 px-6 text-xs text-[#3e494a]">{req.department}</td>
                    <td className="p-4 px-6">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0f1d27]">
                        <span className="material-symbols-outlined text-[16px] text-[#00646f]">
                          {req.typeKey === 'sick' ? 'medical_services' : 'event'}
                        </span>
                        {req.leaveType}
                        {req.unpaidDays > 0 && (
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#ffdad6] text-[#ba1a1a]">
                            +{req.unpaidDays}d unpaid
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="p-4 px-6 text-xs text-[#3e494a]">{req.startDate}</td>
                    <td className="p-4 px-6 text-xs text-[#3e494a]">{req.endDate}</td>
                    <td className="p-4 px-6 text-xs font-bold text-[#00646f]">
                      {req.durationDays} {req.durationDays === 1 ? 'day' : 'days'}
                    </td>
                    <td className="p-4 px-6">
                      <StatusBadge status={req.status} stage={req.approvalStage} />
                    </td>
                    <td className="p-4 px-6 text-xs text-[#687781]">
                      {req.submittedDisplay || req.submittedAt || '—'}
                    </td>
                    <td className="p-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="visibility"
                          onClick={() => handleOpenReview(req, 'review')}
                        >
                          Review
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredAndSortedRequests.length > 0 && (
          <div className="p-4 px-6 border-t border-[#dfe5e8] bg-[#f8fbfb] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#687781]">
            <span>
              Showing{' '}
              <span className="font-semibold text-[#0f1d27]">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-[#0f1d27]">
                {Math.min(currentPage * itemsPerPage, filteredAndSortedRequests.length)}
              </span>{' '}
              of <span className="font-semibold text-[#0f1d27]">{filteredAndSortedRequests.length}</span> requests
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-[#dfe5e8] bg-white text-[#0f1d27] hover:bg-[#f5f7f8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] block">chevron_left</span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-[#00646f] text-white'
                      : 'bg-white border border-[#dfe5e8] text-[#0f1d27] hover:bg-[#f5f7f8]'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-[#dfe5e8] bg-white text-[#0f1d27] hover:bg-[#f5f7f8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] block">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Leave Review Modal */}
      <LeaveApprovalModal
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        initialMode={modalMode}
      />
    </div>
  );
}
