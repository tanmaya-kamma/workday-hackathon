/**
 * Enterprise LeaveTrack data models — all live data is now fetched directly
 * from MongoDB Atlas (LMS database) via REST APIs.
 */

export const MOCK_USERS = {};
export const INITIAL_LEAVE_REQUESTS = [];
export const MOCK_NOTIFICATIONS = [];
export const MOCK_ORGANIZATION_EMPLOYEES = [];
export const INITIAL_AUDIT_LOGS = [];
export const MOCK_PUBLIC_HOLIDAYS = [
  { id: 'h1', date: '2026-01-26', name: 'Republic Day', type: 'Mandatory', region: 'IN' },
  { id: 'h2', date: '2026-08-15', name: 'Independence Day', type: 'Mandatory', region: 'IN' },
  { id: 'h3', date: '2026-10-02', name: 'Gandhi Jayanti', type: 'Mandatory', region: 'IN' },
  { id: 'h4', date: '2026-12-25', name: 'Christmas Day', type: 'Optional', region: 'ALL' },
];
