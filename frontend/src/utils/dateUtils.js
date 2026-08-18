/**
 * Configured Company Holidays for 2026
 */
export const CONFIGURED_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-19', name: 'Martin Luther King Jr. Day' },
  { date: '2026-02-16', name: "Presidents' Day" },
  { date: '2026-05-25', name: 'Memorial Day' },
  { date: '2026-06-19', name: 'Juneteenth' },
  { date: '2026-07-03', name: 'Independence Day (Observed)' },
  { date: '2026-09-07', name: 'Labor Day' },
  { date: '2026-10-12', name: "Columbus / Indigenous Peoples' Day" },
  { date: '2026-11-11', name: 'Veterans Day' },
  { date: '2026-11-26', name: 'Thanksgiving Day' },
  { date: '2026-11-27', name: 'Day After Thanksgiving' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

/**
 * Checks if a date string (YYYY-MM-DD) is a company holiday
 */
export function isCompanyHoliday(dateStr, holidayList = CONFIGURED_HOLIDAYS_2026) {
  if (!dateStr) return false;
  return holidayList.some((h) => h.date === dateStr);
}

/**
 * Returns holiday details if date is a holiday
 */
export function getHolidayInfo(dateStr, holidayList = CONFIGURED_HOLIDAYS_2026) {
  if (!dateStr) return null;
  return holidayList.find((h) => h.date === dateStr) || null;
}

/**
 * Calculates working days between two dates, excluding:
 * - Saturday (6)
 * - Sunday (0)
 * - Configured company holidays
 */
export function calculateWorkingDays(startDateStr, endDateStr, holidayList = CONFIGURED_HOLIDAYS_2026) {
  if (!startDateStr || !endDateStr) return 0;

  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (start > end) return 0;

  let count = 0;
  const curDate = new Date(start);

  while (curDate <= end) {
    const dayOfWeek = curDate.getDay();
    const isoDateStr = curDate.toISOString().split('T')[0];

    // Exclude Saturday (6), Sunday (0) and company holidays
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = isCompanyHoliday(isoDateStr, holidayList);

    if (!isWeekend && !isHoliday) {
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }

  return count;
}

/**
 * Formats date into readable string e.g. "Oct 12, 2026"
 */
export function formatDate(dateInput) {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' && !dateInput.includes('T')
    ? new Date(`${dateInput}T00:00:00`)
    : new Date(dateInput);
    
  if (isNaN(date.getTime())) return String(dateInput);

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Returns today's ISO date string (YYYY-MM-DD)
 */
export function getTodayIsoString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
