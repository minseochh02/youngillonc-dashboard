/**
 * Daily conversation-based extraction of employee activities
 *
 * Strategy:
 * - Process entire day's conversation as a single context window
 * - AI analyzes all messages from that day together
 * - Extracts activities for ALL employees mentioned that day
 * - Preserves conversation context and cross-message references
 *
 * Usage:
 *   npx tsx scripts/extract-daily-activities.ts [--date YYYY-MM-DD] [--days 7]
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

function buildDailyExtractionPrompt(date: string, messages: any[]): string {
  const conversationText = messages
    .map(m => `[${m.chat_date}] ${m.user_name}: ${m.message}`)
    .join('\n\n');

  return `
You are analyzing a day's worth of KakaoTalk group chat messages to extract employee activities.

Date: ${date}
Total messages: ${messages.length}

IMPORTANT CONTEXT:
- This is a GROUP CHAT, not individual messages
- Messages reference each other across time
- Multiple people may discuss the same task
- Person A might ask, Person B might volunteer, Person C might actually do it
- "I will do X" means the MESSAGE SENDER will do X
- Pay attention to who is replying to whom

FULL CONVERSATION FOR ${date}:
${conversationText}

Analyze this ENTIRE conversation and extract ALL work-related activities for ALL employees.

Return a JSON object with this structure:
{
  "date": "${date}",
  "conversation_summary": "Brief summary of main topics discussed",
  "employees": [
    {
      "employee_name": "직원 이름",
      "activities": [
        {
          "activity_type": "task_completed|task_planned|meeting_attendance|issue_reported|update_shared|question_asked|other",
          "activity_summary": "간단한 요약 (한국어)",
          "activity_details": {
            "context": "What was discussed in the conversation",
            "related_messages": ["Brief quote from relevant messages"],
            // other flexible fields
          },
          "task_status": "completed|in_progress|planned|blocked|null",
          "task_priority": "high|medium|low|null",
          "time_spent_hours": number or null,
          "planned_completion_date": "YYYY-MM-DD or null",
          "related_project": "string or null",
          "mentioned_employees": ["other employees involved in this activity"],
          "requires_followup": boolean,
          "is_blocker": boolean,
          "sentiment": "positive|neutral|negative|urgent|null",
          "confidence_score": 0.00 to 1.00
        }
      ],
      "availability_status": "available|partial|unavailable|unknown",
      "absence_reason": "string or null",
      "daily_notes": "Any other relevant notes about this person's day"
    }
  ]
}

EXTRACTION RULES:
1. Read the ENTIRE conversation first to understand context
2. Track conversation threads - who is replying to whom
3. If Person A says "I'll do it" in response to a task, attribute it to Person A
4. Group related messages about the same topic
5. For meeting attendance:
   - If someone says they can't attend → activity_type="meeting_attendance", availability_status="unavailable"
   - If someone confirms attendance → activity_type="meeting_attendance", availability_status="available"
6. For task assignments:
   - Track who volunteered or was assigned
   - Note any deadlines mentioned
   - Include context from the conversation
7. Set confidence_score based on:
   - 0.9-1.0: Clear, explicit statements
   - 0.7-0.9: Reasonable inference from context
   - 0.5-0.7: Ambiguous, may need verification
   - Below 0.5: Don't include

Return ONLY valid JSON, no additional text.
`.trim();
}

async function extractDailyActivities(date: string, messages: any[]): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 16384, // Larger for daily summaries
      responseMimeType: 'application/json',
    },
  });

  const prompt = buildDailyExtractionPrompt(date, messages);
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  return JSON.parse(text);
}

async function insertDailyActivities(date: string, extraction: any) {
  const sourceMessageIds = extraction.source_message_ids || [];

  for (const employee of extraction.employees) {
    // Insert into daily_standup_log
    const completedTasks = employee.activities
      .filter((a: any) => a.task_status === 'completed')
      .map((a: any) => ({
        task: a.activity_summary,
        details: a.activity_details,
        time_spent: a.time_spent_hours,
      }));

    const plannedTasks = employee.activities
      .filter((a: any) => ['planned', 'in_progress'].includes(a.task_status))
      .map((a: any) => ({
        task: a.activity_summary,
        deadline: a.planned_completion_date,
        priority: a.task_priority,
      }));

    const blockers = employee.activities
      .filter((a: any) => a.is_blocker)
      .map((a: any) => ({
        issue: a.activity_summary,
        needs_help_from: a.mentioned_employees?.join(', '),
        severity: a.task_priority || 'medium',
      }));

    const standupQuery = `
      INSERT INTO daily_standup_log (
        employee_name,
        report_date,
        completed_today,
        planned_tasks,
        blockers,
        availability_status,
        absence_reason,
        notes,
        source_messages,
        confidence_score
      ) VALUES (
        '${employee.employee_name.replace(/'/g, "''")}',
        '${date}',
        '${JSON.stringify(completedTasks)}'::jsonb,
        '${JSON.stringify(plannedTasks)}'::jsonb,
        '${JSON.stringify(blockers)}'::jsonb,
        '${employee.availability_status || 'unknown'}',
        ${employee.absence_reason ? `'${employee.absence_reason.replace(/'/g, "''")}'` : 'NULL'},
        ${employee.daily_notes ? `'${employee.daily_notes.replace(/'/g, "''")}'` : 'NULL'},
        ARRAY[${sourceMessageIds.join(',')}],
        ${employee.activities[0]?.confidence_score || 0.8}
      )
      ON CONFLICT (employee_name, report_date)
      DO UPDATE SET
        completed_today = EXCLUDED.completed_today,
        planned_tasks = EXCLUDED.planned_tasks,
        blockers = EXCLUDED.blockers,
        availability_status = EXCLUDED.availability_status,
        absence_reason = EXCLUDED.absence_reason,
        notes = EXCLUDED.notes,
        source_messages = EXCLUDED.source_messages,
        confidence_score = EXCLUDED.confidence_score,
        extracted_at = NOW()
    `;

    await callEgdeskAPI('user_data_sql_query', { query: standupQuery });

    // Also insert individual activities into employee_activity_log
    for (const activity of employee.activities) {
      const activityQuery = `
        INSERT INTO employee_activity_log (
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
          '${employee.employee_name.replace(/'/g, "''")}',
          '${date}',
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
          'gemini-3-flash-preview-daily'
        )
      `;

      await callEgdeskAPI('user_data_sql_query', { query: activityQuery });
    }
  }
}

async function getUnprocessedDates(daysBack: number = 7): Promise<string[]> {
  const query = `
    SELECT DISTINCT DATE(chat_date) as date
    FROM kakaotalk_egdesk_pm
    WHERE chat_date >= CURRENT_DATE - INTERVAL '${daysBack} days'
      AND NOT EXISTS (
        SELECT 1 FROM daily_standup_log
        WHERE DATE(daily_standup_log.report_date) = DATE(kakaotalk_egdesk_pm.chat_date)
      )
    ORDER BY date DESC
  `;

  const result = await callEgdeskAPI('user_data_sql_query', { query });
  return result.rows.map((r: any) => r.date);
}

async function getMessagesForDate(date: string): Promise<any[]> {
  const query = `
    SELECT *
    FROM kakaotalk_egdesk_pm
    WHERE DATE(chat_date) = '${date}'
    ORDER BY chat_date ASC
  `;

  const result = await callEgdeskAPI('user_data_sql_query', { query });
  return result.rows;
}

async function main() {
  const args = process.argv.slice(2);
  const specificDate = args.find(arg => arg.startsWith('--date='))?.split('=')[1];
  const daysArg = args.find(arg => arg.startsWith('--days='));
  const daysBack = daysArg ? parseInt(daysArg.split('=')[1]) : 7;

  console.log('='.repeat(70));
  console.log('Daily Conversation-Based Activity Extraction');
  console.log('='.repeat(70));
  console.log();

  if (!process.env.GEMINI_API_KEY) {
    console.log('⚠️  GEMINI_API_KEY not found');
    console.log('Set it with: export GEMINI_API_KEY=your_api_key');
    return;
  }

  console.log('✓ Using Gemini 3 Flash Preview');
  console.log('✓ Processing entire daily conversations for context\n');

  let datesToProcess: string[];

  if (specificDate) {
    datesToProcess = [specificDate];
    console.log(`Processing specific date: ${specificDate}\n`);
  } else {
    datesToProcess = await getUnprocessedDates(daysBack);
    console.log(`Found ${datesToProcess.length} unprocessed dates in last ${daysBack} days\n`);
  }

  for (let i = 0; i < datesToProcess.length; i++) {
    const date = datesToProcess[i];
    console.log(`[${i + 1}/${datesToProcess.length}] Processing ${date}...`);

    const messages = await getMessagesForDate(date);
    console.log(`  Found ${messages.length} messages`);

    if (messages.length === 0) {
      console.log('  ⊘ Skipping (no messages)\n');
      continue;
    }

    try {
      const extraction = await extractDailyActivities(date, messages);
      const sourceMessageIds = messages.map(m => m.id);
      extraction.source_message_ids = sourceMessageIds;

      console.log(`  Summary: ${extraction.conversation_summary}`);
      console.log(`  Extracted activities for ${extraction.employees?.length || 0} employees`);

      await insertDailyActivities(date, extraction);
      console.log(`  ✓ Saved to database\n`);
    } catch (error) {
      console.error(`  ✗ Error: ${error}\n`);
    }

    // Rate limiting
    if (i < datesToProcess.length - 1) {
      console.log('⏳ Waiting 5 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('='.repeat(70));
  console.log('Extraction Complete!');
  console.log('='.repeat(70));
}

main().catch(console.error);
