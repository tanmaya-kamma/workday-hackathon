import React, { useState, useMemo } from 'react';
import { useLeave } from '../../context/LeaveContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { EmployeeDetailModal } from '../../components/common/EmployeeDetailModal.jsx';
import { HrReviewModal } from '../../components/common/HrReviewModal.jsx';
import { AddEmployeeModal } from '../../components/common/AddEmployeeModal.jsx';

export function DirectoryPage() {
  const { getOrganizationEmployees, getUserBalances, addEmployee } = useLeave();
  const employees = getOrganizationEmployees();

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modal State
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [reviewRequest, setReviewRequest] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const departments = useMemo(() => {
    const set = new Set(employees.map((e) => e.department).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = emp.name.toLowerCase().includes(q);
        const matchEmail = emp.email.toLowerCase().includes(q);
        const matchDept = emp.department.toLowerCase().includes(q);
        const matchPos = (emp.position || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchDept && !matchPos) {
          return false;
        }
      }

      if (departmentFilter !== 'all' && emp.department !== departmentFilter) {
        return false;
      }

      if (roleFilter !== 'all' && emp.role !== roleFilter) {
        return false;
      }

      return true;
    });
  }, [employees, searchQuery, departmentFilter, roleFilter]);

  const handleExportRoster = () => {
    const headers = ['Employee ID', 'Name', 'Email', 'Department', 'Position', 'Role', 'Manager', 'Status'];
    const rows = filteredEmployees.map((e) => [
      `"${e.id}"`,
      `"${e.name}"`,
      `"${e.email}"`,
      `"${e.department}"`,
      `"${e.position || ''}"`,
      `"${e.role}"`,
      `"${e.managerName || ''}"`,
      `"${e.status || 'Active'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LeaveTrack_Employee_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Employee Directory"
        subtitle="Manage organization roster, employee profiles, department assignments, and leave balances."
      >
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            icon="download"
            onClick={handleExportRoster}
            disabled={filteredEmployees.length === 0}
          >
            Export Roster ({filteredEmployees.length})
          </Button>
          <Button
            variant="primary"
            icon="person_add"
            onClick={() => setIsAddModalOpen(true)}
          >
            Add New Employee
          </Button>
        </div>
      </PageHeader>

      {/* Filter Controls */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto flex-1">
            {/* Search */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#687781] text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search by name, email, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              />
            </div>

            {/* Department */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === 'all' ? 'All Departments' : d}
                </option>
              ))}
            </select>

            {/* Role */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
            >
              <option value="all">All Roles</option>
              <option value="employee">Staff / ICs</option>
              <option value="manager">Managers</option>
              <option value="hr">HR Executives</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 border border-[#dfe5e8] p-1 rounded-xl bg-[#f8fbfb]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white shadow-2xs text-[#00646f]' : 'text-[#687781] hover:text-[#0f1d27]'
              }`}
              title="Grid View"
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white shadow-2xs text-[#00646f]' : 'text-[#687781] hover:text-[#0f1d27]'
              }`}
              title="Table View"
            >
              <span className="material-symbols-outlined text-[18px]">view_list</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Employees Output */}
      {filteredEmployees.length === 0 ? (
        <Card className="p-12 text-center">
          <span className="material-symbols-outlined text-[#687781] text-[40px] block mb-2">
            person_off
          </span>
          <h3 className="text-sm font-bold text-[#0f1d27]">No employees found</h3>
          <p className="text-xs text-[#687781] mt-1">
            Try adjusting your search criteria or department filter.
          </p>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const balances = getUserBalances(emp.id);
            return (
              <Card
                key={emp.id}
                className="p-5 flex flex-col justify-between hover:border-[#00646f]/50 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedEmployee(emp)}
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {emp.avatar ? (
                        <img
                          src={emp.avatar}
                          alt={emp.name}
                          className="w-11 h-11 rounded-full object-cover border border-[#dfe5e8]"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-sm">
                          {emp.initials || emp.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-[#0f1d27]">{emp.name}</h4>
                        <p className="text-xs text-[#687781]">{emp.position || 'Team Member'}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.status === 'On Leave'
                          ? 'bg-[#fff4e5] text-[#b7791f]'
                          : 'bg-[#d8f3e5] text-[#22874e]'
                      }`}
                    >
                      {emp.status || 'Active'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#3e494a] mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[#687781]">Department:</span>
                      <span className="font-semibold text-[#0f1d27]">{emp.department}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#687781]">Manager:</span>
                      <span className="text-[#00646f] font-medium">{emp.managerName || 'Sarah Mitchell'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#687781]">Email:</span>
                      <span className="font-mono text-[11px] text-[#687781]">{emp.email}</span>
                    </div>
                  </div>
                </div>

                {/* Balances Footer Pill */}
                <div className="pt-3 border-t border-[#dfe5e8]/80 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[11px]">
                    <div>
                      <span className="text-[#687781] block text-[10px]">Annual</span>
                      <span className="font-bold text-[#00646f]">{balances.annual.remaining}d left</span>
                    </div>
                    <div>
                      <span className="text-[#687781] block text-[10px]">Sick</span>
                      <span className="font-bold text-[#0f1d27]">{balances.sick.remaining}d</span>
                    </div>
                    <div>
                      <span className="text-[#687781] block text-[10px]">Casual</span>
                      <span className="font-bold text-[#3d6fa8]">{balances.casual.remaining}d</span>
                    </div>
                  </div>

                  <span className="material-symbols-outlined text-[#687781] text-[18px]">
                    chevron_right
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f7f8]/80 border-b border-[#dfe5e8] text-[11px] font-bold text-[#687781] uppercase tracking-wider">
                  <th className="py-3 px-5">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Position</th>
                  <th className="py-3 px-4">Reporting Manager</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Annual Quota</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe5e8]/60 text-xs">
                {filteredEmployees.map((emp) => {
                  const balances = getUserBalances(emp.id);
                  return (
                    <tr key={emp.id} className="hover:bg-[#ebf5ff]/30 transition-colors">
                      <td className="py-3 px-5 font-semibold text-[#0f1d27]">
                        <div className="flex items-center gap-2.5">
                          {emp.avatar ? (
                            <img
                              src={emp.avatar}
                              alt={emp.name}
                              className="w-7 h-7 rounded-full object-cover border border-[#dfe5e8]"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-[10px]">
                              {emp.initials || emp.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="block font-bold">{emp.name}</span>
                            <span className="text-[10px] text-[#687781]">{emp.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#3e494a]">{emp.department}</td>
                      <td className="py-3 px-4 text-[#687781]">{emp.position || 'Team Member'}</td>
                      <td className="py-3 px-4 text-[#00646f]">{emp.managerName || 'Sarah Mitchell'}</td>
                      <td className="py-3 px-4 capitalize text-[#687781]">{emp.role}</td>
                      <td className="py-3 px-4 font-bold text-[#00646f]">
                        {balances.annual.remaining} / {balances.annual.total}d
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            emp.status === 'On Leave'
                              ? 'bg-[#fff4e5] text-[#b7791f]'
                              : 'bg-[#d8f3e5] text-[#22874e]'
                          }`}
                        >
                          {emp.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployee(emp)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#00646f] hover:bg-[#ebf5ff] transition-colors cursor-pointer"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Employee Details Modal */}
      {selectedEmployee && (
        <EmployeeDetailModal
          isOpen={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          employee={selectedEmployee}
          onSelectRequest={(req) => {
            setSelectedEmployee(null);
            setReviewRequest(req);
          }}
        />
      )}

      {/* HR Review Modal triggered from Employee Detail */}
      {reviewRequest && (
        <HrReviewModal
          isOpen={!!reviewRequest}
          onClose={() => setReviewRequest(null)}
          request={reviewRequest}
          initialMode="review"
        />
      )}

      {/* Add Employee Modal */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onEmployeeAdded={addEmployee}
      />
    </div>
  );
}
