/**
 * Date Context Utilities
 *
 * Handles detection, parsing, and anchor date calculations for
 * approximate/uncertain future tasks (early, mid, late, range, unspecified).
 */

export type DateContextType = 'exact' | 'early' | 'mid' | 'late' | 'range' | 'unspecified';

export interface DateContextInfo {
  date_context: DateContextType;
  date_context_raw: string | null;
}

/**
 * Encode timing context into action_taken metadata string
 */
export function encodeTimingContext(context: DateContextType, raw?: string | null): string {
  return `timing:${context}|${raw || ''}`;
}

/**
 * Parses timing context from explicit metadata or raw message/label text.
 */
export function extractDateContext(
  activity: {
    action_taken?: string | null;
    outcome?: string | null;
    activity_label?: string | null;
    activity_date?: string;
  },
  rawMessage?: string | null
): DateContextInfo {
  // 1. Check if stored in action_taken (e.g. "timing:mid|9월 중순" or JSON)
  if (activity.action_taken) {
    if (activity.action_taken.startsWith('timing:')) {
      const parts = activity.action_taken.slice(7).split('|');
      return {
        date_context: (parts[0] as DateContextType) || 'exact',
        date_context_raw: parts[1] || null
      };
    }
    if (activity.action_taken.startsWith('{') && activity.action_taken.includes('"date_context"')) {
      try {
        const parsed = JSON.parse(activity.action_taken);
        return {
          date_context: (parsed.date_context as DateContextType) || 'exact',
          date_context_raw: parsed.date_context_raw || null
        };
      } catch {
        // ignore
      }
    }
  }

  const textToScan = [
    rawMessage || '',
    activity.outcome || '',
    activity.activity_label || ''
  ].join(' ');

  if (!textToScan.trim()) {
    return { date_context: 'exact', date_context_raw: null };
  }

  // Check Range first (e.g., 9월말~10월초, 9월초~중순, 9/2~9/3)
  const rangeMatch = textToScan.match(/(\d{1,2}월\s*(?:초|중순|중|말|하순)?\s*~\s*\d{1,2}월\s*(?:초|중순|중|말|하순)?)/);
  if (rangeMatch) {
    return {
      date_context: 'range',
      date_context_raw: rangeMatch[1].trim()
    };
  }

  // Check Mid (중순, 월중, 9월 중)
  const midMatch = textToScan.match(/(\d{1,2}월\s*(?:중순|중)|(?:이번달|다음달|이달)\s*중순|중순경?)/);
  if (midMatch) {
    return {
      date_context: 'mid',
      date_context_raw: midMatch[1].trim()
    };
  }

  // Check Early (초, 초순, 월초)
  const earlyMatch = textToScan.match(/(\d{1,2}월\s*(?:초|초순)|(?:이번달|다음달|이달)\s*초|초순경?|월초)/);
  if (earlyMatch) {
    return {
      date_context: 'early',
      date_context_raw: earlyMatch[1].trim()
    };
  }

  // Check Late (말, 하순, 월말)
  const lateMatch = textToScan.match(/(\d{1,2}월\s*(?:말|하순)|(?:이번달|다음달|이달)\s*말|하순경?|월말)/);
  if (lateMatch) {
    return {
      date_context: 'late',
      date_context_raw: lateMatch[1].trim()
    };
  }

  // Check Unspecified (상반기, 하반기, 분기)
  const unspecMatch = textToScan.match(/(상반기|하반기|\d분기|\d{1,2}월경)/);
  if (unspecMatch) {
    return {
      date_context: 'unspecified',
      date_context_raw: unspecMatch[1].trim()
    };
  }

  return { date_context: 'exact', date_context_raw: null };
}

/**
 * Calculates anchor date based on base date, timing context, and optional raw timing text.
 */
export function calculateAnchorDate(
  baseDate: string, // YYYY-MM-DD or YYYY-MM
  context: DateContextType,
  explicitPlannedDate?: string | null,
  rawTiming?: string | null
): string {
  if (explicitPlannedDate && context === 'exact') {
    return explicitPlannedDate;
  }

  // Parse year & month from explicitPlannedDate or baseDate
  const baseParts = baseDate.split('-');
  let year = parseInt(baseParts[0], 10) || new Date().getFullYear();
  let month = parseInt(baseParts[1], 10) || 1;

  if (explicitPlannedDate && explicitPlannedDate.includes('-')) {
    const parts = explicitPlannedDate.split('-');
    year = parseInt(parts[0], 10) || year;
    month = parseInt(parts[1], 10) || month;
  } else if (rawTiming) {
    // Check if raw text specifies a month (e.g., "10월초", "11월말", "3월 중순")
    const monthMatch = rawTiming.match(/(\d{1,2})월/);
    if (monthMatch) {
      const parsedMonth = parseInt(monthMatch[1], 10);
      if (parsedMonth >= 1 && parsedMonth <= 12) {
        if (parsedMonth < month && (month - parsedMonth) > 6) {
          year += 1;
        }
        month = parsedMonth;
      }
    } else if (rawTiming.includes('다음달') || rawTiming.includes('익월')) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  const yStr = String(year);
  const mStr = String(month).padStart(2, '0');

  switch (context) {
    case 'early':
      return `${yStr}-${mStr}-05`;
    case 'mid':
      return `${yStr}-${mStr}-15`;
    case 'late':
      return `${yStr}-${mStr}-25`;
    case 'range':
      return explicitPlannedDate || `${yStr}-${mStr}-25`;
    case 'unspecified':
      return `${yStr}-${mStr}-15`;
    case 'exact':
    default:
      return explicitPlannedDate || baseDate;
  }
}
