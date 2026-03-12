/**
 * Example: AI-powered extraction of employee activities from KakaoTalk messages
 *
 * This demonstrates how to use Gemini AI to parse messages and extract
 * structured activity data for insertion into employee_activity_log table.
 *
 * Setup:
 * 1. Install: npm install @google/generative-ai
 * 2. Set environment variable: export GEMINI_API_KEY=your_api_key
 * 3. Get API key from: https://aistudio.google.com/app/apikey
 */

import { EGDESK_CONFIG } from '../egdesk.config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function callEgdeskAPI(tool: string, args: any) {
  const apiUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EGDESK_API_URL) ||
    EGDESK_CONFIG.apiUrl;
  const apiKey =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EGDESK_API_KEY) ||
    EGDESK_CONFIG.apiKey;

  const response = await fetch(`${apiUrl}/user-data/tools/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      tool,
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Tool call failed');
  }

  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

/**
 * Example prompt for Claude to extract activity data
 */
function buildExtractionPrompt(message: any): string {
  return `
Extract structured employee activity information from this KakaoTalk message.

Message details:
- User: ${message.user_name}
- Date: ${message.chat_date}
- Content: ${message.message}

Please analyze the message and return a JSON object with the following structure:
{
  "activities": [
    {
      "employee_name": "string",
      "activity_date": "YYYY-MM-DD",
      "activity_type": "task_completed|task_planned|meeting_attendance|issue_reported|update_shared|question_asked|other",
      "activity_summary": "brief summary",
      "activity_details": {
        // flexible structure based on activity type
      },
      "task_status": "completed|in_progress|planned|blocked|null",
      "task_priority": "high|medium|low|null",
      "time_spent_hours": number or null,
      "planned_completion_date": "YYYY-MM-DD or null",
      "related_project": "string or null",
      "mentioned_employees": ["name1", "name2"],
      "requires_followup": boolean,
      "is_blocker": boolean,
      "sentiment": "positive|neutral|negative|urgent|null",
      "confidence_score": 0.00 to 1.00
    }
  ]
}

Rules:
1. Only extract if there's meaningful work-related information
2. Set confidence_score based on clarity of the message
3. For meeting attendance: activity_type = "meeting_attendance"
4. For status updates: activity_type = "update_shared"
5. For absence notifications: activity_type = "meeting_attendance" with details about absence
6. If the message is purely social/greeting, return empty activities array
7. Extract all mentioned employee names from the message

Return ONLY valid JSON, no additional text.
`.trim();
}

/**
 * Initialize Gemini AI
 */
function initializeGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Example: Process a single message and extract activities using Gemini
 */
async function extractActivitiesFromMessage(message: any, useMock: boolean = false): Promise<any[]> {
  const prompt = buildExtractionPrompt(message);

  if (useMock) {
    // Mock extraction result for testing
    console.log('Using mock extraction (set useMock=false for real Gemini API)');
    const mockExtraction = {
      activities: [
        {
          employee_name: message.user_name,
          activity_date: message.chat_date.split(' ')[0],
          activity_type: 'meeting_attendance',
          activity_summary: 'Reported unavailability for meeting',
          activity_details: {
            attendance_status: 'absent',
            reason: 'personal matters'
          },
          task_status: null,
          task_priority: null,
          time_spent_hours: null,
          planned_completion_date: null,
          related_project: null,
          mentioned_employees: [],
          requires_followup: false,
          is_blocker: false,
          sentiment: 'neutral',
          confidence_score: 0.95
        }
      ]
    };
    return mockExtraction.activities;
  }

  // Real Gemini API call
  try {
    const genAI = initializeGemini();
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('Gemini response:', text.substring(0, 200) + '...');

    const parsed = JSON.parse(text);
    return parsed.activities || [];
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

/**
 * Insert extracted activities into database
 */
async function insertActivities(activities: any[], sourceMessageId: number) {
  for (const activity of activities) {
    const insertQuery = `
      INSERT INTO employee_activity_log (
        source_message_id,
        employee_name,
        activity_date,
        activity_type,
        activity_summary,
        activity_details,
        task_status,
        task_priority,
        time_spent_hours,
        planned_completion_date,
        related_project,
        mentioned_employees,
        requires_followup,
        is_blocker,
        sentiment,
        confidence_score,
        extraction_model
      ) VALUES (
        ${sourceMessageId},
        '${activity.employee_name.replace(/'/g, "''")}',
        '${activity.activity_date}',
        '${activity.activity_type}',
        '${activity.activity_summary.replace(/'/g, "''")}',
        '${JSON.stringify(activity.activity_details)}'::jsonb,
        ${activity.task_status ? `'${activity.task_status}'` : 'NULL'},
        ${activity.task_priority ? `'${activity.task_priority}'` : 'NULL'},
        ${activity.time_spent_hours || 'NULL'},
        ${activity.planned_completion_date ? `'${activity.planned_completion_date}'` : 'NULL'},
        ${activity.related_project ? `'${activity.related_project.replace(/'/g, "''")}'` : 'NULL'},
        ${activity.mentioned_employees?.length > 0 ? `ARRAY[${activity.mentioned_employees.map((e: string) => `'${e.replace(/'/g, "''")}'`).join(',')}]` : 'NULL'},
        ${activity.requires_followup},
        ${activity.is_blocker},
        ${activity.sentiment ? `'${activity.sentiment}'` : 'NULL'},
        ${activity.confidence_score},
        'gemini-3-flash-preview'
      )
    `;

    await callEgdeskAPI('user_data_sql_query', { query: insertQuery });
    console.log(`Inserted activity for ${activity.employee_name}`);
  }
}

/**
 * Main function: Process recent messages
 */
async function main() {
  const useMock = !process.env.GEMINI_API_KEY;

  if (useMock) {
    console.log('⚠️  GEMINI_API_KEY not found, using mock extraction\n');
    console.log('To use real Gemini API:');
    console.log('  1. Get API key from https://aistudio.google.com/app/apikey');
    console.log('  2. export GEMINI_API_KEY=your_api_key');
    console.log('  3. npm install @google/generative-ai\n');
  } else {
    console.log('✓ Using Gemini 3 Flash Preview for extraction\n');
  }

  console.log('Fetching recent KakaoTalk messages...\n');

  // Get unprocessed messages
  const query = `
    SELECT k.*
    FROM kakaotalk_egdesk_pm k
    LEFT JOIN employee_activity_log e ON k.id = e.source_message_id
    WHERE e.id IS NULL
      AND k.chat_date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY k.chat_date DESC
    LIMIT 10
  `;

  const result = await callEgdeskAPI('user_data_sql_query', { query });
  const messages = result.rows;

  console.log(`Found ${messages.length} unprocessed messages\n`);

  for (const message of messages) {
    console.log(`Processing message ${message.id} from ${message.user_name}...`);
    console.log(`Content: ${message.message.substring(0, 100)}...\n`);

    try {
      const activities = await extractActivitiesFromMessage(message, useMock);

      if (activities.length > 0) {
        await insertActivities(activities, message.id);
        console.log(`✓ Extracted ${activities.length} activities\n`);
      } else {
        console.log('No activities extracted (social/non-work message)\n');
      }
    } catch (error) {
      console.error(`Error processing message ${message.id}:`, error);
    }
  }

  console.log('Processing complete!');
}

// Uncomment to run:
// main().catch(console.error);

console.log('This is an example script demonstrating AI extraction with Gemini 3 Flash Preview.');
console.log('\nSetup:');
console.log('  1. npm install @google/generative-ai');
console.log('  2. Get API key from https://aistudio.google.com/app/apikey');
console.log('  3. export GEMINI_API_KEY=your_api_key');
console.log('\nTo run:');
console.log('  npx tsx scripts/example-ai-extraction.ts');
