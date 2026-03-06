/**
 * Date Regenerator for Starred Queries
 *
 * Dynamically updates dates in SQL based on relative date patterns
 */

type RelativeDateType = 'today' | 'yesterday' | 'this_month' | 'last_month' | 'absolute';

interface DateRange {
  start: string;
  end: string;
}

/**
 * Calculate date range based on pattern
 */
function calculateDateRange(pattern: RelativeDateType, baseDate?: Date): DateRange {
  const now = baseDate || new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  switch (pattern) {
    case 'today': {
      const today = formatDate(now);
      return { start: today, end: today };
    }

    case 'yesterday': {
      const yesterday = new Date(year, month, day - 1);
      const date = formatDate(yesterday);
      return { start: date, end: date };
    }

    case 'this_month': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0); // Last day of current month
      return {
        start: formatDate(start),
        end: formatDate(end),
      };
    }

    case 'last_month': {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0); // Last day of previous month
      return {
        start: formatDate(start),
        end: formatDate(end),
      };
    }

    case 'absolute':
    default:
      // Return empty - we won't modify the SQL
      return { start: '', end: '' };
  }
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Regenerate dates in SQL based on relative date pattern
 */
export function regenerateSQLDates(
  originalSQL: string,
  relativeDateType?: RelativeDateType,
  baseDateString?: string
): string {
  // If absolute or no pattern, return original SQL
  if (!relativeDateType || relativeDateType === 'absolute') {
    return originalSQL;
  }

  // Parse base date if provided
  const baseDate = baseDateString ? new Date(baseDateString) : undefined;

  const newDates = calculateDateRange(relativeDateType, baseDate);

  // If calculation failed, return original
  if (!newDates.start || !newDates.end) {
    return originalSQL;
  }

  // Extract existing dates from SQL (format: 'YYYY-MM-DD')
  const datePattern = /'(\d{4}-\d{2}-\d{2})'/g;
  const matches = [...originalSQL.matchAll(datePattern)];

  if (matches.length === 0) {
    // No dates found in SQL, return original
    return originalSQL;
  }

  // Extract unique dates (usually start and end)
  const existingDates = [...new Set(matches.map(m => m[1]))].sort();

  if (existingDates.length === 0) {
    return originalSQL;
  }

  // Replace dates in SQL
  let updatedSQL = originalSQL;

  if (existingDates.length === 1) {
    // Single date query (e.g., "today")
    updatedSQL = updatedSQL.replace(
      new RegExp(`'${existingDates[0]}'`, 'g'),
      `'${newDates.start}'`
    );
  } else if (existingDates.length >= 2) {
    // Date range query
    const oldStart = existingDates[0];
    const oldEnd = existingDates[existingDates.length - 1];

    // Replace ALL occurrences of start date (important for UNION ALL queries)
    updatedSQL = updatedSQL.replace(
      new RegExp(`'${oldStart}'`, 'g'),
      `'${newDates.start}'`
    );
    // Replace ALL occurrences of end date
    updatedSQL = updatedSQL.replace(
      new RegExp(`'${oldEnd}'`, 'g'),
      `'${newDates.end}'`
    );
  }

  return updatedSQL;
}

/**
 * Override dates in SQL with manual dates
 */
export function overrideSQLDates(
  originalSQL: string,
  startDate: string,
  endDate: string
): string {
  if (!startDate || !endDate) {
    return originalSQL;
  }

  // Extract existing dates from SQL (format: 'YYYY-MM-DD')
  const datePattern = /'(\d{4}-\d{2}-\d{2})'/g;
  const matches = [...originalSQL.matchAll(datePattern)];

  if (matches.length === 0) {
    return originalSQL;
  }

  // Extract unique dates
  const existingDates = [...new Set(matches.map(m => m[1]))].sort();

  if (existingDates.length === 0) {
    return originalSQL;
  }

  let updatedSQL = originalSQL;

  if (existingDates.length === 1) {
    // Single date query - use start date
    updatedSQL = updatedSQL.replace(
      new RegExp(`'${existingDates[0]}'`, 'g'),
      `'${startDate}'`
    );
  } else if (existingDates.length >= 2) {
    // Date range query
    const oldStart = existingDates[0];
    const oldEnd = existingDates[existingDates.length - 1];

    // Replace start date (first occurrence)
    updatedSQL = updatedSQL.replace(`'${oldStart}'`, `'${startDate}'`);
    // Replace end date (last occurrence)
    updatedSQL = updatedSQL.replace(`'${oldEnd}'`, `'${endDate}'`);
  }

  return updatedSQL;
}
