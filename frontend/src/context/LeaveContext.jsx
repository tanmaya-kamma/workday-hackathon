import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api.js';
import { useAuth } from './AuthContext.jsx';
import { formatDate } from '../utils/dateUtils.js';

const LeaveContext = createContext(null);

const STORAGE_KEY_REQUESTS = 'leavetrack_requests_v1';

export function LeaveProvider({ children }) {
  const { currentUser } = useAuth();

  const [requests, setRequests] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REQUESTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load saved requests from localStorage', e);
    }
    return [];
  });

  const [dbEmployees, setDbEmployees] = useState([]);

  const mapBackendLeaveToFrontend = (item) => {
    const typeMap = {
      vacation: 'annual',
      annual: 'annual',
      sick: 'sick',
      personal: 'casual',
      casual: 'casual',
      unpaid: 'unpaid',
    };
    const titleMap = {
      annual: 'Annual Leave',
      vacation: 'Annual Leave',
      sick: 'Sick Leave',
      casual: 'Casual Leave',
      personal: 'Casual Leave',
      unpaid: 'Unpaid Leave',
    };
    const typeKey = typeMap[item.leave_type] || 'annual';
    const leaveType = titleMap[item.leave_type] || 'Annual Leave';

    return {
      id: item.id,
      backendId: item.id,
      userId: item.employee_id,
      employeeName: item.employee_name || 'Employee',
      managerId: item.manager_id,
      leaveType,
      typeKey,
      category: item.category || 'planned',
      startDate: item.start_date,
      endDate: item.end_date,
      dateDisplay: `${formatDate(item.start_date)} - ${formatDate(item.end_date)}`,
      durationDays: item.total_days || 1,
      reason: item.reason || '',
      status: item.status || 'pending',
      managerRemarks: item.manager_remarks || '',
      reviewComment: item.manager_remarks || '',
      submittedAt: item.applied_at,
      createdAt: item.applied_at,
      appliedAt: item.applied_at,
      timeline: [
        { step: 'Request Submitted', date: formatDate(item.applied_at), status: 'completed' },
        {
          step: 'Manager Review',
          date: item.reviewed_at ? formatDate(item.reviewed_at) : 'Pending',
          status: item.status === 'pending' ? 'current' : 'completed',
        },
        {
          step: 'Final Decision',
          date: item.reviewed_at ? formatDate(item.reviewed_at) : 'Pending',
          status: item.status === 'approved' ? 'completed' : (item.status === 'rejected' ? 'rejected' : 'pending'),
          note: item.manager_remarks,
        },
      ],
    };
  };

  const fetchRequestsFromDB = async () => {
    if (!currentUser?.id) return;
    try {
      let combined = [];
      if (currentUser.role === 'employee') {
        const res = await api.get('/leaves/my');
        if (res.data?.items) {
          combined = res.data.items.map(mapBackendLeaveToFrontend);
        }
      } else if (currentUser.role === 'manager') {
        const [teamRes, myRes] = await Promise.allSettled([
          api.get('/leaves/team'),
          api.get('/leaves/my'),
        ]);
        const teamItems = teamRes.status === 'fulfilled' && teamRes.value.data?.items ? teamRes.value.data.items.map(mapBackendLeaveToFrontend) : [];
        const myItems = myRes.status === 'fulfilled' && myRes.value.data?.items ? myRes.value.data.items.map(mapBackendLeaveToFrontend) : [];
        const mapById = new Map();
        [...teamItems, ...myItems].forEach(r => mapById.set(r.id, r));
        combined = Array.from(mapById.values());
      } else if (currentUser.role === 'hr' || currentUser.role === 'admin') {
        const [orgRes, myRes] = await Promise.allSettled([
          api.get('/hr/leaves'),
          api.get('/leaves/my'),
        ]);
        const orgItems = orgRes.status === 'fulfilled' && orgRes.value.data?.items ? orgRes.value.data.items.map(mapBackendLeaveToFrontend) : [];
        const myItems = myRes.status === 'fulfilled' && myRes.value.data?.items ? myRes.value.data.items.map(mapBackendLeaveToFrontend) : [];
        const mapById = new Map();
        [...orgItems, ...myItems].forEach(r => mapById.set(r.id, r));
        combined = Array.from(mapById.values());
      }
      setRequests(combined);
    } catch (e) {
      console.warn('Could not fetch requests from MongoDB:', e);
    }
  };

  const fetchEmployeesFromDB = async () => {
    try {
      const res = await api.get('/hr/employees');
      if (res.data && Array.isArray(res.data)) {
        const mapped = res.data.map((u) => ({
          id: u.id,
          _id: u.id,
          employeeId: u.employee_id,
          name: u.full_name,
          email: u.email,
          role: u.role,
          department: u.department,
          managerId: u.manager_id,
          managerName: u.manager_name || (u.manager_id ? 'Manager' : 'N/A'),
          position: u.role === 'manager' ? 'Team Lead / Manager' : (u.role === 'hr' ? 'HR Administrator' : 'Staff Member'),
          status: 'Active',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=0875e1&color=fff`,
          balances: {
            annual: { total: u.leave_balances?.annual ?? 20, used: 0, remaining: u.leave_balances?.annual ?? 20 },
            sick: { total: u.leave_balances?.sick ?? 12, used: 0, remaining: u.leave_balances?.sick ?? 12 },
            casual: { total: u.leave_balances?.casual ?? 6, used: 0, remaining: u.leave_balances?.casual ?? 6 },
            unpaid: { total: 0, used: 0, remaining: 999 },
          },
        }));
        setDbEmployees(mapped);
      }
    } catch (e) {
      console.warn('Could not fetch employees from MongoDB:', e);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchRequestsFromDB();
      if (currentUser.role === 'manager' || currentUser.role === 'hr' || currentUser.role === 'admin') {
        fetchEmployeesFromDB();
      }
    }
  }, [currentUser]);

  // Global Toast State
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
    } catch (e) {
      console.warn('Failed to persist requests', e);
    }
  }, [requests]);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4500);
  };

  const closeToast = () => {
    setToast(null);
  };

  // ==========================================
  // EMPLOYEE OPERATIONS
  // ==========================================

  const getMyRequests = (employeeId) => {
    const targetId = employeeId || currentUser?.id;
    if (!targetId) return [];
    return requests.filter((req) => req.userId === targetId);
  };

  const getLeaveRequest = (id) => {
    return requests.find((req) => req.id === id) || null;
  };

  const saveDraft = (data, existingId = null) => {
    const today = new Date().toISOString().split('T')[0];
    const todayDisplay = formatDate(new Date());

    if (existingId) {
      let updatedReq = null;
      setRequests((prev) =>
        prev.map((req) => {
          if (req.id === existingId) {
            updatedReq = {
              ...req,
              leaveType: data.leaveTypeName || req.leaveType,
              typeKey: data.leaveType || req.typeKey,
              startDate: data.startDate,
              endDate: data.endDate,
              dateDisplay: `${formatDate(data.startDate)} - ${formatDate(data.endDate)}`,
              durationDays: Number(data.duration) || 1,
              reason: data.reason || '',
              status: 'draft',
              lastUpdated: today,
              timeline: [
                { step: 'Draft Updated', date: todayDisplay, status: 'completed' },
                { step: 'Submission Pending', date: 'Pending', status: 'pending' },
                { step: 'Manager Review', date: 'Pending', status: 'pending' },
                { step: 'Final Decision', date: 'Pending', status: 'pending' },
              ],
            };
            return updatedReq;
          }
          return req;
        })
      );
      showToast('Leave request draft saved successfully.', 'info');
      return updatedReq;
    }

    const newDraft = {
      id: `req_draft_${Date.now()}`,
      userId: currentUser?.id || 'usr_emp_01',
      managerId: currentUser?.managerId || 'usr_mgr_01',
      managerName: currentUser?.managerName || 'Alex Rivera',
      organizationId: currentUser?.organizationId || 'org_proton_01',
      employeeName: currentUser?.name || 'Rahul Sharma',
      department: currentUser?.department || 'Engineering',
      position: currentUser?.position || 'Senior Software Engineer',
      avatar: currentUser?.avatar || null,
      initials: currentUser?.initial || 'R',
      leaveType: data.leaveTypeName || 'Annual Leave',
      typeKey: data.leaveType || 'annual',
      startDate: data.startDate,
      endDate: data.endDate,
      dateDisplay: `${formatDate(data.startDate)} - ${formatDate(data.endDate)}`,
      durationDays: Number(data.duration) || 1,
      reason: data.reason || '',
      status: 'draft',
      submittedAt: null,
      submittedDisplay: 'Not Submitted',
      lastUpdated: today,
      timeline: [
        { step: 'Created as Draft', date: todayDisplay, status: 'completed' },
        { step: 'Submission Pending', date: 'Pending', status: 'pending' },
        { step: 'Manager Review', date: 'Pending', status: 'pending' },
        { step: 'Final Decision', date: 'Pending', status: 'pending' },
      ],
    };

    setRequests((prev) => [newDraft, ...prev]);
    showToast('Leave request draft saved successfully.', 'info');
    return newDraft;
  };

  const submitLeaveRequest = async (data, existingId = null) => {
    try {
      const typeKey = data.leaveType || 'annual';
      const payload = {
        leave_type: typeKey,
        start_date: data.startDate,
        end_date: data.endDate,
        reason: data.reason || 'Leave requested via LeaveTrack portal',
      };

      const res = await api.post('/leaves/', payload);
      const newLeave = res.data;

      await fetchRequestsFromDB();
      if (currentUser?.role === 'manager' || currentUser?.role === 'hr') {
        await fetchEmployeesFromDB();
      }

      showToast('Leave request submitted successfully.', 'success');
      return mapBackendLeaveToFrontend(newLeave);
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to submit leave request.';
      showToast(errMsg, 'danger');
      return null;
    }
  };

  const cancelLeaveRequest = async (id, reason = 'Cancelled by employee') => {
    try {
      const targetReq = requests.find((r) => r.id === id);
      const backendId = targetReq?.backendId || id;

      await api.delete(`/leaves/${backendId}`);
      await fetchRequestsFromDB();

      showToast('Leave request cancelled.', 'info');
      return true;
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to cancel leave request.';
      showToast(errMsg, 'danger');
      return false;
    }
  };

  const deleteDraft = (id) => {
    setRequests((prev) => prev.filter((req) => req.id !== id));
    showToast('Draft deleted successfully.', 'neutral');
  };

  // ==========================================
  // MANAGER OPERATIONS
  // ==========================================

  const getTeamRequests = (managerId) => {
    const targetMgrId = managerId || currentUser?.id;
    if (!targetMgrId) return [];
    return requests.filter(
      (req) => req.managerId === targetMgrId && req.userId !== targetMgrId && req.status !== 'draft'
    );
  };

  const getPendingApprovals = (managerId) => {
    const targetMgrId = managerId || currentUser?.id;
    if (!targetMgrId) return [];
    return requests.filter(
      (req) => req.managerId === targetMgrId && req.userId !== targetMgrId && req.status === 'pending'
    );
  };

  const getTeamMembers = (managerId) => {
    const targetMgrId = managerId || currentUser?.id;
    if (!targetMgrId) return [];
    return dbEmployees.filter((member) => member.managerId === targetMgrId);
  };

  const approveLeaveRequest = async (requestId, comment = '') => {
    try {
      const targetReq = requests.find((r) => r.id === requestId);
      const backendId = targetReq?.backendId || requestId;

      await api.patch(`/leaves/${backendId}/approve`, {
        remarks: comment || null,
      });

      await fetchRequestsFromDB();
      if (currentUser?.role === 'manager' || currentUser?.role === 'hr') {
        await fetchEmployeesFromDB();
      }

      showToast(`Approved leave request for ${targetReq?.employeeName || 'employee'}.`, 'success');
      return true;
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to approve leave request.';
      showToast(errMsg, 'danger');
      return false;
    }
  };

  const rejectLeaveRequest = async (requestId, comment) => {
    if (!comment || !comment.trim()) {
      showToast('A rejection reason is required.', 'danger');
      return false;
    }

    try {
      const targetReq = requests.find((r) => r.id === requestId);
      const backendId = targetReq?.backendId || requestId;

      await api.patch(`/leaves/${backendId}/reject`, {
        remarks: comment.trim(),
      });

      await fetchRequestsFromDB();
      if (currentUser?.role === 'manager' || currentUser?.role === 'hr') {
        await fetchEmployeesFromDB();
      }

      showToast(`Leave request for ${targetReq?.employeeName || 'employee'} was rejected.`, 'warning');
      return true;
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to reject leave request.';
      showToast(errMsg, 'danger');
      return false;
    }
  };

  // ==========================================
  // HR OPERATIONS
  // ==========================================

  const getOrganizationRequests = () => {
    return requests;
  };

  const getOrganizationEmployees = () => {
    return dbEmployees;
  };

  const addEmployee = async (employeeData) => {
    try {
      const res = await api.post('/hr/employees', {
        employee_id: employeeData.employeeId || employeeData.employee_id || undefined,
        email: employeeData.email,
        full_name: employeeData.fullName || employeeData.full_name || employeeData.name,
        password: employeeData.password || 'password123',
        role: employeeData.role || 'employee',
        department: employeeData.department || 'Engineering',
        region: employeeData.region || 'IN',
        manager_id: employeeData.managerId || employeeData.manager_id || undefined,
        annual_leave: Number(employeeData.annualLeave ?? 20),
        sick_leave: Number(employeeData.sickLeave ?? 12),
        casual_leave: Number(employeeData.casualLeave ?? 6),
      });

      const u = res.data;
      const newEmp = {
        id: u.id,
        _id: u.id,
        employeeId: u.employee_id,
        name: u.full_name,
        email: u.email,
        role: u.role,
        department: u.department,
        managerId: u.manager_id,
        managerName: employeeData.managerName || (u.manager_id ? 'Manager' : 'N/A'),
        position: u.role === 'manager' ? 'Team Lead / Manager' : (u.role === 'hr' ? 'HR Administrator' : 'Staff Member'),
        status: 'Active',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=00646f&color=fff`,
        balances: {
          annual: { total: u.leave_balances?.annual ?? 20, used: 0, remaining: u.leave_balances?.annual ?? 20 },
          sick: { total: u.leave_balances?.sick ?? 12, used: 0, remaining: u.leave_balances?.sick ?? 12 },
          casual: { total: u.leave_balances?.casual ?? 6, used: 0, remaining: u.leave_balances?.casual ?? 6 },
          unpaid: { total: 0, used: 0, remaining: 999 },
        },
      };

      setDbEmployees((prev) => [newEmp, ...prev]);
      showToast(`Employee ${u.full_name} (${u.employee_id}) added!`, 'success');
      return { success: true, employee: newEmp };
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to add employee.';
      showToast(msg, 'danger');
      return { success: false, error: msg };
    }
  };

  const getOrganizationStats = () => {
    const orgRequests = getOrganizationRequests();
    const employees = getOrganizationEmployees();

    const today = new Date();
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const currentMonth = todayDate.substring(0, 7);

    const totalEmployees = employees.length;

    const onLeaveTodayRequests = orgRequests.filter(
      (r) => r.status === 'approved' && r.startDate <= todayDate && r.endDate >= todayDate
    );
    const onLeaveTodayCount = onLeaveTodayRequests.length;
    const onLeavePercentage = totalEmployees > 0 ? ((onLeaveTodayCount / totalEmployees) * 100).toFixed(1) : 0;

    const pendingRequests = orgRequests.filter((r) => r.status === 'pending');
    const pendingCount = pendingRequests.length;

    const approvedThisMonthReqs = orgRequests.filter(
      (r) =>
        r.status === 'approved' &&
        ((r.startDate && r.startDate.startsWith(currentMonth)) || (r.lastUpdated && r.lastUpdated.startsWith(currentMonth)))
    );
    const approvedThisMonthCount = approvedThisMonthReqs.length;
    const approvedThisMonthDays = approvedThisMonthReqs.reduce((sum, r) => sum + (r.durationDays || 0), 0);

    const rejectedThisMonthCount = orgRequests.filter(
      (r) =>
        r.status === 'rejected' &&
        ((r.lastUpdated && r.lastUpdated.startsWith(currentMonth)) || (r.submittedAt && r.submittedAt.startsWith(currentMonth)))
    ).length;

    const upcomingLeaves = orgRequests.filter(
      (r) => r.status === 'approved' && r.startDate > todayDate
    );
    const upcomingLeaveCount = upcomingLeaves.length;

    const departments = [
      'Engineering', 'Design', 'Product', 'Finance',
      'Human Resources', 'Marketing', 'Sales', 'Operations',
    ];

    const departmentStats = departments.map((dept) => {
      const deptReqs = orgRequests.filter((r) => r.department === dept && r.status === 'approved');
      const annualDays = deptReqs.filter((r) => r.typeKey === 'annual').reduce((s, r) => s + (r.durationDays || 0), 0);
      const sickDays = deptReqs.filter((r) => r.typeKey === 'sick').reduce((s, r) => s + (r.durationDays || 0), 0);
      const casualDays = deptReqs.filter((r) => r.typeKey === 'casual').reduce((s, r) => s + (r.durationDays || 0), 0);
      const unpaidDays = deptReqs.filter((r) => r.typeKey === 'unpaid').reduce((s, r) => s + (r.durationDays || 0), 0);
      const totalDays = annualDays + sickDays + casualDays + unpaidDays;
      const deptEmployees = employees.filter((e) => e.department === dept).length;

      return {
        department: dept,
        label: dept,
        employeeCount: deptEmployees,
        annual: annualDays,
        sick: sickDays,
        casual: casualDays,
        unpaid: unpaidDays,
        totalDays,
        pendingCount: orgRequests.filter((r) => r.department === dept && r.status === 'pending').length,
      };
    });

    const leaveTypeStats = [
      {
        type: 'Annual Leave', key: 'annual',
        count: orgRequests.filter((r) => r.typeKey === 'annual').length,
        days: orgRequests.filter((r) => r.typeKey === 'annual' && r.status === 'approved').reduce((s, r) => s + (r.durationDays || 0), 0),
        color: '#00646f',
      },
      {
        type: 'Sick Leave', key: 'sick',
        count: orgRequests.filter((r) => r.typeKey === 'sick').length,
        days: orgRequests.filter((r) => r.typeKey === 'sick' && r.status === 'approved').reduce((s, r) => s + (r.durationDays || 0), 0),
        color: '#b7791f',
      },
      {
        type: 'Casual Leave', key: 'casual',
        count: orgRequests.filter((r) => r.typeKey === 'casual').length,
        days: orgRequests.filter((r) => r.typeKey === 'casual' && r.status === 'approved').reduce((s, r) => s + (r.durationDays || 0), 0),
        color: '#3d6fa8',
      },
      {
        type: 'Unpaid Leave', key: 'unpaid',
        count: orgRequests.filter((r) => r.typeKey === 'unpaid').length,
        days: orgRequests.filter((r) => r.typeKey === 'unpaid' && r.status === 'approved').reduce((s, r) => s + (r.durationDays || 0), 0),
        color: '#687781',
      },
    ];

    const statusStats = {
      draft: orgRequests.filter((r) => r.status === 'draft').length,
      pending: orgRequests.filter((r) => r.status === 'pending').length,
      approved: orgRequests.filter((r) => r.status === 'approved').length,
      rejected: orgRequests.filter((r) => r.status === 'rejected').length,
      cancelled: orgRequests.filter((r) => r.status === 'cancelled').length,
    };

    return {
      totalEmployees,
      onLeaveToday: onLeaveTodayCount,
      onLeavePercentage,
      pendingApprovals: pendingCount,
      approvedThisMonth: approvedThisMonthCount,
      approvedThisMonthDays,
      rejectedThisMonth: rejectedThisMonthCount,
      upcomingLeave: upcomingLeaveCount,
      departmentStats,
      leaveTypeStats,
      statusStats,
    };
  };

  const getAuditLogs = () => {
    return [];
  };

  const hrApproveLeaveRequest = async (requestId, comment = '') => {
    return await approveLeaveRequest(requestId, comment);
  };

  const hrRejectLeaveRequest = async (requestId, comment = '') => {
    return await rejectLeaveRequest(requestId, comment);
  };

  const getUserBalances = (userId) => {
    const targetId = userId || currentUser?.id;
    const userReqs = requests.filter(
      (r) => r.userId === targetId && r.status === 'approved'
    );

    const member = dbEmployees.find((m) => m.id === targetId || m._id === targetId || m.employeeId === targetId);
    let rawBalances = currentUser?.id === targetId ? (currentUser?.balances || currentUser?.leave_balances) : (member?.balances || member?.leave_balances);

    const annTotal = rawBalances?.annual?.total ?? (typeof rawBalances?.annual === 'number' ? rawBalances.annual : 20);
    const annRem = rawBalances?.annual?.remaining ?? (typeof rawBalances?.annual === 'number' ? rawBalances.annual : 20);

    const sickTotal = rawBalances?.sick?.total ?? (typeof rawBalances?.sick === 'number' ? rawBalances.sick : 12);
    const sickRem = rawBalances?.sick?.remaining ?? (typeof rawBalances?.sick === 'number' ? rawBalances.sick : 12);

    const casTotal = rawBalances?.casual?.total ?? (typeof rawBalances?.casual === 'number' ? rawBalances.casual : 6);
    const casRem = rawBalances?.casual?.remaining ?? (typeof rawBalances?.casual === 'number' ? rawBalances.casual : 6);

    return {
      annual: { total: annTotal, used: Math.max(0, annTotal - annRem), remaining: annRem },
      sick: { total: sickTotal, used: Math.max(0, sickTotal - sickRem), remaining: sickRem },
      casual: { total: casTotal, used: Math.max(0, casTotal - casRem), remaining: casRem },
      unpaid: {
        total: 0,
        used: userReqs.filter((r) => r.typeKey === 'unpaid').reduce((s, r) => s + (r.durationDays || 0), 0),
        remaining: 999,
      },
    };
  };

  const value = {
    requests,
    toast,
    showToast,
    closeToast,
    getMyRequests,
    getLeaveRequest,
    submitLeaveRequest,
    saveDraft,
    cancelLeaveRequest,
    deleteDraft,
    approveLeaveRequest,
    rejectLeaveRequest,
    getTeamRequests,
    getPendingApprovals,
    getTeamMembers,
    getOrganizationRequests,
    getOrganizationEmployees,
    getOrganizationStats,
    addEmployee,
    getAuditLogs,
    hrApproveLeaveRequest,
    hrRejectLeaveRequest,
    getUserBalances,
  };

  return <LeaveContext.Provider value={value}>{children}</LeaveContext.Provider>;
}

export function useLeave() {
  const context = useContext(LeaveContext);
  if (!context) {
    throw new Error('useLeave must be used within a LeaveProvider');
  }
  return context;
}
