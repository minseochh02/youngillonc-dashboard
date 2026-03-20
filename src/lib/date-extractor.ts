/**
 * Extract and format date range from SQL
 */

/**
 * Extract dates from SQL query
 */
export function extractDatesFromSQL(sql: string): { start: string; end: string } | null {
  if (!sql || typeof sql !== 'string') {
    return null;
  }

  const datePattern = /'(\d{4}-\d{2}-\d{2})'/g;
  const matches = [...sql.matchAll(datePattern)];

  if (matches.length === 0) {
    return null;
  }

  const dates = [...new Set(matches.map(m => m[1]))].sort();

  if (dates.length === 1) {
    return { start: dates[0], end: dates[0] };
  } else if (dates.length >= 2) {
    return { start: dates[0], end: dates[dates.length - 1] };
  }

  return null;
}

/**
 * Format date range for display
 */
export function formatDateRangeDisplay(start: string, end: string): string {
  if (start === end) {
    // Single date
    return formatSingleDate(start);
  }

  // Date range
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Check if it's a full month
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  // Check if it's the last day of the month
  const lastDayOfMonth = new Date(endYear, endMonth + 1, 0).getDate();

  if (startDay === 1 && endDay === lastDayOfMonth && startMonth === endMonth) {
    // Full month
    return `${startYear}년 ${startMonth + 1}월`;
  }

  // Different formatting based on range
  if (startYear === endYear) {
    if (startMonth === endMonth) {
      // Same month
      return `${startYear}.${String(startMonth + 1).padStart(2, '0')}.${String(startDay).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    } else {
      // Different months, same year
      return `${startYear}.${String(startMonth + 1).padStart(2, '0')}.${String(startDay).padStart(2, '0')} - ${String(endMonth + 1).padStart(2, '0')}.${String(endDay).padStart(2, '0')}`;
    }
  }

  // Different years
  return `${startYear}.${String(startMonth + 1).padStart(2, '0')}.${String(startDay).padStart(2, '0')} - ${endYear}.${String(endMonth + 1).padStart(2, '0')}.${String(endDay).padStart(2, '0')}`;
}

/**
 * Format single date for display
 */
function formatSingleDate(date: string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if it's today
  if (d.toDateString() === today.toDateString()) {
    return '오늘';
  }

  // Check if it's yesterday
  if (d.toDateString() === yesterday.toDateString()) {
    return '어제';
  }

  // Format as date
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
