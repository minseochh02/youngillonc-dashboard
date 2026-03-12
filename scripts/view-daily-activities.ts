/**
 * View extracted daily activities
 *
 * Usage:
 *   npx tsx scripts/view-daily-activities.ts [--date YYYY-MM-DD] [--employee "Name"]
 */

import { EGDESK_CONFIG } from '../egdesk.config';

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

async function viewDailyStandup(date?: string, employeeName?: string) {
  let query = `
    SELECT
      employee_name,
      report_date,
      completed_today,
      planned_tasks,
      blockers,
      availability_status,
      absence_reason,
      notes,
      confidence_score,
      extracted_at
    FROM daily_standup_log
  `;

  const conditions = [];
  if (date) conditions.push(`report_date = '${date}'`);
  if (employeeName) conditions.push(`employee_name = '${employeeName}'`);

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY report_date DESC, employee_name LIMIT 20';

  const result = await callEgdeskAPI('user_data_sql_query', { query });
  return result.rows;
}

async function viewDetailedActivities(date?: string, employeeName?: string) {
  let query = `
    SELECT
      employee_name,
      activity_date,
      activity_type,
      activity_summary,
      activity_details,
      task_status,
      mentioned_employees,
      requires_followup,
      is_blocker,
      confidence_score
    FROM employee_activity_log
  `;

  const conditions = [];
  if (date) conditions.push(`activity_date = '${date}'`);
  if (employeeName) conditions.push(`employee_name = '${employeeName}'`);

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY activity_date DESC, employee_name, id LIMIT 50';

  const result = await callEgdeskAPI('user_data_sql_query', { query });
  return result.rows;
}

function formatStandup(standup: any) {
  console.log('='.repeat(70));
  console.log(`${standup.employee_name} - ${standup.report_date}`);
  console.log('='.repeat(70));

  console.log(`\n📊 Availability: ${standup.availability_status}`);
  if (standup.absence_reason) {
    console.log(`   Reason: ${standup.absence_reason}`);
  }

  if (standup.completed_today && standup.completed_today.length > 0) {
    console.log('\n✅ Completed Today:');
    standup.completed_today.forEach((task: any, i: number) => {
      console.log(`   ${i + 1}. ${task.task}`);
      if (task.time_spent) console.log(`      ⏱️  ${task.time_spent} hours`);
      if (task.details) console.log(`      📝 ${JSON.stringify(task.details)}`);
    });
  }

  if (standup.planned_tasks && standup.planned_tasks.length > 0) {
    console.log('\n📋 Planned Tasks:');
    standup.planned_tasks.forEach((task: any, i: number) => {
      console.log(`   ${i + 1}. ${task.task}`);
      if (task.deadline) console.log(`      📅 Deadline: ${task.deadline}`);
      if (task.priority) console.log(`      ⚡ Priority: ${task.priority}`);
    });
  }

  if (standup.blockers && standup.blockers.length > 0) {
    console.log('\n🚧 Blockers:');
    standup.blockers.forEach((blocker: any, i: number) => {
      console.log(`   ${i + 1}. ${blocker.issue}`);
      if (blocker.needs_help_from) console.log(`      👥 Needs help from: ${blocker.needs_help_from}`);
      if (blocker.severity) console.log(`      ⚠️  Severity: ${blocker.severity}`);
    });
  }

  if (standup.notes) {
    console.log(`\n📌 Notes: ${standup.notes}`);
  }

  console.log(`\n🤖 Confidence: ${(standup.confidence_score * 100).toFixed(0)}%`);
  console.log(`📅 Extracted: ${standup.extracted_at}`);
  console.log();
}

function formatActivity(activity: any) {
  const icon = {
    task_completed: '✅',
    task_planned: '📋',
    meeting_attendance: '👥',
    issue_reported: '🐛',
    update_shared: '📢',
    question_asked: '❓',
    other: '📝'
  }[activity.activity_type] || '•';

  console.log(`${icon} ${activity.activity_summary}`);
  console.log(`   Type: ${activity.activity_type} | Status: ${activity.task_status || 'N/A'}`);
  if (activity.mentioned_employees?.length > 0) {
    console.log(`   Mentioned: ${activity.mentioned_employees.join(', ')}`);
  }
  if (activity.requires_followup) console.log('   ⚠️  Requires followup');
  if (activity.is_blocker) console.log('   🚧 BLOCKER');
  console.log(`   Confidence: ${(activity.confidence_score * 100).toFixed(0)}%`);
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  const date = args.find(arg => arg.startsWith('--date='))?.split('=')[1];
  const employee = args.find(arg => arg.startsWith('--employee='))?.split('=')[1];
  const showDetails = args.includes('--detailed');

  console.log('\n📊 Daily Activity Viewer\n');

  if (showDetails) {
    console.log('Detailed Activities View\n');
    const activities = await viewDetailedActivities(date, employee);

    if (activities.length === 0) {
      console.log('No activities found');
      return;
    }

    let currentEmployee = '';
    let currentDate = '';

    activities.forEach((activity: any) => {
      if (activity.employee_name !== currentEmployee || activity.activity_date !== currentDate) {
        console.log('='.repeat(70));
        console.log(`${activity.employee_name} - ${activity.activity_date}`);
        console.log('='.repeat(70));
        console.log();
        currentEmployee = activity.employee_name;
        currentDate = activity.activity_date;
      }

      formatActivity(activity);
    });
  } else {
    console.log('Daily Standup View\n');
    const standups = await viewDailyStandup(date, employee);

    if (standups.length === 0) {
      console.log('No standup data found');
      console.log('\nTry running: npx tsx scripts/extract-daily-activities.ts');
      return;
    }

    standups.forEach(formatStandup);
  }
}

main().catch(console.error);
