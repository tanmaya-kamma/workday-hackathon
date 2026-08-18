import React, { useState, useMemo } from 'react';
import { useLeave } from '../../context/LeaveContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';

export function ReportsPage() {
  const { getOrganizationStats, getOrganizationRequests } = useLeave();
  const [timeRange, setTimeRange] = useState('YTD');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const stats = getOrganizationStats();
  const allRequests = getOrganizationRequests();

  // Filter requests based on time range
  const filteredRequests = useMemo(() => {
    return allRequests.filter((r) => {
      if (departmentFilter !== 'all' && r.department !== departmentFilter) {
        return false;
      }

      if (timeRange === 'THIS_MONTH') {
        return (
          (r.startDate && r.startDate.startsWith('2026-10')) ||
          (r.submittedAt && r.submittedAt.startsWith('2026-10'))
        );
      }
      if (timeRange === 'LAST_MONTH') {
        return (
          (r.startDate && r.startDate.startsWith('2026-09')) ||
          (r.submittedAt && r.submittedAt.startsWith('2026-09'))
        );
      }
      if (timeRange === 'Q3') {
        return (
          r.startDate &&
          (r.startDate.startsWith('2026-07') ||
            r.startDate.startsWith('2026-08') ||
            r.startDate.startsWith('2026-09'))
        );
      }
      return true;
    });
  }, [allRequests, timeRange, departmentFilter]);

  // Derived metrics
  const totalRequestsCount = filteredRequests.length;
  const approvedRequests = filteredRequests.filter((r) => r.status === 'approved');
  const rejectedRequests = filteredRequests.filter((r) => r.status === 'rejected');
  const totalDaysTaken = approvedRequests.reduce((sum, r) => sum + (r.durationDays || 0), 0);

  const approvalRate = totalRequestsCount > 0
    ? Math.round((approvedRequests.length / totalRequestsCount) * 100)
    : 0;
  const rejectionRate = totalRequestsCount > 0
    ? Math.round((rejectedRequests.length / totalRequestsCount) * 100)
    : 0;
  const avgDuration = approvedRequests.length > 0
    ? (totalDaysTaken / approvedRequests.length).toFixed(1)
    : '0.0';

  const handleExportFullReport = () => {
    const headers = [
      'Department',
      'Total Staff',
      'Approved Days Taken',
      'Annual Leave Days',
      'Sick Days',
      'Casual Days',
      'Pending Requests',
    ];

    const rows = stats.departmentStats.map((d) => [
      `"${d.department}"`,
      d.employeeCount,
      d.totalDays,
      d.annual,
      d.sick,
      d.casual,
      d.pendingCount,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LeaveTrack_Leave_Analytics_Report_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const complianceReports = [
    {
      title: 'Q3 Statutory Leave Utilization Report',
      description: 'Departmental aggregate report on vacation, sick, and personal days taken.',
      date: 'Oct 01, 2026',
      format: 'CSV / PDF',
      badge: 'Statutory',
    },
    {
      title: 'Annual PTO Balance Liability Audit',
      description: 'Accrual rates, rollover days, and year-end liability calculations.',
      date: 'Sep 15, 2026',
      format: 'CSV / XLSX',
      badge: 'Compliance',
    },
    {
      title: 'Absenteeism & Medical Certificate Trend Summary',
      description: 'Monthly sick leave anomalies and medical certificate verification summaries.',
      date: 'Aug 30, 2026',
      format: 'CSV / PDF',
      badge: 'Audit',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Leave Reports & Workforce Analytics"
        subtitle="Generate, download, and review statutory compliance reports and leave utilization."
      >
        <Button
          variant="primary"
          icon="download"
          onClick={handleExportFullReport}
        >
          Export Summary Report (CSV)
        </Button>
      </PageHeader>

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div>
              <label className="text-[10px] font-bold uppercase text-[#687781] block mb-1">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              >
                <option value="THIS_MONTH">This Month (October 2026)</option>
                <option value="LAST_MONTH">Last Month (September 2026)</option>
                <option value="Q3">Q3 2026 (Jul - Sep)</option>
                <option value="YTD">Year-to-Date 2026</option>
                <option value="ALL">All Time</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-[#687781] block mb-1">
                Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-[#dfe5e8] bg-white focus:outline-none focus:border-[#00646f]"
              >
                <option value="all">All Departments</option>
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Product">Product</option>
                <option value="Finance">Finance</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Marketing">Marketing</option>
                <option value="Sales">Sales</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-[#687781] self-end sm:self-center">
            Active Dataset: <strong className="text-[#0f1d27]">{filteredRequests.length}</strong> leave requests
          </div>
        </div>
      </Card>

      {/* Analytics KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase text-[#687781] block mb-1">
            Total Leave Days Taken
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#00646f]">{totalDaysTaken}</span>
            <span className="text-xs text-[#687781]">Days</span>
          </div>
          <p className="text-[11px] text-[#687781] mt-2">Approved absence across scope</p>
        </Card>

        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase text-[#687781] block mb-1">
            Requests Processed
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#0f1d27]">{totalRequestsCount}</span>
            <span className="text-xs text-[#687781]">Applications</span>
          </div>
          <p className="text-[11px] text-[#687781] mt-2">{approvedRequests.length} approved, {rejectedRequests.length} rejected</p>
        </Card>

        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase text-[#687781] block mb-1">
            Approval Rate
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#22874e]">{approvalRate}%</span>
            <span className="text-xs text-[#687781]">compliance</span>
          </div>
          <p className="text-[11px] text-[#687781] mt-2">Rejection rate: {rejectionRate}%</p>
        </Card>

        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase text-[#687781] block mb-1">
            Avg Leave Duration
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#3d6fa8]">{avgDuration}</span>
            <span className="text-xs text-[#687781]">Days/Request</span>
          </div>
          <p className="text-[11px] text-[#687781] mt-2">Standard employee absence cycle</p>
        </Card>
      </div>

      {/* Utilization Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Breakdown */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#0f1d27]">Departmental Utilization</h3>
              <p className="text-xs text-[#687781]">Aggregate PTO consumption by department</p>
            </div>
            <span className="text-xs font-semibold text-[#00646f]">Days Taken</span>
          </div>

          <div className="space-y-4">
            {stats.departmentStats.map((dept) => {
              const max = 50;
              const pct = Math.min(100, Math.round((dept.totalDays / max) * 100));
              return (
                <div key={dept.department} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0f1d27]">{dept.department}</span>
                    <span className="font-bold text-[#00646f]">{dept.totalDays} Days</span>
                  </div>
                  <div className="w-full bg-[#f0f4f7] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#00646f] h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Leave Type Utilization */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#0f1d27]">Leave Type Breakdown</h3>
              <p className="text-xs text-[#687781]">Distribution of days by absence category</p>
            </div>
          </div>

          <div className="space-y-4">
            {stats.leaveTypeStats.map((item) => {
              const totalDaysAll = stats.leaveTypeStats.reduce((s, i) => s + i.days, 0) || 1;
              const pct = Math.round((item.days / totalDaysAll) * 100);
              return (
                <div key={item.key} className="p-3.5 rounded-xl border border-[#dfe5e8] bg-[#f8fbfb]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-bold text-[#0f1d27]">{item.type}</span>
                    </div>
                    <span className="text-xs font-bold text-[#0f1d27]">{item.days} Days ({pct}%)</span>
                  </div>
                  <div className="w-full bg-[#e1e9ec] h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Pre-Generated Compliance Reports List */}
      <div>
        <h3 className="text-base font-bold text-[#0f1d27] mb-3">Statutory & Compliance Downloads</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {complianceReports.map((rep, idx) => (
            <Card key={idx} className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#00646f] text-[22px]">
                      description
                    </span>
                    <span className="text-[11px] font-bold uppercase text-[#687781] tracking-wider">
                      {rep.format}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#ebf5ff] text-[#00646f] text-[10px] font-bold">
                    {rep.badge}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#0f1d27] mb-1">{rep.title}</h4>
                <p className="text-xs text-[#687781] leading-relaxed">{rep.description}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-[#dfe5e8] flex justify-between items-center">
                <span className="text-[11px] text-[#687781]">{rep.date}</span>
                <Button
                  variant="outline"
                  size="sm"
                  icon="download"
                  onClick={handleExportFullReport}
                >
                  Download
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
