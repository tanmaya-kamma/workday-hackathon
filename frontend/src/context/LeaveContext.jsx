import React, { createContext, useContext, useState, useEffect, useRef } from "react";

import api from "../api.js";
import { useAuth } from "./AuthContext.jsx";
import { formatDate } from "../utils/dateUtils.js";

const LeaveContext = createContext(null);

const STORAGE_KEY_REQUESTS = "leavetrack_requests_v1";

export function LeaveProvider({ children }) {
  const { currentUser } = useAuth();

  const [requests, setRequests] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REQUESTS);

      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to load saved requests from localStorage", e);
    }

    return [];
  });

  const [dbEmployees, setDbEmployees] = useState([]);

  // ============================================================
  // BACKEND USER / BALANCE STATE
  // ============================================================

  const [backendUser, setBackendUser] = useState(null);

  // ============================================================
  // MAP BACKEND LEAVE → FRONTEND LEAVE
  // ============================================================

  const mapBackendLeaveToFrontend = (item) => {
    const typeMap = {
      vacation: "annual",
      annual: "annual",
      sick: "sick",
      personal: "casual",
      casual: "casual",
      unpaid: "unpaid",
    };

    const titleMap = {
      annual: "Annual Leave",
      vacation: "Annual Leave",
      sick: "Sick Leave",
      casual: "Casual Leave",
      personal: "Casual Leave",
      unpaid: "Unpaid Leave",
    };

    const typeKey = typeMap[item.leave_type] || "annual";

    const leaveType = titleMap[item.leave_type] || "Annual Leave";

    return {
      id: item.id,
      backendId: item.id,

      userId: item.employee_id,
      employeeName: item.employee_name || "Employee",

      managerId: item.manager_id,

      approvalStage: item.approval_stage || null,

      leaveType,
      typeKey,

      category: item.category || "planned",

      startDate: item.start_date,
      endDate: item.end_date,

      dateDisplay: `${formatDate(
        item.start_date,
      )} - ${formatDate(item.end_date)}`,

      durationDays: item.total_days || 1,

      paidDays: item.paid_days ?? null,
      unpaidDays: item.unpaid_days || 0,

      reason: item.reason || "",

      status: item.status || "pending",

      managerRemarks: item.manager_remarks || "",

      reviewComment: item.manager_remarks || "",

      submittedAt: item.applied_at,

      createdAt: item.applied_at,

      appliedAt: item.applied_at,

      timeline: [
        {
          step: "Request Submitted",
          date: formatDate(item.applied_at),
          status: "completed",
        },

        {
          step: "Manager Review",

          date: item.reviewed_at ? formatDate(item.reviewed_at) : "Pending",

          status: item.status === "pending" ? "current" : "completed",
        },

        {
          step: "Final Decision",

          date: item.reviewed_at ? formatDate(item.reviewed_at) : "Pending",

          status:
            item.status === "approved"
              ? "completed"
              : item.status === "rejected"
                ? "rejected"
                : "pending",

          note: item.manager_remarks,
        },
      ],
    };
  };

  // ============================================================
  // BALANCE NORMALIZATION
  // ============================================================

  /*
   * Backend / MongoDB uses:
   *
   * vacation
   * sick
   * personal
   *
   * Frontend uses:
   *
   * annual
   * sick
   * casual
   *
   * This helper keeps the frontend compatible with
   * the dynamic accrual engine.
   */

  const normalizeBalances = (sourceBalances = {}) => {
    // Balances arrive in two shapes:
    //   - rich objects from the accrual engine: { total|annual_entitlement, used, remaining, ... }
    //   - flat remaining-day numbers from /auth/me: { annual: 6, sick: 10, ... }
    const coerce = (value, defaultTotal) => {
      if (typeof value === 'number') {
        return {
          total: defaultTotal,
          used: Math.max(0, defaultTotal - value),
          remaining: value,
        };
      }
      const data = value || {};
      if (data.total === undefined && data.annual_entitlement !== undefined) {
        return { ...data, total: data.annual_entitlement };
      }
      return data;
    };

    const vacation = coerce(sourceBalances.vacation ?? sourceBalances.annual, 20);

    const sick = coerce(sourceBalances.sick, 12);

    const personal = coerce(sourceBalances.personal ?? sourceBalances.casual, 6);

    const getNumber = (value, fallback = 0) => {
      const number = Number(value);

      return Number.isFinite(number) ? number : fallback;
    };

    const buildBalance = (data, defaultTotal = 0) => {
      const total = getNumber(data.total, defaultTotal);

      const accrued = getNumber(data.accrued, total);

      const carryForward = getNumber(data.carry_forward, 0);

      const used = getNumber(data.used, 0);

      const pending = getNumber(data.pending, 0);

      const adjustments = getNumber(data.adjustments, 0);

      const expired = getNumber(data.expired, 0);

      const remaining =
        data.remaining !== undefined
          ? getNumber(data.remaining, 0)
          : Math.max(
              0,
              accrued + carryForward + adjustments - used - pending - expired,
            );

      const usable =
        data.usable !== undefined
          ? getNumber(data.usable, remaining)
          : remaining;

      return {
        total,
        accrued,
        carryForward,
        used,
        pending,
        adjustments,
        expired,
        remaining,
        usable,
      };
    };

    return {
      annual: buildBalance(vacation, 0),

      sick: buildBalance(sick, 0),

      casual: buildBalance(personal, 0),

      unpaid: {
        total: 0,
        accrued: 0,
        carryForward: 0,
        used: 0,
        pending: 0,
        adjustments: 0,
        expired: 0,
        remaining: 999,
        usable: 999,
      },
    };
  };

  // ============================================================
  // FETCH CURRENT USER + REAL BALANCES FROM BACKEND
  // ============================================================

  const fetchCurrentUserFromDB = async () => {
    try {
      const res = await api.get("/auth/me");

      if (res.data) {
        // /auth/me only exposes flat remaining-day counts; prefer the
        // accrual engine's rich balances (total/used/remaining) when
        // available. The accrual router is mounted at /api, not /api/v1.
        let balances = res.data.leave_balances || {};

        try {
          const acc = await api.get(`/accrual/${res.data.employee_id}`, {
            baseURL: "http://127.0.0.1:8000/api",
          });

          if (acc.data?.success && acc.data.data?.balances) {
            balances = acc.data.data.balances;
          }
        } catch {
          // Keep the flat /auth/me balances as a fallback.
        }

        const user = {
          ...res.data,

          leave_balances: normalizeBalances(balances),
        };

        setBackendUser(user);
      }
    } catch (e) {
      console.warn("Could not fetch current user from MongoDB:", e);
    }
  };

  // ============================================================
  // FETCH LEAVE REQUESTS
  // ============================================================

  const fetchRequestsFromDB = async () => {
    if (!currentUser?.id) {
      return;
    }

    try {
      let combined = [];

      // ------------------------------------------------------
      // EMPLOYEE
      // ------------------------------------------------------

      if (currentUser.role === "employee") {
        const res = await api.get("/leaves/my");

        if (res.data?.items) {
          combined = res.data.items.map(mapBackendLeaveToFrontend);
        }
      }

      // ------------------------------------------------------
      // MANAGER
      // ------------------------------------------------------
      else if (currentUser.role === "manager") {
        const [teamRes, myRes] = await Promise.allSettled([
          api.get("/leaves/team"),
          api.get("/leaves/my"),
        ]);

        const teamItems =
          teamRes.status === "fulfilled" && teamRes.value.data?.items
            ? teamRes.value.data.items.map(mapBackendLeaveToFrontend)
            : [];

        const myItems =
          myRes.status === "fulfilled" && myRes.value.data?.items
            ? myRes.value.data.items.map(mapBackendLeaveToFrontend)
            : [];

        const mapById = new Map();

        [...teamItems, ...myItems].forEach((r) => {
          mapById.set(r.id, r);
        });

        combined = Array.from(mapById.values());
      }

      // ------------------------------------------------------
      // HR / ADMIN
      // ------------------------------------------------------
      else if (currentUser.role === "hr" || currentUser.role === "admin") {
        const [orgRes, myRes] = await Promise.allSettled([
          api.get("/hr/leaves"),
          api.get("/leaves/my"),
        ]);

        const orgItems =
          orgRes.status === "fulfilled" && orgRes.value.data?.items
            ? orgRes.value.data.items.map(mapBackendLeaveToFrontend)
            : [];

        const myItems =
          myRes.status === "fulfilled" && myRes.value.data?.items
            ? myRes.value.data.items.map(mapBackendLeaveToFrontend)
            : [];

        const mapById = new Map();

        [...orgItems, ...myItems].forEach((r) => {
          mapById.set(r.id, r);
        });

        combined = Array.from(mapById.values());
      }

      setRequests(combined);
    } catch (e) {
      console.warn("Could not fetch requests from MongoDB:", e);
    }
  };

  // ============================================================
  // FETCH EMPLOYEES
  // ============================================================

  const fetchEmployeesFromDB = async () => {
    try {
      const res = await api.get("/hr/employees");

      if (res.data && Array.isArray(res.data)) {
        const mapped = res.data.map((u) => {
          const balances = normalizeBalances(u.leave_balances || {});

          return {
            id: u.id,
            _id: u.id,

            employeeId: u.employee_id,

            name: u.full_name,

            email: u.email,

            role: u.role,

            department: u.department,

            managerId: u.manager_id,

            managerName: u.manager_name || (u.manager_id ? "Manager" : "N/A"),

            position:
              u.role === "manager"
                ? "Team Lead / Manager"
                : u.role === "hr"
                  ? "HR Administrator"
                  : "Staff Member",

            status: u.is_active === false ? "Inactive" : "Active",

            dateOfJoining: u.date_of_joining || null,

            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
              u.full_name || "Employee",
            )}&background=0875e1&color=fff`,

            balances,
          };
        });

        setDbEmployees(mapped);
      }
    } catch (e) {
      console.warn("Could not fetch employees from MongoDB:", e);
    }
  };

  // ============================================================
  // INITIAL BACKEND SYNC
  // ============================================================

  useEffect(() => {
    if (!currentUser?.id) {
      setBackendUser(null);
      return;
    }

    fetchCurrentUserFromDB();

    fetchRequestsFromDB();

    if (
      currentUser.role === "manager" ||
      currentUser.role === "hr" ||
      currentUser.role === "admin"
    ) {
      fetchEmployeesFromDB();
    }
  }, [currentUser]);

  // ============================================================
  // RESYNC ON WINDOW FOCUS
  // ============================================================
  //
  // Leave data can change from another session (e.g. an employee
  // accepts a reschedule while the manager's window is open).
  // Refetch when this window regains focus, throttled to 10s.

  const lastFocusSyncRef = useRef(0);

  useEffect(() => {
    if (!currentUser?.id) return;

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusSyncRef.current < 10000) return;
      lastFocusSyncRef.current = now;
      fetchRequestsFromDB();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [currentUser?.id]);

  // ============================================================
  // GLOBAL TOAST
  // ============================================================

  const [toast, setToast] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
    } catch (e) {
      console.warn("Failed to persist requests", e);
    }
  }, [requests]);

  const showToast = (message, type = "success") => {
    const id = Date.now();

    setToast({
      id,
      message,
      type,
    });

    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4500);
  };

  const closeToast = () => {
    setToast(null);
  };

  // ============================================================
  // EMPLOYEE OPERATIONS
  // ============================================================

  const getMyRequests = (employeeId) => {
    const targetId = employeeId || currentUser?.id;

    if (!targetId) {
      return [];
    }

    return requests.filter((req) => String(req.userId) === String(targetId));
  };

  const getLeaveRequest = (id) => {
    return requests.find((req) => String(req.id) === String(id)) || null;
  };

  // ============================================================
  // SAVE DRAFT
  // ============================================================

  const saveDraft = (data, existingId = null) => {
    const today = new Date().toISOString().split("T")[0];

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

              dateDisplay: `${formatDate(data.startDate)} - ${formatDate(
                data.endDate,
              )}`,

              durationDays: Number(data.duration) || 1,

              reason: data.reason || "",

              status: "draft",

              lastUpdated: today,

              timeline: [
                {
                  step: "Draft Updated",
                  date: todayDisplay,
                  status: "completed",
                },

                {
                  step: "Submission Pending",
                  date: "Pending",
                  status: "pending",
                },

                {
                  step: "Manager Review",
                  date: "Pending",
                  status: "pending",
                },

                {
                  step: "Final Decision",
                  date: "Pending",
                  status: "pending",
                },
              ],
            };

            return updatedReq;
          }

          return req;
        }),
      );

      showToast("Leave request draft saved successfully.", "info");

      return updatedReq;
    }

    const newDraft = {
      id: `req_draft_${Date.now()}`,

      userId: currentUser?.id || "usr_emp_01",

      managerId: currentUser?.managerId || "usr_mgr_01",

      managerName: currentUser?.managerName || "Alex Rivera",

      organizationId: currentUser?.organizationId || "org_proton_01",

      employeeName: currentUser?.name || "Rahul Sharma",

      department: currentUser?.department || "Engineering",

      position: currentUser?.position || "Senior Software Engineer",

      avatar: currentUser?.avatar || null,

      initials: currentUser?.initial || "R",

      leaveType: data.leaveTypeName || "Annual Leave",

      typeKey: data.leaveType || "annual",

      startDate: data.startDate,

      endDate: data.endDate,

      dateDisplay: `${formatDate(data.startDate)} - ${formatDate(
        data.endDate,
      )}`,

      durationDays: Number(data.duration) || 1,

      reason: data.reason || "",

      status: "draft",

      submittedAt: null,

      submittedDisplay: "Not Submitted",

      lastUpdated: today,

      timeline: [
        {
          step: "Created as Draft",
          date: todayDisplay,
          status: "completed",
        },

        {
          step: "Submission Pending",
          date: "Pending",
          status: "pending",
        },

        {
          step: "Manager Review",
          date: "Pending",
          status: "pending",
        },

        {
          step: "Final Decision",
          date: "Pending",
          status: "pending",
        },
      ],
    };

    setRequests((prev) => [newDraft, ...prev]);

    showToast("Leave request draft saved successfully.", "info");

    return newDraft;
  };

  // ============================================================
  // SUBMIT LEAVE
  // ============================================================

  const submitLeaveRequest = async (data, existingId = null) => {
    try {
      const typeKey = data.leaveType || "annual";

      const payload = {
        leave_type: typeKey,

        start_date: data.startDate,

        end_date: data.endDate,

        reason: data.reason || "Leave requested via LeaveTrack portal",
      };

      const res = await api.post("/leaves/", payload);

      const newLeave = res.data;

      await fetchRequestsFromDB();

      await fetchCurrentUserFromDB();

      if (
        currentUser?.role === "manager" ||
        currentUser?.role === "hr" ||
        currentUser?.role === "admin"
      ) {
        await fetchEmployeesFromDB();
      }

      const unpaidDays = newLeave?.unpaid_days || 0;

      if (unpaidDays > 0) {
        showToast(
          `Request submitted — ${unpaidDays} day${unpaidDays > 1 ? "s" : ""} exceed${unpaidDays > 1 ? "" : "s"} your available balance and will be UNPAID.`,
          "danger",
        );
      } else {
        showToast("Leave request submitted successfully.", "success");
      }

      return mapBackendLeaveToFrontend(newLeave);
    } catch (err) {
      const errMsg =
        err.response?.data?.detail ||
        err.message ||
        "Failed to submit leave request.";

      showToast(errMsg, "danger");

      return null;
    }
  };

  // ============================================================
  // CANCEL LEAVE
  // ============================================================

  const cancelLeaveRequest = async (id, reason = "Cancelled by employee") => {
    try {
      const targetReq = requests.find((r) => r.id === id);

      const backendId = targetReq?.backendId || id;

      await api.delete(`/leaves/${backendId}`);

      await fetchRequestsFromDB();

      await fetchCurrentUserFromDB();

      showToast("Leave request cancelled.", "info");

      return true;
    } catch (err) {
      const errMsg =
        err.response?.data?.detail ||
        err.message ||
        "Failed to cancel leave request.";

      showToast(errMsg, "danger");

      return false;
    }
  };

  // ============================================================
  // DELETE DRAFT
  // ============================================================

  const deleteDraft = (id) => {
    setRequests((prev) => prev.filter((req) => req.id !== id));

    showToast("Draft deleted successfully.", "neutral");
  };

  // ============================================================
  // MANAGER OPERATIONS
  // ============================================================

  const getTeamRequests = (managerId) => {
    const targetMgrId = managerId || currentUser?.id;

    if (!targetMgrId) {
      return [];
    }

    return requests.filter(
      (req) =>
        String(req.managerId) === String(targetMgrId) &&
        String(req.userId) !== String(targetMgrId) &&
        req.status !== "draft",
    );
  };

  const getPendingApprovals = (managerId) => {
    const targetMgrId = managerId || currentUser?.id;

    if (!targetMgrId) {
      return [];
    }

    return requests.filter(
      (req) =>
        String(req.managerId) === String(targetMgrId) &&
        String(req.userId) !== String(targetMgrId) &&
        req.status === "pending" &&
        (!req.approvalStage || req.approvalStage === "MANAGER"),
    );
  };

  const getTeamMembers = (managerId) => {
    const targetMgrId = managerId || currentUser?.id;

    if (!targetMgrId) {
      return [];
    }

    return dbEmployees.filter(
      (member) => String(member.managerId) === String(targetMgrId),
    );
  };

  // ============================================================
  // APPROVE LEAVE
  // ============================================================

  const approveLeaveRequest = async (requestId, comment = "") => {
    try {
      const targetReq = requests.find((r) => r.id === requestId);

      const backendId = targetReq?.backendId || requestId;

      await api.patch(`/leaves/${backendId}/approve`, {
        remarks: comment || null,
      });

      await fetchRequestsFromDB();

      await fetchCurrentUserFromDB();

      if (
        currentUser?.role === "manager" ||
        currentUser?.role === "hr" ||
        currentUser?.role === "admin"
      ) {
        await fetchEmployeesFromDB();
      }

      showToast(
        `Approved leave request for ${targetReq?.employeeName || "employee"}.`,
        "success",
      );

      return true;
    } catch (err) {
      const errMsg =
        err.response?.data?.detail ||
        err.message ||
        "Failed to approve leave request.";

      showToast(errMsg, "danger");

      return false;
    }
  };

  // ============================================================
  // REJECT LEAVE
  // ============================================================

  const rejectLeaveRequest = async (requestId, comment) => {
    if (!comment || !comment.trim()) {
      showToast("A rejection reason is required.", "danger");

      return false;
    }

    try {
      const targetReq = requests.find((r) => r.id === requestId);

      const backendId = targetReq?.backendId || requestId;

      await api.patch(`/leaves/${backendId}/reject`, {
        remarks: comment.trim(),
      });

      await fetchRequestsFromDB();

      await fetchCurrentUserFromDB();

      if (
        currentUser?.role === "manager" ||
        currentUser?.role === "hr" ||
        currentUser?.role === "admin"
      ) {
        await fetchEmployeesFromDB();
      }

      showToast(
        `Leave request for ${
          targetReq?.employeeName || "employee"
        } was rejected.`,
        "warning",
      );

      return true;
    } catch (err) {
      const errMsg =
        err.response?.data?.detail ||
        err.message ||
        "Failed to reject leave request.";

      showToast(errMsg, "danger");

      return false;
    }
  };

  // ============================================================
  // HR OPERATIONS
  // ============================================================

  const getOrganizationRequests = () => {
    return requests;
  };

  const getOrganizationEmployees = () => {
    return dbEmployees;
  };

  // ============================================================
  // ADD EMPLOYEE
  // ============================================================

  const addEmployee = async (employeeData) => {
    try {
      /*
       * IMPORTANT:
       *
       * We intentionally DO NOT send:
       *
       * annual_leave
       * sick_leave
       * casual_leave
       *
       * anymore.
       *
       * Leave entitlement is calculated by
       * the backend AccrualService using:
       *
       * - date of joining
       * - organization policy
       * - accrual rules
       * - proration
       * - tenure
       * - holidays
       * - existing usage
       * - pending leave
       */

      const payload = {
        employee_id:
          employeeData.employeeId || employeeData.employee_id || undefined,

        email: employeeData.email,

        full_name:
          employeeData.fullName || employeeData.full_name || employeeData.name,

        password: employeeData.password || "password123",

        role: employeeData.role || "employee",

        department: employeeData.department || "Engineering",

        region: employeeData.region || "IN",

        manager_id:
          employeeData.managerId || employeeData.manager_id || undefined,

        /*
         * THIS IS IMPORTANT.
         *
         * The accrual engine needs the employee's
         * actual joining date.
         */

        date_of_joining:
          employeeData.date_of_joining ||
          employeeData.dateOfJoining ||
          undefined,
      };

      const res = await api.post("/hr/employees", payload);

      const u = res.data;

      /*
       * Do NOT manually construct balances here.
       *
       * The backend has already calculated
       * and persisted the balance in MongoDB.
       *
       * Fetch the employee directory again so
       * MongoDB becomes the source of truth.
       */

      await fetchEmployeesFromDB();

      showToast(
        `Employee ${u.full_name} (${u.employee_id}) added with automatically calculated leave balance!`,
        "success",
      );

      return {
        success: true,
        employee: u,
      };
    } catch (err) {
      const msg =
        err.response?.data?.detail || err.message || "Failed to add employee.";

      console.error("Add employee failed:", err);

      showToast(msg, "danger");

      return {
        success: false,
        error: msg,
      };
    }
  };

  // ============================================================
  // ORGANIZATION STATS
  // ============================================================

  const getOrganizationStats = () => {
    const orgRequests = getOrganizationRequests();

    const employees = getOrganizationEmployees();

    const today = new Date();

    const todayDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1,
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const currentMonth = todayDate.substring(0, 7);

    const totalEmployees = employees.length;

    const onLeaveTodayRequests = orgRequests.filter(
      (r) =>
        r.status === "approved" &&
        r.startDate <= todayDate &&
        r.endDate >= todayDate,
    );

    const onLeaveTodayCount = onLeaveTodayRequests.length;

    const onLeavePercentage =
      totalEmployees > 0
        ? ((onLeaveTodayCount / totalEmployees) * 100).toFixed(1)
        : 0;

    const pendingRequests = orgRequests.filter((r) => r.status === "pending");

    const pendingCount = pendingRequests.length;

    const approvedThisMonthReqs = orgRequests.filter(
      (r) =>
        r.status === "approved" &&
        ((r.startDate && r.startDate.startsWith(currentMonth)) ||
          (r.lastUpdated && r.lastUpdated.startsWith(currentMonth))),
    );

    const approvedThisMonthCount = approvedThisMonthReqs.length;

    const approvedThisMonthDays = approvedThisMonthReqs.reduce(
      (sum, r) => sum + (r.durationDays || 0),
      0,
    );

    const rejectedThisMonthCount = orgRequests.filter(
      (r) =>
        r.status === "rejected" &&
        ((r.lastUpdated && r.lastUpdated.startsWith(currentMonth)) ||
          (r.submittedAt && r.submittedAt.startsWith(currentMonth))),
    ).length;

    const upcomingLeaves = orgRequests.filter(
      (r) => r.status === "approved" && r.startDate > todayDate,
    );

    const upcomingLeaveCount = upcomingLeaves.length;

    const departments = [
      "Engineering",
      "Design",
      "Product",
      "Finance",
      "Human Resources",
      "Marketing",
      "Sales",
      "Operations",
    ];

    const departmentStats = departments.map((dept) => {
      const deptReqs = orgRequests.filter(
        (r) => r.department === dept && r.status === "approved",
      );

      const annualDays = deptReqs
        .filter((r) => r.typeKey === "annual")
        .reduce((s, r) => s + (r.durationDays || 0), 0);

      const sickDays = deptReqs
        .filter((r) => r.typeKey === "sick")
        .reduce((s, r) => s + (r.durationDays || 0), 0);

      const casualDays = deptReqs
        .filter((r) => r.typeKey === "casual")
        .reduce((s, r) => s + (r.durationDays || 0), 0);

      const unpaidDays = deptReqs
        .filter((r) => r.typeKey === "unpaid")
        .reduce((s, r) => s + (r.durationDays || 0), 0);

      const totalDays = annualDays + sickDays + casualDays + unpaidDays;

      const deptEmployees = employees.filter(
        (e) => e.department === dept,
      ).length;

      return {
        department: dept,

        label: dept,

        employeeCount: deptEmployees,

        annual: annualDays,

        sick: sickDays,

        casual: casualDays,

        unpaid: unpaidDays,

        totalDays,

        pendingCount: orgRequests.filter(
          (r) => r.department === dept && r.status === "pending",
        ).length,
      };
    });

    const leaveTypeStats = [
      {
        type: "Annual Leave",
        key: "annual",

        count: orgRequests.filter((r) => r.typeKey === "annual").length,

        days: orgRequests
          .filter((r) => r.typeKey === "annual" && r.status === "approved")
          .reduce((s, r) => s + (r.durationDays || 0), 0),

        color: "#00646f",
      },

      {
        type: "Sick Leave",
        key: "sick",

        count: orgRequests.filter((r) => r.typeKey === "sick").length,

        days: orgRequests
          .filter((r) => r.typeKey === "sick" && r.status === "approved")
          .reduce((s, r) => s + (r.durationDays || 0), 0),

        color: "#b7791f",
      },

      {
        type: "Casual Leave",
        key: "casual",

        count: orgRequests.filter((r) => r.typeKey === "casual").length,

        days: orgRequests
          .filter((r) => r.typeKey === "casual" && r.status === "approved")
          .reduce((s, r) => s + (r.durationDays || 0), 0),

        color: "#3d6fa8",
      },

      {
        type: "Unpaid Leave",
        key: "unpaid",

        count: orgRequests.filter((r) => r.typeKey === "unpaid").length,

        days: orgRequests
          .filter((r) => r.typeKey === "unpaid" && r.status === "approved")
          .reduce((s, r) => s + (r.durationDays || 0), 0),

        color: "#687781",
      },
    ];

    const statusStats = {
      draft: orgRequests.filter((r) => r.status === "draft").length,

      pending: orgRequests.filter((r) => r.status === "pending").length,

      approved: orgRequests.filter((r) => r.status === "approved").length,

      rejected: orgRequests.filter((r) => r.status === "rejected").length,

      cancelled: orgRequests.filter((r) => r.status === "cancelled").length,
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

  // ============================================================
  // AUDIT LOGS
  // ============================================================

  const getAuditLogs = () => {
    return [];
  };

  // ============================================================
  // HR APPROVAL HELPERS
  // ============================================================

  const hrApproveLeaveRequest = async (requestId, comment = "") => {
    return await approveLeaveRequest(requestId, comment);
  };

  const hrRejectLeaveRequest = async (requestId, comment = "") => {
    return await rejectLeaveRequest(requestId, comment);
  };

  // ============================================================
  // USER BALANCES
  // ============================================================

  const getUserBalances = (userId) => {
    const targetId = userId || currentUser?.id;

    // ----------------------------------------------------------
    // CURRENT LOGGED-IN USER
    // ----------------------------------------------------------

    if (backendUser && String(backendUser.id) === String(targetId)) {
      return normalizeBalances(backendUser.leave_balances || {});
    }

    // ----------------------------------------------------------
    // OTHER EMPLOYEE
    // ----------------------------------------------------------

    const member = dbEmployees.find(
      (m) =>
        String(m.id) === String(targetId) ||
        String(m._id) === String(targetId) ||
        String(m.employeeId) === String(targetId),
    );

    if (member?.balances) {
      return normalizeBalances(member.balances);
    }

    // ----------------------------------------------------------
    // SAFE EMPTY FALLBACK
    // ----------------------------------------------------------

    return {
      annual: {
        total: 0,
        accrued: 0,
        carryForward: 0,
        used: 0,
        pending: 0,
        adjustments: 0,
        expired: 0,
        remaining: 0,
        usable: 0,
      },

      sick: {
        total: 0,
        accrued: 0,
        carryForward: 0,
        used: 0,
        pending: 0,
        adjustments: 0,
        expired: 0,
        remaining: 0,
        usable: 0,
      },

      casual: {
        total: 0,
        accrued: 0,
        carryForward: 0,
        used: 0,
        pending: 0,
        adjustments: 0,
        expired: 0,
        remaining: 0,
        usable: 0,
      },

      unpaid: {
        total: 0,
        accrued: 0,
        carryForward: 0,
        used: 0,
        pending: 0,
        adjustments: 0,
        expired: 0,
        remaining: 999,
        usable: 999,
      },
    };
  };

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

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

    fetchCurrentUserFromDB,
    fetchRequestsFromDB,
    fetchEmployeesFromDB,
  };

  return (
    <LeaveContext.Provider value={value}>{children}</LeaveContext.Provider>
  );
}

export function useLeave() {
  const context = useContext(LeaveContext);

  if (!context) {
    throw new Error("useLeave must be used within a LeaveProvider");
  }

  return context;
}

