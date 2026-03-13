#!/usr/bin/env tsx
/**
 * Extract Employee Commitments and Activities by Date Range
 *
 * Processes kakaotalk_raw_messages and extracts:
 * - What each employee did (completed_today)
 * - What they committed to do (planned_tasks)
 * - Issues reported and actions taken (blockers)
 *
 * Stores results in daily_standup_log table for later commitment tracking.
 *
 * Usage:
 *   npx tsx scripts/extract-commitments-by-date.ts 2024-02-13 2024-02-16
 */

import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeSQL, insertRows } from '../egdesk-helpers';

config({ path: '.env.local' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Tool definition for fetching employee history
const fetchHistoryTool = {
  functionDeclarations: [
    {
      name: 'fetch_employee_history',
      description: 'Fetch this employee\'s previous daily standup reports to understand context, commitments, and ongoing issues. Use this when messages reference previous plans, ongoing issues, or vague references like "the customer from yesterday".',
      parameters: {
        type: 'OBJECT',
        properties: {
          days_back: {
            type: 'NUMBER',
            description: 'Number of previous days to fetch (1-7)',
          }
        },
        required: ['days_back']
      }
    }
  ]
};

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.1
  },
  tools: [fetchHistoryTool]
});

interface Message {
  id: number;
  chat_date: string;
  user_name: string;
  message: string;
  chat_room: string;
}

interface DailyStandup {
  employee_name: string;
  report_date: string;
  completed_today: any[];
  planned_tasks: any[];
  blockers: any[];
  customers_visited: string[];
  products_discussed: string[];
  checkout_location?: string;
  work_region?: string;
  notes?: string;
  source_messages: string;
  confidence_score: number;
}

/**
 * Fetch messages from kakaotalk_raw_messages for date range
 * Filters to only the main work report chat room
 */
async function fetchMessages(startDate: string, endDate: string): Promise<Message[]> {
  console.log(`📥 Fetching messages from ${startDate} to ${endDate}...`);

  // Filter to only the main B2B team chat room (adjust chat_room name as needed)
  const query = `
    SELECT id, chat_date, user_name, message, chat_room
    FROM kakaotalk_raw_messages
    WHERE DATE(chat_date) >= '${startDate}'
      AND DATE(chat_date) <= '${endDate}'
      AND user_name != 'SYSTEM'
      AND chat_room = 'Youngil OnC 최강 B2B 14 님과 카카오톡 대화'
    ORDER BY chat_date ASC
  `;

  const result = await executeSQL(query);
  console.log(`✅ Fetched ${result.rows.length} messages`);
  return result.rows;
}

/**
 * Group messages by employee and date
 */
function groupMessagesByEmployeeAndDate(messages: Message[]): Map<string, Map<string, Message[]>> {
  const grouped = new Map<string, Map<string, Message[]>>();

  for (const msg of messages) {
    const date = msg.chat_date.split('T')[0]; // Extract YYYY-MM-DD

    if (!grouped.has(msg.user_name)) {
      grouped.set(msg.user_name, new Map());
    }

    const employeeMap = grouped.get(msg.user_name)!;
    if (!employeeMap.has(date)) {
      employeeMap.set(date, []);
    }

    employeeMap.get(date)!.push(msg);
  }

  return grouped;
}

/**
 * Fetch employee's previous daily standup reports
 */
async function fetchEmployeeHistory(employeeName: string, beforeDate: string, daysBack: number): Promise<any[]> {
  const query = `
    SELECT
      report_date,
      completed_today,
      planned_tasks,
      blockers,
      customers_visited,
      products_discussed,
      notes
    FROM daily_standup_log
    WHERE employee_name = '${employeeName.replace(/'/g, "''")}'
      AND report_date < '${beforeDate}'
    ORDER BY report_date DESC
    LIMIT ${daysBack}
  `;

  try {
    const result = await executeSQL(query);
    return result.rows || [];
  } catch (error) {
    return [];
  }
}

/**
 * Extract daily standup info from employee's messages for a specific date
 * Uses tool calling to let AI request historical context when needed
 */
async function extractDailyStandup(
  employeeName: string,
  date: string,
  messages: Message[]
): Promise<DailyStandup | null> {
  const messagesText = messages.map(m =>
    `[${m.chat_date.split('T')[1].substring(0, 5)}] ${m.user_name}: ${m.message}`
  ).join('\n');

  const systemPrompt = `You are analyzing daily work reports from a Korean B2B sales team.

Employee: ${employeeName}
Date: ${date}

Messages:
${messagesText}

If you need context about what this employee planned yesterday or previous issues they mentioned, you can call the fetch_employee_history tool.

Extract the following information and return it as JSON:

{
  "completed_today": [
    {
      "activity": "brief description of what they did",
      "customer": "customer/company name if mentioned",
      "location": "location if mentioned",
      "products": ["product names mentioned"],
      "outcome": "result or outcome if mentioned"
    }
  ],
  "planned_tasks": [
    {
      "task": "what they plan to do",
      "date": "${date}" or next day if "내일" mentioned,
      "customer": "customer name if mentioned",
      "location": "location if mentioned"
    }
  ],
  "blockers": [
    {
      "issue": "problem or blocker reported",
      "severity": "low|medium|high",
      "action_taken": "what action was taken, if any",
      "status": "open|resolved"
    }
  ],
  "customers_visited": ["list of unique customer names mentioned"],
  "products_discussed": ["list of unique product names mentioned"],
  "checkout_location": "where they checked out from (퇴근 location), or null",
  "work_region": "geographic region they worked in, or null",
  "notes": "any other important context"
}

Guidelines:
- Extract only factual information from the messages
- For planned_tasks, look for phrases like "내일", "예정", "방문 예정"
- For blockers, look for issues, problems, delays, or challenges mentioned
- Checkout location is usually mentioned as "XX에서 퇴근합니다"
- If a field has no data, use empty array [] or null
- Be concise but accurate

Return ONLY valid JSON, no other text.`;

  try {
    // Initial request
    let result = await model.generateContent(systemPrompt);
    let response = result.response;

    // Handle tool calls (if AI requests history)
    while (response.functionCalls && response.functionCalls.length > 0) {
      const functionCall = response.functionCalls[0];

      if (functionCall.name === 'fetch_employee_history') {
        const daysBack = functionCall.args.days_back || 3;
        console.log(`    🔍 AI requested ${daysBack} days of history`);

        const history = await fetchEmployeeHistory(employeeName, date, daysBack);

        // Format history for AI
        const historyText = history.map((h: any) =>
          `${h.report_date}:\n` +
          `  Completed: ${JSON.stringify(h.completed_today)}\n` +
          `  Planned: ${JSON.stringify(h.planned_tasks)}\n` +
          `  Blockers: ${JSON.stringify(h.blockers)}\n`
        ).join('\n');

        // Send function response back to AI
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
                history: historyText || 'No previous history found'
              }
            }
          }
        ]);

        response = result.response;
      } else {
        break;
      }
    }

    // Parse final JSON response
    let text = response.text();

    // Remove markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(text);

    return {
      employee_name: employeeName,
      report_date: date,
      completed_today: JSON.stringify(parsed.completed_today || []),
      planned_tasks: JSON.stringify(parsed.planned_tasks || []),
      blockers: JSON.stringify(parsed.blockers || []),
      customers_visited: JSON.stringify(parsed.customers_visited || []),
      products_discussed: JSON.stringify(parsed.products_discussed || []),
      checkout_location: parsed.checkout_location || null,
      work_region: parsed.work_region || null,
      notes: parsed.notes || null,
      source_messages: messages.map(m => m.id).join(','),
      confidence_score: 0.85
    };
  } catch (error: any) {
    console.error(`❌ Failed to extract for ${employeeName} on ${date}:`, error.message);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error('Usage: npx tsx scripts/extract-commitments-by-date.ts <start-date> <end-date>');
    console.error('Example: npx tsx scripts/extract-commitments-by-date.ts 2024-02-13 2024-02-16');
    process.exit(1);
  }

  const [startDate, endDate] = args;

  console.log('🚀 Starting commitment extraction...\n');
  console.log(`📅 Date range: ${startDate} to ${endDate}\n`);

  // Step 1: Fetch messages
  const messages = await fetchMessages(startDate, endDate);

  if (messages.length === 0) {
    console.log('⚠️  No messages found for this date range');
    return;
  }

  // Step 2: Group by employee and date
  console.log('\n📊 Grouping messages by employee and date...');
  const grouped = groupMessagesByEmployeeAndDate(messages);
  console.log(`✅ Found ${grouped.size} employees with messages`);

  // Step 3: Extract daily standups
  console.log('\n🤖 Extracting daily standup information...\n');
  const standups: DailyStandup[] = [];

  for (const [employeeName, dateMap] of grouped.entries()) {
    console.log(`\n👤 Processing ${employeeName}...`);

    for (const [date, msgs] of dateMap.entries()) {
      console.log(`  📅 ${date} - ${msgs.length} messages`);

      const standup = await extractDailyStandup(employeeName, date, msgs);
      if (standup) {
        standups.push(standup);
        const completedCount = JSON.parse(standup.completed_today).length;
        const plannedCount = JSON.parse(standup.planned_tasks).length;
        const blockersCount = JSON.parse(standup.blockers).length;
        console.log(`    ✅ Extracted: ${completedCount} completed, ${plannedCount} planned, ${blockersCount} blockers`);
      }

      // Rate limiting - small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Step 4: Insert into database
  if (standups.length > 0) {
    console.log(`\n💾 Inserting ${standups.length} daily standups into database...`);

    try {
      await insertRows('daily_standup_log', standups);
      console.log('✅ Successfully inserted all standups');
    } catch (error: any) {
      console.error('❌ Failed to insert standups:', error.message);

      // Save to file as backup
      const fs = await import('fs/promises');
      const filename = `extraction-standups-${startDate}-to-${endDate}.json`;
      await fs.writeFile(filename, JSON.stringify(standups, null, 2));
      console.log(`💾 Saved extraction results to ${filename}`);
    }
  }

  // Step 5: Summary
  console.log('\n📊 Extraction Summary:');
  console.log(`   Employees processed: ${grouped.size}`);
  console.log(`   Daily standups extracted: ${standups.length}`);
  console.log(`   Total completed tasks: ${standups.reduce((sum, s) => sum + JSON.parse(s.completed_today).length, 0)}`);
  console.log(`   Total planned tasks: ${standups.reduce((sum, s) => sum + JSON.parse(s.planned_tasks).length, 0)}`);
  console.log(`   Total blockers: ${standups.reduce((sum, s) => sum + JSON.parse(s.blockers).length, 0)}`);

  console.log('\n✅ Extraction complete!');
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
