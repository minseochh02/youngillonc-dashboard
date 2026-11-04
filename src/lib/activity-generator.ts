/**
 * Shared Activity Generator Module
 *
 * Extracts employee activities from KakaoTalk messages using Gemini AI.
 * Used by both automatic EML processing and manual batch extraction.
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { executeSQL, insertRows } from '../../egdesk-helpers';
import {
  DateContextType,
  encodeTimingContext,
  extractDateContext,
  calculateAnchorDate
} from './date-context';

// Tool definition for searching previous activities
const searchActivitiesTool: any = {
  functionDeclarations: [
    {
      name: 'search_previous_activities',
      description: 'Search this employee\'s previous activities to understand context. Use when messages reference previous customers, ongoing issues, or need historical context.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          employee_name: {
            type: SchemaType.STRING,
            description: 'Employee name to search for'
          },
          days_back: {
            type: SchemaType.NUMBER,
            description: 'Number of days to look back (1-7)'
          },
          search_type: {
            type: SchemaType.STRING,
            description: 'Type of activities to search: "all", "customers", "issues"',
            enum: ['all', 'customers', 'issues']
          }
        },
        required: ['employee_name', 'days_back']
      }
    }
  ]
};

export interface Message {
  id: number;
  chat_date: string;
  user_name: string;
  message: string;
  chat_room: string;
}

export interface Activity {
  source_message_id: number;
  employee_name: string;
  activity_date: string;
  activity_type: string;
  activity_label: string;
  customer: string | null;
  location: string | null;
  products: string;
  outcome: string | null;
  issue_severity: string | null;
  action_taken: string | null;
  resolved_by: string | null;
  chat_room: string;
  extracted_at: string;
  confidence_score: number;
  date_context?: DateContextType;
  date_context_raw?: string | null;
}

export interface GenerationResult {
  totalActivities: number;
  datesCovered: string[];
  errors: Array<{ date: string; error: string }>;
  employeeBreakdown: Record<string, number>;
}

export interface GenerationOptions {
  chatRoom?: string;
  logToFile?: boolean;
  onProgress?: (date: string, count: number) => void;
}

/**
 * Search previous activities for context
 */
async function searchPreviousActivities(
  employeeName: string,
  beforeDate: string,
  daysBack: number,
  searchType: string = 'all'
): Promise<any[]> {
  let whereClause = `
    WHERE employee_name = '${employeeName.replace(/'/g, "''")}'
      AND activity_date < '${beforeDate}'
  `;

  if (searchType === 'customers') {
    whereClause += ` AND customer IS NOT NULL`;
  } else if (searchType === 'issues') {
    whereClause += ` AND activity_type = 'issue'`;
  }

  const query = `
    SELECT
      activity_date,
      activity_type,
      activity_description,
      customer,
      products,
      issue_severity,
      action_taken
    FROM employee_activity_log
    ${whereClause}
    ORDER BY activity_date DESC
    LIMIT ${daysBack * 5}
  `;

  try {
    const result = await executeSQL(query);
    return result.rows || [];
  } catch (error) {
    return [];
  }
}

/**
 * Fetch planned tasks for a specific date
 */
async function fetchPlannedTasksForDate(date: string): Promise<any[]> {
  const query = `
    SELECT
      employee_name,
      activity_label,
      customer,
      location,
      products,
      source_message_id
    FROM employee_activity_log
    WHERE activity_type = 'planned_task'
      AND activity_date = '${date}'
  `;

  try {
    const result = await executeSQL(query);
    return result.rows || [];
  } catch (error) {
    return [];
  }
}

/**
 * Group messages by date
 */
function groupMessagesByDate(messages: Message[]): Map<string, Message[]> {
  const grouped = new Map<string, Message[]>();

  for (const msg of messages) {
    const date = msg.chat_date.split('T')[0]; // Extract YYYY-MM-DD

    if (!grouped.has(date)) {
      grouped.set(date, []);
    }

    grouped.get(date)!.push(msg);
  }

  return grouped;
}

/**
 * Extract activities from a full day's messages using Gemini AI
 */
async function extractActivitiesFromDay(
  date: string,
  messages: Message[],
  apiKey: string,
  options: { logToFile?: boolean } = {}
): Promise<Activity[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1
    },
    tools: [searchActivitiesTool]
  });

  const messagesText = messages.map(m =>
    `${m.id}:${m.user_name}) ${m.message}`
  ).join('\n');

  // Fetch planned tasks for this date
  const plannedTasksForToday = await fetchPlannedTasksForDate(date);
  let plannedContext = '';
  if (plannedTasksForToday.length > 0) {
    plannedContext = '\n\nPlanned tasks for today (to help match completed work with plans):\n';
    plannedTasksForToday.forEach((p: any) => {
      const productsStr = p.products && p.products !== '[]' ? ` [${p.products}]` : '';
      plannedContext += `- ${p.employee_name}: ${p.activity_label}`;
      if (p.customer) plannedContext += ` @ ${p.customer}`;
      if (p.location) plannedContext += ` in ${p.location}`;
      plannedContext += productsStr + '\n';
    });
  }

  const systemPrompt = `You are analyzing daily work reports from a Korean B2B sales team.

Date: ${date}
${plannedContext}

Messages from the day (format: message_id:sender) message):
${messagesText}

IMPORTANT: Check if today's completed work matches any planned tasks listed above.

EXCLUDE these activities (don't extract):
- 퇴근 (leaving work/checkout) - we don't need this data

Extract ALL OTHER activities from these messages and return them as a JSON array. Each activity should be a separate object.

IMPORTANT: employee_name must be EXACTLY ONE person — never a comma-separated list. If several people
collaborate on the same activity (e.g. a joint/accompanied visit "동행 방문", or team work), emit a
SEPARATE activity object for EACH person, duplicating the activity details with that person's name.

Activity types:
- completed_task: Something they did today
- planned_task: Something they plan to do (look for "내일", "예정", "방문 예정", "9월 중순", "9월초", "9월말", "대보수기간")
  - IMPORTANT for planned tasks & future events:
    - Set planned_date to a representative anchor date (YYYY-MM-DD):
      - Exact specific date if mentioned (e.g. "내일" -> next day, "9월 21일" -> 2026-09-21)
      - Early period ("9월초", "다음달 초", "월초") -> 5th of that month (e.g. 2026-09-05)
      - Mid period ("9월 중순", "중순", "9월 중") -> 15th of that month (e.g. 2026-09-15)
      - Late period ("9월말", "월말", "9월 하순") -> 25th of that month (e.g. 2026-09-25)
      - Range ("9월말~10월초") -> start date of the period (e.g. 2026-09-25)
      - Unspecified/General ("상반기", "10월경") -> 15th of the target month
    - Set date_context to one of: "exact" | "early" | "mid" | "late" | "range" | "unspecified"
    - Set date_context_raw to the original Korean phrasing (e.g., "9월 중순", "9월말~10월초", "내일")
- issue: A problem, blocker, or challenge
- meeting: A meeting or discussion
- other: Anything else noteworthy

Return JSON array (extract metadata ONLY, do NOT rewrite the message):
[
  {
    "message_ids": [array of message IDs this activity spans - can be multiple if split messages or conversation],
    "employee_name": "the SINGLE person doing the activity (exactly one name, never a list)",
    "activity_type": "completed_task|planned_task|issue|meeting|other",
    "activity_label": "short label (2-4 words max, e.g., '고객 방문', '미팅', '납품', '문제 보고')",
    "customer": "customer/company name extracted from message or null",
    "location": "location extracted from message or null",
    "products": ["product names extracted from message"] or [],
    "outcome": "outcome if mentioned or null",
    "issue_severity": "low|medium|high or null (only for issues)",
    "action_taken": "action taken if mentioned or null (only for issues)",
    "resolved_by": "person who resolved the issue (if someone answered/resolved) or null",
    "planned_date": "YYYY-MM-DD representative date for future tasks/meetings or null",
    "date_context": "exact|early|mid|late|range|unspecified",
    "date_context_raw": "original timing text (e.g. '9월 중순', '9월말~10월초', '내일') or null"
  }
]

Example conversation:
26:조종복) 3월에 제주에너지공사 입찰건이 있습니다. 작년에 조건을 변경하여 입찰진행하였습니다.
27:조종복) 저희 회사가 계열분리를 하는데 소기업으로 변경되는지요?
28:신형철) 분사해도 소기업은 않되고 중소기업 입니다

Return:
{
  "message_ids": [26, 27, 28],
  "employee_name": "조종복",
  "activity_type": "completed_task",
  "activity_label": "입찰 준비",
  "customer": "제주에너지공사",
  "outcome": "기업규모 확인 완료",
  "resolved_by": "신형철",
  ...
}`;

  try {
    // Initial request
    let result = await model.generateContent(systemPrompt);
    let response = result.response;

    // Handle tool calls
    let functionCalls = typeof response.functionCalls === 'function' ? response.functionCalls() : (response as any).functionCalls;
    while (functionCalls && functionCalls.length > 0) {
      const functionCall = functionCalls[0];

      if (functionCall.name === 'search_previous_activities') {
        const employeeName = (functionCall.args as any).employee_name;
        const daysBack = (functionCall.args as any).days_back || 3;
        const searchType = (functionCall.args as any).search_type || 'all';

        console.log(`    🔍 AI requested previous activities: ${daysBack} days, type: ${searchType}`);

        const history = await searchPreviousActivities(employeeName, date, daysBack, searchType);

        const historyText = history.map((h: any) =>
          `${h.activity_date}: ${h.activity_type} - ${h.activity_description}` +
          (h.customer ? ` @ ${h.customer}` : '') +
          (h.issue_severity ? ` [${h.issue_severity}]` : '')
        ).join('\n');

        // Continue with function response
        result = await model.generateContent([
          { text: systemPrompt },
          {
            functionCall: {
              name: functionCall.name,
              args: functionCall.args
            }
          },
          {
            functionResponse: {
              name: functionCall.name,
              response: {
                activities: historyText || 'No previous activities found'
              }
            }
          }
        ]);

        response = result.response;
      } else {
        break;
      }
    }

    // Parse final response
    let text = response.text();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(text);
    const activities: Activity[] = [];

    // Convert to Activity objects
    for (const activity of parsed) {
      // Use first message_id from array
      const messageIds = activity.message_ids || [activity.message_id] || [messages[0].id];
      const sourceMessageId = Array.isArray(messageIds) ? messageIds[0] : messageIds;
      const matchingMsg = messages.find(m => m.id === sourceMessageId)?.message || messages[0]?.message;

      // Extract date context & calculate anchor date
      const contextFromExtraction = (activity.date_context as DateContextType) || null;
      const rawFromExtraction = activity.date_context_raw || null;

      const timingInfo = (contextFromExtraction && contextFromExtraction !== 'exact')
        ? { date_context: contextFromExtraction, date_context_raw: rawFromExtraction }
        : extractDateContext(activity, matchingMsg);

      let activityDate = date;
      if (activity.planned_date) {
        activityDate = calculateAnchorDate(date, timingInfo.date_context, activity.planned_date);
      } else if (activity.activity_type === 'planned_task') {
        if (timingInfo.date_context !== 'exact') {
          activityDate = calculateAnchorDate(date, timingInfo.date_context, null);
        } else {
          // Default to next day for planned_task without explicit date
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);
          activityDate = nextDay.toISOString().split('T')[0];
        }
      }

      let actionTaken = activity.action_taken || null;
      if ((activity.activity_type === 'planned_task' || activity.planned_date) && timingInfo.date_context !== 'exact') {
        actionTaken = encodeTimingContext(timingInfo.date_context, timingInfo.date_context_raw);
      }

      activities.push({
        source_message_id: sourceMessageId,
        employee_name: activity.employee_name,
        activity_date: activityDate,
        activity_type: activity.activity_type,
        activity_label: activity.activity_label || 'unknown',
        customer: activity.customer || null,
        location: activity.location || null,
        products: JSON.stringify(activity.products || []),
        outcome: activity.outcome || null,
        issue_severity: activity.issue_severity || null,
        action_taken: actionTaken,
        resolved_by: activity.resolved_by || null,
        chat_room: messages[0].chat_room,
        extracted_at: new Date().toISOString(),
        confidence_score: 0.85,
        date_context: timingInfo.date_context,
        date_context_raw: timingInfo.date_context_raw
      });
    }

    return activities;
  } catch (error: any) {
    console.error(`❌ Failed to extract for ${date}:`, error.message);

    // Log failed extraction to file if enabled
    if (options.logToFile) {
      const fs = await import('fs/promises');
      const failedLog = {
        date: date,
        error: error.message,
        error_stack: error.stack,
        timestamp: new Date().toISOString(),
        messages: messages.map(m => ({ id: m.id, message: m.message }))
      };

      try {
        const logFile = 'FINAL-Kakaotalk/failed-extractions.jsonl';
        await fs.appendFile(logFile, JSON.stringify(failedLog) + '\n');
      } catch (logError) {
        console.error('  ⚠️  Could not log error to file');
      }
    }

    return [];
  }
}

/**
 * Fetch messages from kakaotalk_raw_messages for date range
 */
async function fetchMessages(
  startDate: string,
  endDate: string,
  chatRoom?: string
): Promise<Message[]> {
  const chatRoomFilter = chatRoom
    ? `AND chat_room = '${chatRoom.replace(/'/g, "''")}'`
    : `AND chat_room = 'Youngil OnC 최강 B2B 14 님과 카카오톡 대화'`;

  const query = `
    SELECT id, chat_date, user_name, message, chat_room
    FROM kakaotalk_raw_messages
    WHERE DATE(chat_date) >= '${startDate}'
      AND DATE(chat_date) <= '${endDate}'
      AND user_name != 'SYSTEM'
      ${chatRoomFilter}
    ORDER BY chat_date ASC
  `;

  const result = await executeSQL(query);
  return result.rows;
}

/**
 * Main function to generate activities for a date range
 */
export async function generateActivitiesForDateRange(
  startDate: string,
  endDate: string,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  const { chatRoom, logToFile = false, onProgress } = options;

  // Get API key from environment
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment');
  }

  console.log(`📥 Fetching messages from ${startDate} to ${endDate}...`);

  // Fetch messages
  const messages = await fetchMessages(startDate, endDate, chatRoom);
  console.log(`✅ Fetched ${messages.length} messages`);

  if (messages.length === 0) {
    return {
      totalActivities: 0,
      datesCovered: [],
      errors: [],
      employeeBreakdown: {}
    };
  }

  // Group by date
  const grouped = groupMessagesByDate(messages);
  console.log(`✅ Found ${grouped.size} days with messages`);

  // Extract activities
  const allActivities: Activity[] = [];
  const errors: Array<{ date: string; error: string }> = [];
  const employeeBreakdown: Record<string, number> = {};

  for (const [date, msgs] of grouped.entries()) {
    console.log(`\n📅 Processing ${date} - ${msgs.length} messages`);

    try {
      const activities = await extractActivitiesFromDay(date, msgs, apiKey, { logToFile });

      if (activities.length > 0) {
        allActivities.push(...activities);
        console.log(`  ✅ Extracted ${activities.length} activities`);

        // Track employee breakdown
        activities.forEach(a => {
          employeeBreakdown[a.employee_name] = (employeeBreakdown[a.employee_name] || 0) + 1;
        });

        // Show employee breakdown
        const employeeCounts = activities.reduce((acc: any, a) => {
          acc[a.employee_name] = (acc[a.employee_name] || 0) + 1;
          return acc;
        }, {});
        Object.entries(employeeCounts).forEach(([name, count]) => {
          console.log(`    ${name}: ${count} activities`);
        });

        // Call progress callback
        if (onProgress) {
          onProgress(date, activities.length);
        }
      }
    } catch (error: any) {
      errors.push({ date, error: error.message });
    }

    // Rate limiting: 1 second delay between dates
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Insert into database
  if (allActivities.length > 0) {
    console.log(`\n💾 Inserting ${allActivities.length} activities into database...`);

    try {
      await insertRows('employee_activity_log', allActivities);
      console.log('✅ Successfully inserted all activities');
    } catch (error: any) {
      console.error('❌ Failed to insert activities:', error.message);

      // Save to file as backup if enabled
      if (logToFile) {
        const fs = await import('fs/promises');
        const filename = `FINAL-Kakaotalk/extraction-${startDate}-to-${endDate}.json`;
        await fs.writeFile(filename, JSON.stringify(allActivities, null, 2));
        console.log(`💾 Saved extraction results to ${filename}`);
      }

      throw error;
    }
  }

  return {
    totalActivities: allActivities.length,
    datesCovered: Array.from(grouped.keys()),
    errors,
    employeeBreakdown
  };
}
