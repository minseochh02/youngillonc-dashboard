#!/usr/bin/env tsx
/**
 * State-Based Extraction with employee_knowledge
 *
 * AI maintains persistent state about each employee's work patterns
 * for context-aware extraction without embeddings.
 *
 * Usage:
 *   npx tsx scripts/extract-with-state.ts 2024-03-08 2024-03-11
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

interface EmployeeKnowledge {
  employee_name: string;
  open_tasks: any[];
  recent_visits: any[];
  ongoing_issues: any[];
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
  is_followup_to?: number;
  context_notes?: string;
  is_repeat_visit?: boolean;
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
 * Get employee knowledge from database
 */
async function getEmployeeKnowledge(employeeName: string): Promise<EmployeeKnowledge | null> {
  try {
    const result = await executeSQL(`
      SELECT
        employee_name,
        open_tasks,
        recent_visits,
        ongoing_issues
      FROM employee_knowledge
      WHERE employee_name = '${employeeName}'
    `);

    if (!result?.rows || result.rows.length === 0) {
      return null;  // First time seeing this employee
    }

    const row = result.rows[0];
    return {
      employee_name: row.employee_name,
      open_tasks: JSON.parse(row.open_tasks || '[]'),
      recent_visits: JSON.parse(row.recent_visits || '[]'),
      ongoing_issues: JSON.parse(row.ongoing_issues || '[]')
    };

  } catch (error: any) {
    console.error(`   ⚠️  Error fetching knowledge for ${employeeName}:`, error.message);
    return null;
  }
}

/**
 * Update employee knowledge in database
 */
async function updateEmployeeKnowledge(
  employeeName: string,
  knowledge: {
    open_tasks: any[],
    recent_visits: any[],
    ongoing_issues: any[]
  },
  activityDate: string
): Promise<void> {
  try {
    await insertRows('employee_knowledge', [{
      employee_name: employeeName,
      open_tasks: JSON.stringify(knowledge.open_tasks),
      recent_visits: JSON.stringify(knowledge.recent_visits),
      ongoing_issues: JSON.stringify(knowledge.ongoing_issues),
      last_updated: new Date().toISOString(),
      last_activity_date: activityDate
    }]);
  } catch (error: any) {
    console.error(`   ⚠️  Error updating knowledge for ${employeeName}:`, error.message);
  }
}

/**
 * Extract activities from a thread with employee knowledge context
 */
async function extractWithState(
  thread: Thread,
  date: string,
  chatRoom: string,
  employeeKnowledgeMap: Map<string, EmployeeKnowledge>
): Promise<{ activities: ExtractedActivity[], updatedKnowledge: Map<string, any> }> {

  const threadMessages = thread.messages
    .map(m => `[${m.chat_date}] ${m.user_name}: ${m.message}`)
    .join('\n');

  const tomorrow = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0];

  // Build employee knowledge context for AI
  const employeeContexts: string[] = [];
  for (const [employeeName, knowledge] of employeeKnowledgeMap.entries()) {
    const contextParts = [];

    if (knowledge.open_tasks.length > 0) {
      contextParts.push(`Open tasks: ${knowledge.open_tasks.map((t: any) =>
        `${t.task} (planned for ${t.planned_date})`
      ).join(', ')}`);
    }

    if (knowledge.recent_visits.length > 0) {
      contextParts.push(`Recent visits: ${knowledge.recent_visits.slice(0, 5).map((v: any) =>
        `${v.customer} on ${v.date}`
      ).join(', ')}`);
    }

    if (knowledge.ongoing_issues.length > 0) {
      contextParts.push(`Ongoing issues: ${knowledge.ongoing_issues.map((i: any) =>
        `${i.customer} - ${i.issue}`
      ).join(', ')}`);
    }

    if (contextParts.length > 0) {
      employeeContexts.push(`**${employeeName}**: ${contextParts.join(' | ')}`);
    }
  }

  const knowledgeContext = employeeContexts.length > 0
    ? `\n**Employee Knowledge (from database):**\n${employeeContexts.join('\n')}\n`
    : '';

  const prompt = `You are analyzing a Korean sales team KakaoTalk group chat thread.

${knowledgeContext}

**Current thread (${thread.messages.length} messages):**
${threadMessages}

**Context:** Industrial lubricant sales team (Mobil products).
**Date:** ${date}

**CRITICAL INSTRUCTIONS:**

1. **Split multi-customer activities**: If someone visits multiple customers in one message, create SEPARATE activities for each
   - Example: "삼성디스플레이, 우신엔지어링 방문" → 2 activities

2. **Create separate planning activities**: If someone mentions future plans, create a planning activity
   - Example: "내일 한국지엠 방문 예정" → separate activity with activity_type: "planning"

3. **Use employee knowledge**:
   - Check if today's visit matches a recent_visit → set is_repeat_visit: true
   - Check if today's work completes an open_task → set is_followup_to to the activity_id, mark task as completed
   - Check if there are ongoing_issues with mentioned customers → add context

4. **Ignore noise**: Skip simple checkout messages with no work content

**Task:** Extract activities and update employee knowledge.

Return ONLY valid JSON:
{
  "activities": [
    {
      "employee_name": "...",
      "activity_type": "customer_visit" | "planning" | "issue_reported" | "work_completed" | "sales_activity" | "other",
      "activity_summary": "Brief Korean description",
      "customer_name": "SINGLE customer (not comma-separated)",
      "location": "...",
      "products_mentioned": ["..."],
      "task_status": "completed" | "planned" | "in_progress",
      "next_action": "...",
      "next_action_date": "YYYY-MM-DD (if 내일 = ${tomorrow})",
      "requires_followup": true/false,
      "is_blocker": true/false,
      "sentiment": "positive" | "neutral" | "negative" | "urgent",
      "confidence_score": 0.0-1.0,
      "is_followup_to": <activity_id or null>,
      "context_notes": "Explain historical context from employee knowledge",
      "is_repeat_visit": true/false
    }
  ],
  "knowledge_updates": {
    "employee_name": {
      "open_tasks": [
        {"task": "...", "customer": "...", "planned_date": "YYYY-MM-DD", "created_date": "${date}"}
      ],
      "recent_visits": [
        {"customer": "...", "date": "${date}", "activity_id": null}
      ],
      "ongoing_issues": [
        {"issue": "...", "customer": "...", "reported_date": "${date}", "activity_id": null}
      ]
    }
  }
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
      is_blocker: a.is_blocker ? 1 : 0,
      is_repeat_visit: a.is_repeat_visit ? 1 : 0
    }));

    return {
      activities,
      updatedKnowledge: new Map(Object.entries(parsed.knowledge_updates || {}))
    };

  } catch (error: any) {
    console.error(`   ❌ Extraction failed:`, error.message);
    return { activities: [], updatedKnowledge: new Map() };
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

  const allActivities: ExtractedActivity[] = [];
  const globalKnowledgeMap = new Map<string, EmployeeKnowledge>();

  // Process each thread
  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const chatRoom = thread.messages[0]?.chat_room || '';

    console.log(`   Thread ${i + 1}/${threads.length} (${thread.messages.length} msgs):`);

    // Get unique employee names from this thread
    const employeeNames = [...new Set(thread.messages.map(m => m.user_name))];

    // Load employee knowledge for all employees in this thread
    process.stdout.write(`      Loading knowledge for ${employeeNames.length} employees... `);
    for (const name of employeeNames) {
      if (!globalKnowledgeMap.has(name)) {
        const knowledge = await getEmployeeKnowledge(name);
        if (knowledge) {
          globalKnowledgeMap.set(name, knowledge);
        } else {
          // Initialize empty knowledge for new employee
          globalKnowledgeMap.set(name, {
            employee_name: name,
            open_tasks: [],
            recent_visits: [],
            ongoing_issues: []
          });
        }
      }
    }
    console.log(`✅`);

    // Extract with state
    process.stdout.write(`      Extracting activities... `);
    const { activities, updatedKnowledge } = await extractWithState(
      thread,
      date,
      chatRoom,
      globalKnowledgeMap
    );
    console.log(`✅ ${activities.length} activities`);

    allActivities.push(...activities);

    // Update global knowledge map with AI's updates
    for (const [employeeName, knowledgeUpdate] of updatedKnowledge.entries()) {
      globalKnowledgeMap.set(employeeName, {
        employee_name: employeeName,
        ...knowledgeUpdate
      });
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log();
  }

  // Save updated knowledge to database
  console.log(`   💾 Updating employee knowledge...`);
  for (const [employeeName, knowledge] of globalKnowledgeMap.entries()) {
    await updateEmployeeKnowledge(employeeName, knowledge, date);
  }
  console.log(`   ✅ Updated knowledge for ${globalKnowledgeMap.size} employees`);

  console.log(`   📊 Total: ${allActivities.length} activities for ${date}`);

  return { activities: allActivities };
}

async function main() {
  const args = process.argv.slice(2);
  const startDate = args[0];
  const endDate = args[1];

  if (!startDate || !endDate) {
    console.error('❌ Usage: npx tsx scripts/extract-with-state.ts <start-date> <end-date>');
    console.error('   Example: npx tsx scripts/extract-with-state.ts 2024-03-08 2024-03-11');
    process.exit(1);
  }

  console.log(`🚀 State-Based Extraction: ${startDate} to ${endDate}\n`);

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
  const backupFile = `./extraction-state-${startDate}-to-${endDate}.json`;
  console.log(`💾 Saving backup to ${backupFile}...`);

  await fs.writeFile(backupFile, JSON.stringify({
    dateRange: { startDate, endDate },
    extractedAt: new Date().toISOString(),
    method: 'state-based with employee_knowledge',
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
