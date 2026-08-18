import React, { useState, useMemo } from 'react';
import { useLeave } from '../../context/LeaveContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';

export function AuditLogsPage() {
  const { getAuditLogs } = useLeave();
  const allLogs = getAuditLogs();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Department list
  const departments = useMemo(() => {
    const set = new Set(allLogs.map((l) => l.department).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [allLogs]);

  // Action types list
  const actionTypes = useMemo(() => {
    const set = new Set(allLogs.map((l) => l.action).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [allLogs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const userMatch = log.userName?.toLowerCase().includes(q);
        const reqMatch = log.requestId?.toLowerCase().includes(q);
        const commentMatch = log.comment?.toLowerCase().includes(q);
        const actionMatch = log.action?.toLowerCase().includes(q);
        if (!userMatch && !reqMatch && !commentMatch && !actionMatch) {
          return false;
        }
      }

      if (actionFilter !== 'all' && log.action !== actionFilter) {
        return false;
      }

      if (roleFilter !== 'all' && log.userRole !== roleFilter) {
        return false;
      }

      if (departmentFilter !== 'all' && log.department !== departmentFilter) {
        return false;
      }

      return true;
    });
  }, [allLogs, searchQuery, actionFilter, roleFilter, departmentFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handleExportCSV = () => {
    const headers = [
      'Log ID',
      'Timestamp',
      'Actor Name',
      'User Role',
      'Department',
      'Action',
      'Request ID',
      'Previous Status',
      'New Status',
      'Comment / Note',
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestampDisplay || l.timestamp}"`,
      `"${l.userName || ''}"`,
      `"${l.userRole || ''}"`,
      `"${l.department || ''}"`,
      `"${l.action || ''}"`,
      `"${l.requestId || ''}"`,
      `"${l.previousStatus || ''}"`,
      `"${l.newStatus || ''}"`,
      `"${(l.comment || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LeaveTrack_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadgeColor = (action) => {
    if (action.includes('Approved')) return 'bg-[#d8f3e5] text-[#22874e] border-[#22874e]/30';
    if (action.includes('Rejected')) return 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/30';
    if (action.includes('Cancelled')) return 'bg-[#f5f7f8] text-[#687781] border-[#dfe5e8]';
    return 'bg-[#ebf5ff] text-[#00646f] border-[#00646f]/20';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Audit & Compliance Logs"
        subtitle="Immutable trail of all leave approvals, policy adjustments, requests, and system events."
      >
        <Button
          variant="outline"
          icon="download"
          onClick={handleExportCSV}
          disabled={filteredLogs.length === 0}
        >
          Export Audit Trail ({filteredLogs.length})
        </Button>
      </PageHeader>

      {/* Filter Controls */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <label className="text-[10px] font-bold uppercase text-[#687781] block mb-1">
              Search Actor / Request
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#687781] text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search user, ID, note..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              />
            </div>
          </div>

          {/* Action Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase text-[#687781] block mb-1">
              Action Event
            </label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
            >
              {actionTypes.map((a) => (
                <option key={a} value={a}>
                  {a === 'all' ? 'All Event Types' : a}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase text-[#687781] block mb-1">
              Actor Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
            >
              <option value="all">All Roles</option>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="hr">HR Director</option>
              <option value="system">System</option>
            </select>
          </div>

          {/* Department Filter */}
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
                  {d === 'all' ? 'All Departments' : d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="p-0 overflow-hidden">
        {paginatedLogs.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[#687781] text-[40px] block mb-2">
              history_toggle_off
            </span>
            <h3 className="text-sm font-bold text-[#0f1d27]">No audit logs match criteria</h3>
            <p className="text-xs text-[#687781] mt-1">
              Try adjusting your search queries or filter selections.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f7f8]/80 border-b border-[#dfe5e8] text-[11px] font-bold text-[#687781] uppercase tracking-wider">
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Role / Dept</th>
                  <th className="py-3 px-4">Event Action</th>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-5">Notes & Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe5e8]/60 text-xs">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#ebf5ff]/30 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#687781] whitespace-nowrap">
                      {log.timestampDisplay || log.timestamp}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#0f1d27]">
                      {log.userName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold capitalize text-[#3e494a] block">{log.userRole}</span>
                      <span className="text-[10px] text-[#687781]">{log.department}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#00646f]">
                      {log.requestId || '—'}
                    </td>
                    <td className="py-3.5 px-5 text-[#3e494a]">
                      {log.comment ? (
                        <span className="italic">"{log.comment}"</span>
                      ) : (
                        <span className="text-[#687781]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[#dfe5e8] bg-[#f8fbfb] flex items-center justify-between text-xs">
            <span className="text-[#687781]">
              Page <strong className="text-[#0f1d27]">{currentPage}</strong> of{' '}
              <strong className="text-[#0f1d27]">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-[#dfe5e8] bg-white text-[#3e494a] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f5f7f8] cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold cursor-pointer ${
                    currentPage === page
                      ? 'bg-[#00646f] text-white'
                      : 'bg-white border border-[#dfe5e8] text-[#3e494a] hover:bg-[#f5f7f8]'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-[#dfe5e8] bg-white text-[#3e494a] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f5f7f8] cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
