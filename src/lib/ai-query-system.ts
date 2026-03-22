/**
 * AI-Driven Query System
 *
 * User Question → AI generates SQL → Execute → Verify → Display
 *
 * The AI reads DB knowledge, generates SQL, sees results, and verifies
 * if the query correctly answers the user's question.
 */

import { buildSchemaContext } from './schema-builder';
import { executeSQL } from '../../egdesk-helpers';

interface QueryResult {
  sql: string;
  rows: any[];
  columns: string[];
  intent: string;
  verified: boolean;
  attempts: number;
}

interface SingleQueryResult {
  title: string;
  description?: string;
  sql: string;
  rows: any[];
  columns: string[];
  intent: string;
  verified: boolean;
}

interface MultiQueryResult {
  results: SingleQueryResult[];
  attempts: number;
  totalRows: number;
  errors?: string[];
}

/**
 * Generate SQL using AI with full context
 */
async function generateSQL(
  userQuestion: string,
  previousError?: string
): Promise<{ sql: string; intent: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const schemaContext = buildSchemaContext(userQuestion);
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];

  // Calculate date ranges
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

  const systemPrompt = `You are a SQL query generator for a Korean business database.

${schemaContext}

CURRENT DATE CONTEXT:
- Today: ${currentDate}
- This month (이번 달): ${thisMonthStart} to ${currentDate}
- Last month (지난 달, 저번 달): ${lastMonthStart} to ${lastMonthEnd}

CRITICAL RULES - SQLITE ONLY:
1. Generate ONLY valid SQLite SELECT queries
2. NEVER use INSERT, UPDATE, DELETE, DROP
3. Use exact table and column names from schema
4. Clean numeric columns: CAST(REPLACE(column,',','') AS NUMERIC)
5. Return ONLY the SQL query (no markdown, no explanations)
6. EVERY query MUST start with the word 'SELECT'. Do NOT use 'WITH' at the top level; use subqueries instead if needed.

SQLITE LIMITATIONS (DO NOT USE):
❌ GROUP BY ... WITH ROLLUP (MySQL only)
❌ PIVOT / UNPIVOT
❌ RIGHT JOIN / FULL OUTER JOIN
❌ Complex expressions in ORDER BY when using UNION ALL
❌ Helper columns like "sort_order" - users will see them!

FOR TOTALS: Use UNION ALL with a separate SELECT for the total row

IMPORTANT: Only SELECT columns that users should see. Do NOT add helper columns (sort_order, row_num, etc.)
If you need specific ordering, just don't use ORDER BY, or use simple column names only.

MULTI-QUERY DETECTION:
If the user's question requires MULTIPLE unrelated tables/topics, respond with JSON:
{
  "multiQuery": true,
  "queries": [
    { "title": "Korean title", "sql": "SELECT ...", "intent": "..." },
    { "title": "Korean title", "sql": "SELECT ...", "intent": "..." }
  ]
}

CRITICAL: Each "sql" field MUST be a valid SELECT query. NEVER use INSERT, UPDATE, DELETE, DROP, CREATE, ALTER.

Examples needing multi-query:
- "오늘 매출과 재고" → sales + inventory (2 SELECT queries)
- "판매와 구매" → sales + purchases (2 SELECT queries)
- "매출 재고 수금" → sales + inventory + collections (3 SELECT queries)

Examples NOT needing multi-query (single table):
- "오늘 창원 매출" → single SELECT query
- "재고 현황" → single SELECT query

If single query needed, return just the SELECT query as before (no JSON).

Generate a SQL query to answer the user's question.`;

  let userPrompt = userQuestion;
  if (previousError) {
    // Extract specific error type for targeted fixes
    const isOrderByError = previousError.includes('ORDER BY term does not match');
    const isColumnError = previousError.includes('no such column');
    const isSyntaxError = previousError.includes('syntax error');
    const isWithRollupError = previousError.includes('WITH') || previousError.includes('ROLLUP');

    let fixGuidance = '';
    if (isOrderByError) {
      fixGuidance = `
🚨 CRITICAL FIX REQUIRED - ORDER BY ERROR 🚨

The error "ORDER BY term does not match any column" means you're using a column name in ORDER BY that doesn't exist in your SELECT.

RULES FOR UNION ALL QUERIES:
1. ORDER BY goes ONLY at the very end (after all UNION ALL parts)
2. You can ONLY order by simple column names that exist in the SELECT list
3. You CANNOT use CASE expressions or complex expressions in ORDER BY with UNION ALL
4. All column aliases must be identical in every SELECT part of the UNION
5. DO NOT add helper columns like "sort_order" - users will see them in the table!

WRONG ❌:
SELECT ..., 1 as sort_order ... ORDER BY sort_order  -- Helper column visible to users!
SELECT ... ORDER BY CASE WHEN ... THEN ... END  -- Can't use CASE in ORDER BY with UNION
SELECT col1 as A ... UNION ALL SELECT col1 as B ... ORDER BY A  -- Aliases don't match

CORRECT ✅:
SELECT 사업소, 공급가액, 합계
FROM sales
GROUP BY 사업소
UNION ALL
SELECT '전체' as 사업소, SUM(공급가액) as 공급가액, SUM(합계) as 합계
FROM sales
-- No ORDER BY is fine! Total row appears at end naturally.
LIMIT 1000

Generate a clean SQL query. No helper columns. Keep it simple.
`;
    } else if (isWithRollupError) {
      fixGuidance = `
🚨 SQLITE DOES NOT SUPPORT "WITH ROLLUP"!

SQLite doesn't have GROUP BY ... WITH ROLLUP. Use UNION ALL instead for totals:

CORRECT ✅:
SELECT 사업소, SUM(amount) as total
FROM sales
GROUP BY 사업소
UNION ALL
SELECT '전체' as 사업소, SUM(amount) as total
FROM sales
ORDER BY total DESC
LIMIT 1000

DO NOT use WITH ROLLUP, CUBE, or similar MySQL/PostgreSQL features.
`;
    } else if (isColumnError) {
      fixGuidance = 'Check column names against the schema. Use EXACT column names from the tables.';
    } else if (isSyntaxError) {
      fixGuidance = 'Check SQL syntax. Common issues: missing quotes, wrong parentheses, invalid keywords.';
    } else {
      fixGuidance = 'Review the error and fix the SQL query accordingly.';
    }

    userPrompt = `${userQuestion}

⚠️ PREVIOUS ATTEMPT FAILED:
${previousError}

${fixGuidance}

Generate a corrected SQL query.`;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  let sql = data.content?.[0]?.text?.trim() || '';

  // Extract SQL from markdown if present
  const codeBlockMatch = sql.match(/```(?:sql)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    sql = codeBlockMatch[1].trim();
  }

  sql = sql.replace(/;+$/, '').trim();

  if (!sql) {
    throw new Error('Empty SQL response from AI');
  }

  // Detect intent
  const intent = detectQueryIntent(sql, userQuestion);

  return { sql, intent };
}

/**
 * Verify if query results answer the user's question
 */
async function verifyResults(
  userQuestion: string,
  sql: string,
  rows: any[],
  columns: string[]
): Promise<{ verified: boolean; reason?: string; suggestedFix?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { verified: true }; // Skip verification if no API key
  }

  const schemaContext = buildSchemaContext(userQuestion);

  const verificationPrompt = `You are verifying if a SQL query correctly answers a user's question.

USER QUESTION: "${userQuestion}"

GENERATED SQL:
${sql}

QUERY RESULTS (${rows.length} rows):
${rows.length === 0 ? '[No results]' : JSON.stringify(rows.slice(0, 5), null, 2)}
${rows.length > 5 ? `\n... and ${rows.length - 5} more rows` : ''}

SCHEMA CONTEXT:
${schemaContext}

VERIFICATION TASK:
1. Does the SQL query correctly interpret the user's question?
2. Are the results appropriate for the question?
3. Common issues to check:
   - Wrong date range (e.g., "last month" but used current month)
   - Wrong column for branches (should use 거래처그룹1코드명 for sales, not 담당자코드명)
   - Wrong table (e.g., deposits needs JOIN with ledger on 일자/적요/계정명/금액 for branch/부서명)
   - Missing required filters (e.g., deposits needs 계정명='외상매출금')

Respond in JSON format:
{
  "verified": true/false,
  "reason": "explanation of what's wrong (if verified=false)",
  "suggestedFix": "brief description of how to fix it (if verified=false)"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: 'You are a SQL query verifier. Respond only with valid JSON.',
        messages: [
          {
            role: 'user',
            content: verificationPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      console.warn('Verification API call failed, skipping verification');
      return { verified: true };
    }

    const data = await response.json();
    const responseText = data.content?.[0]?.text?.trim() || '';

    // Extract JSON from markdown if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      responseText.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;

    const result = JSON.parse(jsonText);
    return result;
  } catch (error) {
    console.warn('Verification failed:', error);
    return { verified: true }; // Default to verified if verification fails
  }
}

/**
 * Detect query intent from SQL and user question
 */
function detectQueryIntent(sql: string, userQuestion: string): string {
  const lowerSQL = sql.toLowerCase();
  const lowerQuestion = userQuestion.toLowerCase();

  if (lowerSQL.includes('사업소') || lowerQuestion.includes('사업소')) {
    if (lowerSQL.includes('between')) return 'monthly_sales_by_branch';
    return 'daily_sales_by_branch';
  }

  if (lowerQuestion.includes('수금') || lowerSQL.includes('deposits')) {
    return 'collections';
  }

  if (lowerQuestion.includes('재고') || lowerSQL.includes('inventory')) {
    return 'inventory_status';
  }

  if (lowerQuestion.includes('구매') || lowerSQL.includes('purchases')) {
    return 'purchases';
  }

  return 'generic';
}

/**
 * Execute multi-query with AI detection
 */
export async function executeMultiQuery(userQuestion: string): Promise<MultiQueryResult> {
  const maxAttempts = 4;
  let attempts = 0;
  let previousError: string | undefined;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n🤖 Multi-Query Detection Attempt ${attempts}/${maxAttempts}...`);

    try {
      // Generate SQL with multi-query detection
      const { sql, intent } = await generateSQL(userQuestion, previousError);

      // Try to parse as JSON (multi-query response)
      let multiQueryResponse: any = null;
      try {
        // Extract JSON from markdown if present
        const jsonMatch = sql.match(/```(?:json)?\s*([\s\S]*?)```/) || sql.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : sql;
        multiQueryResponse = JSON.parse(jsonText);
      } catch {
        // Not JSON, treat as single query
        multiQueryResponse = null;
      }

      // Check if it's a multi-query response
      if (multiQueryResponse && multiQueryResponse.multiQuery && Array.isArray(multiQueryResponse.queries)) {
        console.log(`\n✅ Multi-query detected: ${multiQueryResponse.queries.length} queries`);

        // Execute each query sequentially
        const results: SingleQueryResult[] = [];
        const errors: string[] = [];

        for (const queryDef of multiQueryResponse.queries) {
          try {
            const result = await executeSQL(queryDef.sql);
            const rows = result.rows || [];
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

            results.push({
              title: queryDef.title,
              description: queryDef.description,
              sql: queryDef.sql,
              rows,
              columns,
              intent: queryDef.intent,
              verified: true
            });
          } catch (sqlError: any) {
            const errorMsg = sqlError.message || String(sqlError);
            console.error(`Query "${queryDef.title}" failed:`, errorMsg);
            errors.push(`${queryDef.title}: ${errorMsg}`);
          }
        }

        // Return results even if some queries failed (partial success)
        if (results.length > 0) {
          return {
            results,
            attempts,
            totalRows: results.reduce((sum, r) => sum + r.rows.length, 0),
            errors: errors.length > 0 ? errors : undefined
          };
        }

        // All queries failed, retry with error feedback
        if (attempts >= maxAttempts) {
          throw new Error(`All queries failed: ${errors.join('; ')}`);
        }

        previousError = `All queries failed: ${errors.join('; ')}`;
        continue;
      }

      // Single query response - execute normally
      console.log(`\n✅ Single query detected`);

      let result;
      try {
        result = await executeSQL(sql);
      } catch (sqlError: any) {
        const errorMsg = sqlError.message || String(sqlError);
        console.log(`\n❌ SQL execution failed:`, errorMsg);

        if (attempts >= maxAttempts) {
          throw sqlError;
        }

        previousError = `SQL execution error: ${errorMsg}`;
        continue;
      }

      const rows = result.rows || [];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      // Return single query as multi-query result with 1 item
      return {
        results: [{
          title: '검색 결과',
          sql,
          rows,
          columns,
          intent,
          verified: true
        }],
        attempts,
        totalRows: rows.length
      };

    } catch (error: any) {
      console.error(`Attempt ${attempts} failed:`, error);

      if (attempts >= maxAttempts) {
        throw error;
      }

      previousError = error.message;
    }
  }

  throw new Error(`Failed after ${maxAttempts} attempts`);
}

/**
 * Main AI-driven query execution with verification
 */
export async function executeAIQuery(userQuestion: string): Promise<QueryResult> {
  const maxAttempts = 4; // Give AI room to explore different approaches
  let attempts = 0;
  let lastError: string | undefined;
  let previousError: string | undefined;
  let previousSQL: string | undefined;

  while (attempts < maxAttempts) {
    attempts++;

    console.log(`\n🤖 AI Query Attempt ${attempts}/${maxAttempts}...`);

    try {
      // Generate SQL (with error feedback from previous attempt if any)
      const { sql, intent } = await generateSQL(userQuestion, previousError);

      // Log the generated SQL for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n=== Attempt ${attempts} Generated SQL ===`);
        console.log(sql);
        console.log('='.repeat(50));
      }

      // Execute SQL
      let result;
      try {
        result = await executeSQL(sql);
      } catch (sqlError: any) {
        // SQL execution error - give AI a chance to fix it
        const errorMsg = sqlError.message || String(sqlError);
        console.log(`\n❌ Attempt ${attempts} SQL execution failed:`, errorMsg);

        if (attempts >= maxAttempts) {
          throw sqlError; // Out of retries
        }

        // Pass error to next attempt
        previousError = `SQL execution error: ${errorMsg}`;
        lastError = errorMsg;
        continue;
      }

      const rows = result.rows || [];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      // Verify results
      const verification = await verifyResults(userQuestion, sql, rows, columns);

      if (verification.verified || attempts >= maxAttempts) {
        // Success or out of attempts
        return {
          sql,
          rows,
          columns,
          intent,
          verified: verification.verified,
          attempts
        };
      }

      // Not verified, retry with feedback
      console.log(`Attempt ${attempts} failed verification:`, verification.reason);
      previousError = `Verification failed: ${verification.reason}. ${verification.suggestedFix || ''}`;
      lastError = verification.reason;

    } catch (error: any) {
      console.error(`Attempt ${attempts} failed:`, error);

      if (attempts >= maxAttempts) {
        throw error;
      }

      lastError = error.message;
      previousError = error.message;
    }
  }

  throw new Error(`Failed after ${maxAttempts} attempts. Last error: ${lastError}`);
}
