#!/usr/bin/env tsx
/**
 * Extract Activities for a Single Date (Test)
 *
 * Uses Gemini 3.5 Flash Preview to extract structured activities from KakaoTalk messages
 * for a single date to test extraction quality.
 *
 * Usage:
 *   npx tsx scripts/extract-single-date.ts 2024-03-11
 *   npx tsx scripts/extract-single-date.ts 2024-03-11 --dry-run
 */

import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeSQL, insertRows } from '../egdesk-helpers';

// Load environment variables from .env.local
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

/**
 * Get messages for a specific date
 */
async function getMessagesForDate(date: string) {
  console.log(`📥 Fetching messages for ${date}...`);

  const result = await executeSQL(`
    SELECT
      id,
      chat_date,
      user_name,
      message,
      chat_room
    FROM kakaotalk_raw_messages
    WHERE DATE(chat_date) = '${date}'
      AND user_name != 'SYSTEM'
    ORDER BY chat_date ASC
  `);

  if (!result || !result.rows || result.rows.length === 0) {
    console.log('⚠️  No messages found for this date');
    return [];
  }

  console.log(`✅ Found ${result.rows.length} messages from ${new Set(result.rows.map((r: any) => r.user_name)).size} employees\n`);
  return result.rows;
}

/**
 * Group messages by employee
 */
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

/**
 * Extract activities using Gemini AI
 */
async function extractActivitiesForEmployee(
  employeeName: string,
  messages: any[],
  date: string
): Promise<{ activities: ExtractedActivity[], standup: DailyStandup }> {
  console.log(`🤖 Extracting activities for ${employeeName} (${messages.length} messages)...`);

  // Combine all messages from this employee for context
  const messagesText = messages.map(m => `[${m.chat_date}] ${m.message}`).join('\n');

  const prompt = `You are analyzing Korean sales team KakaoTalk messages to extract structured work activities.

**Context:** This is a sales team (영업팀) for an industrial lubricant company (Mobil products). Employees visit customers, discuss products, complete work (oil changes, deliveries), and report their activities daily.

**Employee:** ${employeeName}
**Date:** ${date}

**Messages:**
${messagesText}

**Task:** Extract the following information in JSON format:

1. **Individual Activities** (activities array): Each distinct activity this employee did:
   - activity_type: "customer_visit" | "product_discussion" | "work_completed" | "sales_activity" | "issue_reported" | "planning" | "other"
   - activity_summary: Brief Korean description (1 sentence)
   - customer_name: Company/customer name if mentioned (e.g., "삼표", "린데", "APK")
   - location: Location/region if mentioned (e.g., "대산", "화성사무소", "울산")
   - products_mentioned: Array of products discussed (e.g., ["Mobil DTE 25", "Gear 600 XP 320"])
   - task_status: "completed" | "in_progress" | "planned" | null
   - next_action: What they plan to do tomorrow/next
   - next_action_date: Date for next action (YYYY-MM-DD format) if mentioned as "내일" use tomorrow's date
   - requires_followup: true if needs follow-up action
   - is_blocker: true if there's a blocking issue
   - sentiment: "positive" | "neutral" | "negative" | "urgent" | null
   - confidence_score: 0.0-1.0 (how confident you are in this extraction)

2. **Daily Standup Summary** (standup object):
   - completed_today: [{task, customer?, details?}] - What they completed today
   - planned_tasks: [{task, customer?, deadline?}] - What they plan to do
   - blockers: [{issue, severity}] - Any blockers or issues
   - customers_visited: [array of customer names]
   - products_discussed: [array of product names]
   - checkout_location: Where they checked out from (look for "에서 퇴근")
   - work_region: Region they worked in
   - notes: Any other important notes
   - confidence_score: 0.0-1.0

**Important:**
- Extract company names accurately (삼표, 린데, APK, 포르쉐, etc.)
- "내일" means tomorrow (${new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0]})
- "퇴근" means check-out/end of workday
- Look for oil change details (유압유, 터빈유, etc. with quantities)
- Identify competitors (Shell, S-Oil, etc.)

Return ONLY valid JSON in this exact format:
{
  "activities": [...],
  "standup": {...}
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Extract JSON from response (sometimes wrapped in markdown)
    let jsonText = text;
    if (text.includes('```json')) {
      jsonText = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      jsonText = text.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(jsonText);

    // Add metadata
    const activities: ExtractedActivity[] = (parsed.activities || []).map((a: any) => ({
      ...a,
      employee_name: employeeName,
      activity_date: date,
      extraction_model: 'gemini-2.5-flash',
      activity_details: JSON.stringify(a.activity_details || {}),
      products_mentioned: JSON.stringify(a.products_mentioned || [])
    }));

    const standup: DailyStandup = {
      ...parsed.standup,
      employee_name: employeeName,
      report_date: date,
      extraction_model: 'gemini-2.5-flash',
      completed_today: JSON.stringify(parsed.standup?.completed_today || []),
      planned_tasks: JSON.stringify(parsed.standup?.planned_tasks || []),
      blockers: JSON.stringify(parsed.standup?.blockers || []),
      customers_visited: JSON.stringify(parsed.standup?.customers_visited || []),
      products_discussed: JSON.stringify(parsed.standup?.products_discussed || [])
    };

    console.log(`   ✅ Extracted ${activities.length} activities`);
    return { activities, standup };

  } catch (error: any) {
    console.error(`   ❌ Extraction failed for ${employeeName}:`, error.message);
    return { activities: [], standup: {} as DailyStandup };
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const date = args[0];
  const isDryRun = args.includes('--dry-run');

  if (!date) {
    console.error('❌ Usage: npx tsx scripts/extract-single-date.ts <date> [--dry-run]');
    console.error('   Example: npx tsx scripts/extract-single-date.ts 2024-03-11');
    process.exit(1);
  }

  console.log(`🚀 Extracting activities for ${date}${isDryRun ? ' (DRY RUN)' : ''}\n`);

  // Step 1: Get messages
  const messages = await getMessagesForDate(date);
  if (messages.length === 0) {
    return;
  }

  // Step 2: Group by employee
  const grouped = groupMessagesByEmployee(messages);
  console.log(`👥 Processing ${grouped.size} employees\n`);

  // Step 3: Extract activities for each employee
  const allActivities: ExtractedActivity[] = [];
  const allStandups: DailyStandup[] = [];

  for (const [employeeName, empMessages] of grouped.entries()) {
    const { activities, standup } = await extractActivitiesForEmployee(
      employeeName,
      empMessages,
      date
    );

    allActivities.push(...activities);
    if (Object.keys(standup).length > 0) {
      allStandups.push(standup);
    }

    // Rate limiting - wait 1 second between API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Extraction Results:`);
  console.log(`   Total activities: ${allActivities.length}`);
  console.log(`   Daily standups: ${allStandups.length}`);
  console.log();

  // Step 4: Show extracted data
  console.log('📝 Extracted Activities:\n');
  allActivities.forEach((activity, idx) => {
    console.log(`${idx + 1}. [${activity.employee_name}] ${activity.activity_type}`);
    console.log(`   Summary: ${activity.activity_summary}`);
    if (activity.customer_name) console.log(`   Customer: ${activity.customer_name}`);
    if (activity.location) console.log(`   Location: ${activity.location}`);
    if (activity.products_mentioned) {
      const products = JSON.parse(activity.products_mentioned);
      if (products.length > 0) console.log(`   Products: ${products.join(', ')}`);
    }
    if (activity.next_action) console.log(`   Next: ${activity.next_action}`);
    console.log(`   Confidence: ${(activity.confidence_score * 100).toFixed(0)}%`);
    console.log();
  });

  console.log('\n📋 Daily Standups:\n');
  allStandups.forEach((standup, idx) => {
    console.log(`${idx + 1}. ${standup.employee_name} (${standup.report_date})`);
    if (standup.checkout_location) console.log(`   Checked out from: ${standup.checkout_location}`);

    const completed = JSON.parse(standup.completed_today || '[]');
    if (completed.length > 0) {
      console.log(`   Completed today (${completed.length}):`);
      completed.slice(0, 3).forEach((t: any) => console.log(`      - ${t.task}${t.customer ? ` (${t.customer})` : ''}`));
    }

    const planned = JSON.parse(standup.planned_tasks || '[]');
    if (planned.length > 0) {
      console.log(`   Planned tasks (${planned.length}):`);
      planned.slice(0, 3).forEach((t: any) => console.log(`      - ${t.task}${t.customer ? ` (${t.customer})` : ''}`));
    }

    const customers = JSON.parse(standup.customers_visited || '[]');
    if (customers.length > 0) console.log(`   Customers: ${customers.join(', ')}`);

    console.log(`   Confidence: ${(standup.confidence_score * 100).toFixed(0)}%`);
    console.log();
  });

  // Step 5: Insert into database (unless dry run)
  if (!isDryRun) {
    console.log('💾 Inserting into database...\n');

    if (allActivities.length > 0) {
      try {
        await insertRows('employee_activity_log', allActivities);
        console.log(`✅ Inserted ${allActivities.length} activities into employee_activity_log`);
      } catch (error: any) {
        console.error(`❌ Error inserting activities:`, error.message);
      }
    }

    if (allStandups.length > 0) {
      try {
        await insertRows('daily_standup_log', allStandups);
        console.log(`✅ Inserted ${allStandups.length} standups into daily_standup_log`);
      } catch (error: any) {
        console.error(`❌ Error inserting standups:`, error.message);
      }
    }
  } else {
    console.log('🔍 DRY RUN - No data inserted into database');
  }

  console.log('\n✅ Extraction complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
