#!/usr/bin/env tsx
/**
 * Two-Phase Extraction with Knowledge Enhancement
 *
 * Phase 1: Initial extraction to identify entities and basic activities
 * Phase 2: Query historical context and re-extract with enriched knowledge
 *
 * Usage:
 *   npx tsx scripts/extract-with-knowledge.ts 2024-03-08 2024-03-11
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

interface ExtractedEntities {
  customers: string[];
  employees: string[];
  products: string[];
  dates_mentioned: string[];
  locations: string[];
}

interface InitialActivity {
  employee_name: string;
  activity_type: string;
  activity_summary: string;
  customer_name?: string;
  location?: string;
  products_mentioned?: string[];
  task_status?: string;
  next_action?: string;
  next_action_date?: string;
  confidence_score: number;
}

interface HistoricalContext {
  previous_visits?: any[];
  planned_activities?: any[];
  ongoing_issues?: any[];
  recent_discussions?: any[];
}

interface EnhancedActivity {
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
  is_followup_to?: number; // ID of previous related activity
  context_notes?: string; // AI-generated notes about historical context
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
 * Phase 1: Initial extraction to identify entities and basic activities
 */
async function initialExtraction(
  thread: Thread,
  date: string,
  previousContext: string
): Promise<{ entities: ExtractedEntities, activities: InitialActivity[] }> {

  const threadMessages = thread.messages
    .map(m => `[${m.chat_date}] ${m.user_name}: ${m.message}`)
    .join('\n');

  const tomorrow = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0];

  const prompt = `You are analyzing a Korean sales team KakaoTalk group chat thread.

**Previous conversation context:**
${previousContext || 'This is the first thread of the day.'}

**Current thread (${thread.messages.length} messages):**
${threadMessages}

**Context:** Industrial lubricant sales team (Mobil products).

**Date:** ${date}

**Task:** Extract the following in JSON format:

1. **entities**: Identify all mentioned entities
   - customers: Array of company names
   - employees: Array of employee names who did work or reported activities
   - products: Array of product names/codes
   - dates_mentioned: Array of dates referenced (format: YYYY-MM-DD, if "내일" = ${tomorrow})
   - locations: Array of locations/cities mentioned

2. **activities**: Array of activities (ONE ACTIVITY PER EMPLOYEE PER CUSTOMER for visits)
   - IMPORTANT: If an employee visits multiple customers in one message, create SEPARATE activity entries for each customer
   - Example: "삼성디스플레이, 우신엔지어링 방문" → 2 activities
   - employee_name: The employee's name
   - activity_type: "customer_visit" | "product_discussion" | "work_completed" | "sales_activity" | "issue_reported" | "planning" | "other"
   - activity_summary: Brief Korean description (1 sentence)
   - customer_name: SINGLE company name (not comma-separated list)
   - location: Location if mentioned
   - products_mentioned: Array of products
   - task_status: "completed" | "in_progress" | "planned" | null
   - next_action: What they plan to do next (ONLY if explicitly mentioned)
   - next_action_date: YYYY-MM-DD format
   - confidence_score: 0.0-1.0

**CRITICAL RULES:**
- Split multi-customer visits into separate activities
- Create separate activities for planned future work (activity_type: "planning")
- Don't ignore simple checkout messages - check if they mention completed work first
- Each activity should be atomic and trackable

Return ONLY valid JSON:
{
  "entities": {...},
  "activities": [...]
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
    return {
      entities: parsed.entities || {},
      activities: parsed.activities || []
    };

  } catch (error: any) {
    console.error(`   ❌ Initial extraction failed:`, error.message);
    return { entities: {}, activities: [] };
  }
}

/**
 * Phase 2: Query historical context for entities
 */
async function queryHistoricalContext(
  entities: ExtractedEntities,
  currentDate: string
): Promise<HistoricalContext> {

  const context: HistoricalContext = {};

  // Query for each customer mentioned
  if (entities.customers && entities.customers.length > 0) {
    try {
      const customerList = entities.customers.map(c => `'%${c}%'`).join(' OR customer_name LIKE ');

      // Previous visits to these customers
      const visits = await executeSQL(`
        SELECT
          id, employee_name, customer_name, activity_date,
          activity_summary, activity_type, products_mentioned
        FROM employee_activity_log
        WHERE (customer_name LIKE ${customerList})
          AND activity_date < '${currentDate}'
          AND activity_type = 'customer_visit'
        ORDER BY activity_date DESC
        LIMIT 10
      `);
      context.previous_visits = visits?.rows || [];

      // Planned activities for today involving these customers
      const planned = await executeSQL(`
        SELECT
          id, employee_name, customer_name, activity_date,
          activity_summary, next_action, next_action_date
        FROM employee_activity_log
        WHERE (customer_name LIKE ${customerList})
          AND task_status = 'planned'
          AND next_action_date = '${currentDate}'
        ORDER BY activity_date DESC
        LIMIT 5
      `);
      context.planned_activities = planned?.rows || [];

      // Ongoing issues/blockers
      const issues = await executeSQL(`
        SELECT
          id, employee_name, customer_name, activity_date,
          activity_summary, activity_type
        FROM employee_activity_log
        WHERE (customer_name LIKE ${customerList})
          AND (is_blocker = 1 OR activity_type = 'issue_reported')
          AND activity_date >= date('${currentDate}', '-30 days')
        ORDER BY activity_date DESC
        LIMIT 5
      `);
      context.ongoing_issues = issues?.rows || [];

    } catch (error: any) {
      console.error(`   ⚠️  Error querying historical context:`, error.message);
    }
  }

  // Query for employee patterns
  if (entities.employees && entities.employees.length > 0) {
    try {
      const employeeList = entities.employees.map(e => `'${e}'`).join(',');

      const recentWork = await executeSQL(`
        SELECT
          id, employee_name, customer_name, activity_date,
          activity_summary, activity_type
        FROM employee_activity_log
        WHERE employee_name IN (${employeeList})
          AND activity_date >= date('${currentDate}', '-7 days')
          AND activity_date < '${currentDate}'
        ORDER BY activity_date DESC
        LIMIT 10
      `);
      context.recent_discussions = recentWork?.rows || [];

    } catch (error: any) {
      console.error(`   ⚠️  Error querying employee history:`, error.message);
    }
  }

  return context;
}

/**
 * Phase 3: Enhanced extraction with historical context
 */
async function enhancedExtraction(
  thread: Thread,
  date: string,
  chatRoom: string,
  initialActivities: InitialActivity[],
  historicalContext: HistoricalContext
): Promise<EnhancedActivity[]> {

  const threadMessages = thread.messages
    .map(m => `[${m.chat_date}] ${m.user_name}: ${m.message}`)
    .join('\n');

  const tomorrow = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0];

  // Format historical context for AI
  const contextSummary = `
**Historical Context:**

${historicalContext.previous_visits && historicalContext.previous_visits.length > 0 ? `
Previous visits to these customers:
${historicalContext.previous_visits.map(v =>
  `- ${v.employee_name} visited ${v.customer_name} on ${v.activity_date}: ${v.activity_summary}`
).join('\n')}
` : ''}

${historicalContext.planned_activities && historicalContext.planned_activities.length > 0 ? `
Previously planned for today:
${historicalContext.planned_activities.map(p =>
  `- ${p.employee_name} planned to ${p.next_action} with ${p.customer_name}`
).join('\n')}
` : ''}

${historicalContext.ongoing_issues && historicalContext.ongoing_issues.length > 0 ? `
Ongoing issues:
${historicalContext.ongoing_issues.map(i =>
  `- ${i.customer_name}: ${i.activity_summary}`
).join('\n')}
` : ''}

${historicalContext.recent_discussions && historicalContext.recent_discussions.length > 0 ? `
Recent work by these employees:
${historicalContext.recent_discussions.slice(0, 5).map(r =>
  `- ${r.employee_name} on ${r.activity_date}: ${r.activity_summary}`
).join('\n')}
` : ''}
`.trim();

  const prompt = `You are analyzing a Korean sales team KakaoTalk thread with historical context.

${contextSummary}

**Current thread messages:**
${threadMessages}

**Initial extraction results:**
${JSON.stringify(initialActivities, null, 2)}

**Task:** Review the initial extraction and enhance it with historical context knowledge.

For each activity:
1. Check if this was completing a previously planned activity (set is_followup_to to the ID)
2. Add context_notes if historical information is relevant
3. Set requires_followup appropriately based on:
   - Is this a plan for future work? → true
   - Is there an ongoing issue? → true
   - Is this just reporting completed work? → false
4. Improve activity_summary with context if needed
5. Set is_blocker if there's a blocking issue

**CRITICAL: Split multi-customer activities**
- If activity mentions multiple customers, create SEPARATE activities for each
- Example: "삼성디스플레이, 우신엔지어링 방문" → 2 activities

**CRITICAL: Create separate activities for planned work**
- If message says "내일 X 방문 예정", create a planning activity
- Don't just use next_action field

Return enhanced activities as JSON array:
[
  {
    "employee_name": "...",
    "activity_type": "...",
    "activity_summary": "...",
    "customer_name": "...",
    "task_status": "...",
    "requires_followup": true/false,
    "is_followup_to": <id or null>,
    "context_notes": "...",
    "confidence_score": 0.0-1.0,
    ... other fields
  }
]`;

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

    const enhanced = JSON.parse(jsonText);

    // Add metadata
    const activities: EnhancedActivity[] = (enhanced || []).map((a: any) => ({
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

    return activities;

  } catch (error: any) {
    console.error(`   ❌ Enhanced extraction failed:`, error.message);
    // Fallback to initial extraction
    return initialActivities.map((a: any) => ({
      ...a,
      activity_date: date,
      chat_room: chatRoom,
      source_message_ids: JSON.stringify(thread.messageIds),
      extraction_model: 'gemini-2.5-flash',
      activity_details: JSON.stringify({}),
      products_mentioned: JSON.stringify(a.products_mentioned || []),
      requires_followup: 0,
      is_blocker: 0
    }));
  }
}

/**
 * Process a single thread with two-phase extraction
 */
async function processThread(
  thread: Thread,
  date: string,
  chatRoom: string,
  previousContext: string
): Promise<{ activities: EnhancedActivity[], summary: string }> {

  // Phase 1: Initial extraction
  process.stdout.write(`   Phase 1 (entities)... `);
  const { entities, activities: initialActivities } = await initialExtraction(
    thread,
    date,
    previousContext
  );
  console.log(`✅ Found ${entities.customers?.length || 0} customers, ${initialActivities.length} activities`);

  // Phase 2: Query historical context
  process.stdout.write(`   Phase 2 (knowledge)... `);
  const historicalContext = await queryHistoricalContext(entities, date);
  const contextCount =
    (historicalContext.previous_visits?.length || 0) +
    (historicalContext.planned_activities?.length || 0) +
    (historicalContext.ongoing_issues?.length || 0);
  console.log(`✅ Retrieved ${contextCount} historical records`);

  // Phase 3: Enhanced extraction
  process.stdout.write(`   Phase 3 (enhance)... `);
  const enhancedActivities = await enhancedExtraction(
    thread,
    date,
    chatRoom,
    initialActivities,
    historicalContext
  );
  console.log(`✅ ${enhancedActivities.length} final activities`);

  // Generate summary for next thread
  const summary = `Thread summary: ${entities.employees?.join(', ') || 'Team'} discussed ${entities.customers?.join(', ') || 'work'}. ${enhancedActivities.length} activities extracted.`;

  // Rate limit
  await new Promise(resolve => setTimeout(resolve, 2000));

  return { activities: enhancedActivities, summary };
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

async function extractDate(date: string): Promise<{ activities: any[] }> {
  console.log(`\n📅 Processing ${date}...`);

  const messages = await getMessagesForDate(date);
  if (messages.length === 0) {
    console.log(`   ⚠️  No messages found for ${date}`);
    return { activities: [] };
  }

  console.log(`   📨 Found ${messages.length} messages`);

  // Detect threads
  const threads = detectThreads(messages, 30);
  console.log(`   🧵 Detected ${threads.length} conversation threads\n`);

  const allActivities: EnhancedActivity[] = [];
  let conversationContext = '';

  // Process each thread with two-phase extraction
  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const chatRoom = thread.messages[0]?.chat_room || '';

    console.log(`   Thread ${i + 1}/${threads.length} (${thread.messages.length} msgs):`);

    const { activities, summary } = await processThread(
      thread,
      date,
      chatRoom,
      conversationContext
    );

    allActivities.push(...activities);

    // Update context for next thread
    if (summary) {
      conversationContext += (conversationContext ? '\n' : '') + summary;
    }

    console.log();
  }

  console.log(`   📊 Total: ${allActivities.length} activities for ${date}`);

  return { activities: allActivities };
}

async function main() {
  const args = process.argv.slice(2);
  const startDate = args[0];
  const endDate = args[1];

  if (!startDate || !endDate) {
    console.error('❌ Usage: npx tsx scripts/extract-with-knowledge.ts <start-date> <end-date>');
    console.error('   Example: npx tsx scripts/extract-with-knowledge.ts 2024-03-08 2024-03-11');
    process.exit(1);
  }

  console.log(`🚀 Two-Phase Knowledge-Enhanced Extraction: ${startDate} to ${endDate}\n`);

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

  for (const date of dates) {
    const { activities } = await extractDate(date);
    totalActivities.push(...activities);
  }

  console.log(`\n📊 Extraction Complete!`);
  console.log(`   Total activities: ${totalActivities.length}`);
  console.log();

  // Save backup
  const backupFile = `./extraction-knowledge-${startDate}-to-${endDate}.json`;
  console.log(`💾 Saving backup to ${backupFile}...`);

  await fs.writeFile(backupFile, JSON.stringify({
    dateRange: { startDate, endDate },
    extractedAt: new Date().toISOString(),
    method: 'two-phase with knowledge enhancement',
    totalActivities: totalActivities.length,
    activities: totalActivities
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

  console.log('\n✅ All done! Check the dashboard at:');
  console.log('   http://localhost:3000/employees');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
