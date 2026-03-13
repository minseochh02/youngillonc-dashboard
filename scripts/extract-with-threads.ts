#!/usr/bin/env tsx
/**
 * Thread-Based Extraction with Context Carryover
 *
 * Extracts activities by detecting conversation threads and maintaining context
 * across threads for better accuracy.
 *
 * Usage:
 *   npx tsx scripts/extract-with-threads.ts 2024-03-08 2024-03-11
 */

import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeSQL, insertRows } from '../egdesk-helpers';
import * as fs from 'fs/promises';

config({ path: '.env.local' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

interface Message {
  id: number;
  chat_date: string;
  user_name: string;
  message: string;
  chat_room: string;
}

interface Thread {
  startTime: Date;
  endTime: Date;
  messages: Message[];
  messageIds: number[];
}

interface ExtractedActivity {
  employee_name: string;
  activity_date: string;
  activity_type: string;
  activity_summary: string;
  activity_details?: any;
  customer_name?: string;
  location?: string;
  products_mentioned?: string[];
  task_status?: string;
  next_action?: string;
  next_action_date?: string;
  requires_followup?: boolean;
  is_blocker?: boolean;
  sentiment?: string;
  confidence_score: number;
  source_message_ids?: string;
  chat_room?: string;
}

interface DailyStandup {
  employee_name: string;
  report_date: string;
  completed_today?: any[];
  planned_tasks?: any[];
  blockers?: any[];
  customers_visited?: string[];
  products_discussed?: string[];
  checkout_location?: string;
  work_region?: string;
  notes?: string;
  confidence_score: number;
  source_messages?: string;
}

/**
 * Detect conversation threads based on time gaps
 */
function detectThreads(messages: Message[], maxGapMinutes: number = 30): Thread[] {
  if (messages.length === 0) return [];

  const threads: Thread[] = [];
  let currentThread: Message[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prevTime = new Date(messages[i - 1].chat_date);
    const currTime = new Date(messages[i].chat_date);
    const gapMinutes = (currTime.getTime() - prevTime.getTime()) / (1000 * 60);

    if (gapMinutes > maxGapMinutes) {
      // Start new thread
      threads.push({
        startTime: new Date(currentThread[0].chat_date),
        endTime: new Date(currentThread[currentThread.length - 1].chat_date),
        messages: currentThread,
        messageIds: currentThread.map(m => m.id)
      });
      currentThread = [messages[i]];
    } else {
      currentThread.push(messages[i]);
    }
  }

  // Push last thread
  if (currentThread.length > 0) {
    threads.push({
      startTime: new Date(currentThread[0].chat_date),
      endTime: new Date(currentThread[currentThread.length - 1].chat_date),
      messages: currentThread,
      messageIds: currentThread.map(m => m.id)
    });
  }

  return threads;
}

/**
 * Extract activities from a thread with context from previous threads
 */
async function extractFromThread(
  thread: Thread,
  date: string,
  chatRoom: string,
  previousContext: string
): Promise<{ activities: ExtractedActivity[], standups: DailyStandup[], summary: string }> {

  const threadMessages = thread.messages
    .map(m => `[${m.chat_date}] ${m.user_name}: ${m.message}`)
    .join('\n');

  const tomorrow = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0];

  const prompt = `You are analyzing a Korean sales team KakaoTalk group chat thread.

**Previous conversation context:**
${previousContext || 'This is the first thread of the day.'}

**Current thread (${thread.messages.length} messages from ${thread.startTime.toLocaleTimeString()} to ${thread.endTime.toLocaleTimeString()}):**
${threadMessages}

**Context:** Industrial lubricant sales team (Mobil products). Extract ONLY meaningful work activities.

**Date:** ${date}

**IMPORTANT - Filter Out Noise:**
- IGNORE simple clock-out messages like "화성사무소에서 퇴근합니다" with no other content
- IGNORE generic "외근 완료" without details
- ONLY extract activities with actual work content (customer visits, product discussions, sales activities)

**Task:** Extract the following in JSON format:

1. **activities**: Array of activities, one entry PER EMPLOYEE who did meaningful work in this thread
   Each activity:
   - employee_name: The employee's name
   - activity_type: "customer_visit" | "product_discussion" | "work_completed" | "sales_activity" | "issue_reported" | "planning" | "other"
   - activity_summary: Brief Korean description (1 sentence) of what THIS employee did
   - customer_name: Company name if mentioned
   - location: Location if mentioned
   - products_mentioned: Array of products discussed
   - task_status: "completed" | "in_progress" | "planned" | null
   - next_action: What they plan to do tomorrow/next (ONLY if explicitly mentioned)
   - next_action_date: YYYY-MM-DD format (if "내일" = ${tomorrow})
   - requires_followup: true if needs follow-up action
   - is_blocker: true if there's a blocking issue
   - sentiment: "positive" | "neutral" | "negative" | "urgent" | null
   - confidence_score: 0.0-1.0

2. **standups**: Array of daily summaries, one entry PER EMPLOYEE
   Each standup:
   - employee_name: The employee's name
   - completed_today: [{task, customer?, details?}]
   - planned_tasks: [{task, customer?, deadline?}]
   - blockers: [{issue, severity}]
   - customers_visited: [array of customer names]
   - products_discussed: [array of product names]
   - checkout_location: Where they checked out from (only if meaningful)
   - confidence_score: 0.0-1.0

3. **thread_summary**: A brief summary (2-3 sentences) of what was discussed in this thread. This will be used as context for the next thread.

Return ONLY valid JSON:
{
  "activities": [...],
  "standups": [...],
  "thread_summary": "..."
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    let jsonText = text;
    if (text.includes('```json')) {
      jsonText = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      jsonText = text.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(jsonText);

    // Add metadata to activities
    const activities: ExtractedActivity[] = (parsed.activities || []).map((a: any) => ({
      ...a,
      activity_date: date,
      chat_room: chatRoom,
      source_message_ids: JSON.stringify(thread.messageIds),
      extraction_model: 'gemini-2.5-flash',
      activity_details: JSON.stringify(a.activity_details || {}),
      products_mentioned: JSON.stringify(a.products_mentioned || []),
      requires_followup: a.requires_followup ? 1 : 0,
      is_blocker: a.is_blocker ? 1 : 0
    }));

    // Add metadata to standups
    const standups: DailyStandup[] = (parsed.standups || []).map((s: any) => ({
      ...s,
      report_date: date,
      source_messages: JSON.stringify(thread.messageIds),
      extraction_model: 'gemini-2.5-flash',
      completed_today: JSON.stringify(s.completed_today || []),
      planned_tasks: JSON.stringify(s.planned_tasks || []),
      blockers: JSON.stringify(s.blockers || []),
      customers_visited: JSON.stringify(s.customers_visited || []),
      products_discussed: JSON.stringify(s.products_discussed || [])
    }));

    return {
      activities,
      standups,
      summary: parsed.thread_summary || ''
    };

  } catch (error: any) {
    console.error(`   ❌ Failed to extract from thread:`, error.message);
    return { activities: [], standups: [], summary: '' };
  }
}

async function getMessagesForDate(date: string) {
  const result = await executeSQL(`
    SELECT id, chat_date, user_name, message, chat_room
    FROM kakaotalk_raw_messages
    WHERE DATE(chat_date) = '${date}'
      AND user_name != 'SYSTEM'
    ORDER BY chat_date ASC
  `);

  return result?.rows || [];
}

async function extractDate(date: string): Promise<{ activities: any[], standups: any[] }> {
  console.log(`\n📅 Processing ${date}...`);

  const messages = await getMessagesForDate(date);
  if (messages.length === 0) {
    console.log(`   ⚠️  No messages found for ${date}`);
    return { activities: [], standups: [] };
  }

  console.log(`   📨 Found ${messages.length} messages`);

  // Detect threads
  const threads = detectThreads(messages, 30); // 30 minute gap = new thread
  console.log(`   🧵 Detected ${threads.length} conversation threads`);

  const allActivities: ExtractedActivity[] = [];
  const allStandups: DailyStandup[] = [];
  let conversationContext = '';

  // Process each thread sequentially with context carryover
  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const chatRoom = thread.messages[0]?.chat_room || '';

    process.stdout.write(`   Thread ${i + 1}/${threads.length} (${thread.messages.length} msgs)... `);

    const { activities, standups, summary } = await extractFromThread(
      thread,
      date,
      chatRoom,
      conversationContext
    );

    allActivities.push(...activities);
    allStandups.push(...standups);

    // Update context for next thread
    if (summary) {
      conversationContext += (conversationContext ? '\n' : '') + summary;
    }

    console.log(`✅ ${activities.length} activities`);

    // Rate limit - 1 second between API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`   📊 Total: ${allActivities.length} activities, ${allStandups.length} standups`);

  return { activities: allActivities, standups: allStandups };
}

async function main() {
  const args = process.argv.slice(2);
  const startDate = args[0];
  const endDate = args[1];

  if (!startDate || !endDate) {
    console.error('❌ Usage: npx tsx scripts/extract-with-threads.ts <start-date> <end-date>');
    console.error('   Example: npx tsx scripts/extract-with-threads.ts 2024-03-08 2024-03-11');
    process.exit(1);
  }

  console.log(`🚀 Thread-based extraction: ${startDate} to ${endDate}\n`);

  // Generate array of dates
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  console.log(`📆 Dates to process: ${dates.length}`);
  console.log(`   ${dates.join(', ')}\n`);

  let totalActivities: any[] = [];
  let totalStandups: any[] = [];

  for (const date of dates) {
    const { activities, standups } = await extractDate(date);
    totalActivities.push(...activities);
    totalStandups.push(...standups);
  }

  console.log(`\n📊 Extraction Complete!`);
  console.log(`   Total activities: ${totalActivities.length}`);
  console.log(`   Total standups: ${totalStandups.length}`);
  console.log();

  // Save backup
  const backupFile = `./extraction-threads-${startDate}-to-${endDate}.json`;
  console.log(`💾 Saving backup to ${backupFile}...\n`);

  await fs.writeFile(backupFile, JSON.stringify({
    dateRange: { startDate, endDate },
    extractedAt: new Date().toISOString(),
    method: 'thread-based with context carryover',
    totalActivities: totalActivities.length,
    totalStandups: totalStandups.length,
    activities: totalActivities,
    standups: totalStandups
  }, null, 2));

  console.log(`✅ Backup saved\n`);

  // Insert into database
  console.log('💾 Inserting into database...\n');

  if (totalActivities.length > 0) {
    try {
      console.log(`   Inserting ${totalActivities.length} activities in batches of 20...`);

      for (let i = 0; i < totalActivities.length; i += 20) {
        const batch = totalActivities.slice(i, i + 20);
        console.log(`   Batch ${Math.floor(i/20) + 1}: Inserting ${batch.length} activities...`);
        await insertRows('employee_activity_log', batch);
      }

      console.log(`✅ Inserted ${totalActivities.length} activities`);
    } catch (error: any) {
      console.error(`❌ Error inserting activities:`, error.message);
    }
  }

  if (totalStandups.length > 0) {
    try {
      console.log(`   Inserting ${totalStandups.length} standups...`);
      await insertRows('daily_standup_log', totalStandups);
      console.log(`✅ Inserted ${totalStandups.length} standups`);
    } catch (error: any) {
      console.error(`❌ Error inserting standups:`, error.message);
    }
  }

  console.log('\n✅ All done! Check the dashboard at:');
  console.log('   http://localhost:3000/employees');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
