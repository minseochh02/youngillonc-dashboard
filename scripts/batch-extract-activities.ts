/**
 * Batch extraction of employee activities from KakaoTalk messages using Gemini 3 Flash
 *
 * This script processes all unprocessed messages and extracts structured activity data.
 *
 * Usage:
 *   npx tsx scripts/batch-extract-activities.ts [--limit 100] [--mock]
 */

import { EGDESK_CONFIG } from '../egdesk.config';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ExtractionStats {
  processed: number;
  activities_extracted: number;
  errors: number;
  skipped: number;
}

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

function buildExtractionPrompt(message: any): string {
  return `
카카오톡 메시지에서 직원 활동 정보를 추출하세요.

메시지 정보:
- 사용자: ${message.user_name}
- 날짜: ${message.chat_date}
- 내용: ${message.message}

다음 구조의 JSON 객체를 반환하세요:
{
  "activities": [
    {
      "employee_name": "직원 이름",
      "activity_date": "YYYY-MM-DD",
      "activity_type": "task_completed|task_planned|meeting_attendance|issue_reported|update_shared|question_asked|other",
      "activity_summary": "간단한 요약 (한국어)",
      "activity_details": {
        // 활동 유형에 따른 유연한 구조
      },
      "task_status": "completed|in_progress|planned|blocked|null",
      "task_priority": "high|medium|low|null",
      "time_spent_hours": 숫자 또는 null,
      "planned_completion_date": "YYYY-MM-DD 또는 null",
      "related_project": "문자열 또는 null",
      "mentioned_employees": ["이름1", "이름2"],
      "requires_followup": boolean,
      "is_blocker": boolean,
      "sentiment": "positive|neutral|negative|urgent|null",
      "confidence_score": 0.00~1.00
    }
  ]
}

규칙:
1. 업무 관련 정보가 있을 때만 추출
2. 메시지의 명확성에 따라 confidence_score 설정
3. 회의 참석: activity_type = "meeting_attendance"
4. 상태 업데이트: activity_type = "update_shared"
5. 불참 알림: activity_type = "meeting_attendance"이며 details에 불참 사유 포함
6. 단순 인사/사교적 메시지는 빈 activities 배열 반환
7. 메시지에서 언급된 모든 직원 이름 추출

유효한 JSON만 반환하고, 추가 텍스트는 포함하지 마세요.
`.trim();
}

async function extractWithGemini(message: any): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
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

  const prompt = buildExtractionPrompt(message);
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  const parsed = JSON.parse(text);
  return parsed.activities || [];
}

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
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  const useMock = args.includes('--mock');

  console.log('='.repeat(60));
  console.log('Batch Activity Extraction with Gemini 3 Flash Preview');
  console.log('='.repeat(60));
  console.log();

  if (useMock || !process.env.GEMINI_API_KEY) {
    console.log('⚠️  Running in MOCK mode (no actual API calls)');
    console.log('To use real Gemini API:');
    console.log('  1. Get API key from https://aistudio.google.com/app/apikey');
    console.log('  2. export GEMINI_API_KEY=your_api_key');
    console.log('  3. npm install @google/generative-ai');
    console.log();
    return;
  }

  const stats: ExtractionStats = {
    processed: 0,
    activities_extracted: 0,
    errors: 0,
    skipped: 0,
  };

  console.log(`Fetching up to ${limit} unprocessed messages...\n`);

  const query = `
    SELECT k.*
    FROM kakaotalk_egdesk_pm k
    LEFT JOIN employee_activity_log e ON k.id = e.source_message_id
    WHERE e.id IS NULL
    ORDER BY k.chat_date DESC
    LIMIT ${limit}
  `;

  const result = await callEgdeskAPI('user_data_sql_query', { query });
  const messages = result.rows;

  console.log(`Found ${messages.length} unprocessed messages\n`);

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const progress = `[${i + 1}/${messages.length}]`;

    console.log(`${progress} Processing message ${message.id} from ${message.user_name}`);
    console.log(`  Date: ${message.chat_date}`);
    console.log(`  Content: ${message.message.substring(0, 80)}...`);

    try {
      const activities = await extractWithGemini(message);

      if (activities.length > 0) {
        await insertActivities(activities, message.id);
        stats.activities_extracted += activities.length;
        console.log(`  ✓ Extracted ${activities.length} activities`);
      } else {
        stats.skipped++;
        console.log(`  ⊘ No activities (social/non-work message)`);
      }

      stats.processed++;
    } catch (error) {
      stats.errors++;
      console.error(`  ✗ Error: ${error}`);
    }

    console.log();

    // Rate limiting: Gemini has generous limits, but still be respectful
    if ((i + 1) % 20 === 0 && i + 1 < messages.length) {
      console.log('⏳ Rate limiting: waiting 10 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  console.log('='.repeat(60));
  console.log('Extraction Complete');
  console.log('='.repeat(60));
  console.log(`Messages processed: ${stats.processed}`);
  console.log(`Activities extracted: ${stats.activities_extracted}`);
  console.log(`Messages skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log();
}

main().catch(console.error);
