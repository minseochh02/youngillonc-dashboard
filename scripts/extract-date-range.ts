#!/usr/bin/env tsx
/**
 * Extract Activities for a Date Range
 *
 * Extracts multiple consecutive dates to build up follow-up tracking data
 *
 * Usage:
 *   npx tsx scripts/extract-date-range.ts 2024-03-11 2024-03-18
 */

import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeSQL, insertRows } from '../egdesk-helpers';

// Load environment variables
config({ path: '.env.local' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

function groupMessagesByEmployee(messages: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();
  for (const msg of messages) {
    if (!grouped.has(msg.user_name)) {
      grouped.set(msg.user_name, []);
    }
    grouped.get(msg.user_name)!.push(msg);
  }
  return grouped;
}

async function extractActivitiesForEmployee(
  employeeName: string,
  messages: any[],
  date: string,
  chatRoom: string
): Promise<{ activities: ExtractedActivity[], standup: DailyStandup }> {

  const messagesText = messages.map(m => `[${m.chat_date}] ${m.message}`).join('\n');
  const messageIds = messages.map(m => m.id); // Track source message IDs

  const tomorrow = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0];

  const prompt = `You are analyzing Korean sales team KakaoTalk messages to extract structured work activities.

**Context:** Industrial lubricant sales team (Mobil products). Extract ONLY meaningful work activities.

**Employee:** ${employeeName}
**Date:** ${date}

**Messages:**
${messagesText}

**IMPORTANT - Filter Out Noise:**
- IGNORE simple clock-out messages like "화성사무소에서 퇴근합니다" with no other content
- IGNORE generic "외근 완료" without details
- ONLY extract activities with actual work content (customer visits, product discussions, sales activities)

**Task:** Extract the following in JSON format:

1. **activities**: Each distinct meaningful activity:
   - activity_type: "customer_visit" | "product_discussion" | "work_completed" | "sales_activity" | "issue_reported" | "planning" | "other"
   - activity_summary: Brief Korean description (1 sentence)
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

2. **standup**: Daily summary
   - completed_today: [{task, customer?, details?}]
   - planned_tasks: [{task, customer?, deadline?}]
   - blockers: [{issue, severity}]
   - customers_visited: [array of customer names]
   - products_discussed: [array of product names]
   - checkout_location: Where they checked out from (only if meaningful)
   - confidence_score: 0.0-1.0

Return ONLY valid JSON:
{
  "activities": [...],
  "standup": {...}
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

    const activities: ExtractedActivity[] = (parsed.activities || []).map((a: any) => ({
      ...a,
      employee_name: employeeName,
      activity_date: date,
      chat_room: chatRoom,
      source_message_ids: JSON.stringify(messageIds),
      extraction_model: 'gemini-2.5-flash',
      activity_details: JSON.stringify(a.activity_details || {}),
      products_mentioned: JSON.stringify(a.products_mentioned || []),
      requires_followup: a.requires_followup ? 1 : 0,
      is_blocker: a.is_blocker ? 1 : 0
    }));

    const standup: DailyStandup = {
      ...parsed.standup,
      employee_name: employeeName,
      report_date: date,
      source_messages: JSON.stringify(messageIds),
      extraction_model: 'gemini-2.5-flash',
      completed_today: JSON.stringify(parsed.standup?.completed_today || []),
      planned_tasks: JSON.stringify(parsed.standup?.planned_tasks || []),
      blockers: JSON.stringify(parsed.standup?.blockers || []),
      customers_visited: JSON.stringify(parsed.standup?.customers_visited || []),
      products_discussed: JSON.stringify(parsed.standup?.products_discussed || [])
    };

    return { activities, standup };

  } catch (error: any) {
    console.error(`   ❌ Failed for ${employeeName}:`, error.message);
    return { activities: [], standup: {} as DailyStandup };
  }
}

async function extractDate(date: string): Promise<{ activities: any[], standups: any[] }> {
  console.log(`\n📅 Processing ${date}...`);

  const messages = await getMessagesForDate(date);
  if (messages.length === 0) {
    console.log(`   ⚠️  No messages found for ${date}`);
    return { activities: [], standups: [] };
  }

  console.log(`   📨 Found ${messages.length} messages`);

  const grouped = groupMessagesByEmployee(messages);
  console.log(`   👥 Processing ${grouped.size} employees`);

  const allActivities: ExtractedActivity[] = [];
  const allStandups: DailyStandup[] = [];

  for (const [employeeName, empMessages] of grouped.entries()) {
    process.stdout.write(`   🤖 ${employeeName}... `);

    // Get chat_room from first message (all messages for this employee/date are from same room)
    const chatRoom = empMessages[0]?.chat_room || '';

    const { activities, standup } = await extractActivitiesForEmployee(
      employeeName,
      empMessages,
      date,
      chatRoom
    );

    allActivities.push(...activities);
    if (Object.keys(standup).length > 2) { // More than just employee_name and date
      allStandups.push(standup);
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
    console.error('❌ Usage: npx tsx scripts/extract-date-range.ts <start-date> <end-date>');
    console.error('   Example: npx tsx scripts/extract-date-range.ts 2024-03-11 2024-03-18');
    process.exit(1);
  }

  console.log(`🚀 Extracting date range: ${startDate} to ${endDate}\n`);

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

  // Save to backup file
  const backupFile = `./extraction-backup-${startDate}-to-${endDate}.json`;
  console.log(`💾 Saving backup to ${backupFile}...\n`);

  const fs = await import('fs/promises');
  await fs.writeFile(backupFile, JSON.stringify({
    dateRange: { startDate, endDate },
    extractedAt: new Date().toISOString(),
    totalActivities: totalActivities.length,
    totalStandups: totalStandups.length,
    activities: totalActivities,
    standups: totalStandups
  }, null, 2));

  console.log(`✅ Backup saved to ${backupFile}\n`);

  // Insert into database
  console.log('💾 Inserting into database...\n');

  if (totalActivities.length > 0) {
    try {
      console.log(`   Inserting ${totalActivities.length} activities in batches of 20...`);

      // Insert in batches to avoid potential size limits
      for (let i = 0; i < totalActivities.length; i += 20) {
        const batch = totalActivities.slice(i, i + 20);
        console.log(`   Batch ${Math.floor(i/20) + 1}: Inserting ${batch.length} activities...`);
        const result = await insertRows('employee_activity_log', batch);
        console.log(`   Result:`, JSON.stringify(result, null, 2));
      }

      console.log(`✅ Inserted ${totalActivities.length} activities`);
    } catch (error: any) {
      console.error(`❌ Error inserting activities:`, error.message);
      console.error(`   Full error:`, error);
    }
  }

  if (totalStandups.length > 0) {
    try {
      console.log(`   Inserting ${totalStandups.length} standups...`);
      const result = await insertRows('daily_standup_log', totalStandups);
      console.log(`   Result:`, JSON.stringify(result, null, 2));
      console.log(`✅ Inserted ${totalStandups.length} standups`);
    } catch (error: any) {
      console.error(`❌ Error inserting standups:`, error.message);
      console.error(`   Full error:`, error);
    }
  }

  console.log('\n✅ All done! Check the follow-up tracker:');
  console.log('   http://localhost:3000/follow-up-tracker');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
