/**
 * Natural Language Query API Route
 *
 * AI-driven query system: User Question → AI → SQL → Execute → Verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeAIQuery, executeMultiQuery } from '@/lib/ai-query-system';
import { validateSQL, sanitizeSQL } from '@/lib/sql-validator';
import { checkRateLimit, checkRateLimitMultiple, getRateLimitIdentifier, formatResetTime } from '@/lib/rate-limiter';
import { executeSQL } from '../../../../../egdesk-helpers';
import { generateSQLFromTemplate } from '@/lib/query-templates';

/**
 * Determine component hint based on intent
 */
function determineComponentHint(intent: string): string {
  if (intent === 'daily_sales_by_branch' || intent === 'monthly_sales_by_branch') {
    return 'SalesTable';
  }
  return 'GenericResultTable';
}

/**
 * Format multi-query response
 */
function formatMultiQueryResponse(
  results: Array<{
    title: string;
    description?: string;
    rows: any[];
    columns: string[];
    sql: string;
    intent: string;
  }>,
  metadata: {
    executionTime: number;
    method: 'template' | 'ai';
    remaining: number;
    attempts?: number;
    verified?: boolean;
    errors?: string[];
  }
) {
  return NextResponse.json({
    success: true,
    data: {
      results: results.map(r => ({
        title: r.title,
        description: r.description,
        rows: r.rows,
        columns: r.columns,
        sql: r.sql,
        intent: r.intent,
        componentHint: determineComponentHint(r.intent)
      }))
    },
    metadata: {
      executionTime: metadata.executionTime,
      totalRowCount: results.reduce((sum, r) => sum + r.rows.length, 0),
      queries: results.length,
      method: metadata.method,
      remaining: metadata.remaining,
      ...(metadata.attempts && { attempts: metadata.attempts }),
      ...(metadata.verified !== undefined && { verified: metadata.verified }),
      ...(metadata.errors && { errors: metadata.errors })
    }
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Check rate limit
    const rateLimitId = getRateLimitIdentifier(request);
    const rateLimit = checkRateLimit(rateLimitId);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `너무 많은 요청입니다. ${formatResetTime(rateLimit.resetTime)} 후 다시 시도해주세요.`
        },
        { status: 429 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { query, context, sql: preGeneratedSQL, intent: preGeneratedIntent } = body;

    // If SQL is provided, skip AI and execute directly (for starred queries)
    if (preGeneratedSQL && preGeneratedIntent) {
      // Validate and sanitize the SQL
      const sanitized = sanitizeSQL(preGeneratedSQL);
      const validation = validateSQL(sanitized);

      if (!validation.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: '저장된 쿼리가 안전하지 않습니다.'
          },
          { status: 400 }
        );
      }

      // Execute the SQL directly (no AI needed)
      let rows;
      try {
        const result = await executeSQL(sanitized);
        // The result might be wrapped in an object
        rows = Array.isArray(result) ? result : (result?.rows || result?.data || []);
      } catch (sqlError: any) {
        console.error('SQL execution error:', sqlError);
        return NextResponse.json(
          {
            success: false,
            error: 'SQL 실행 중 오류가 발생했습니다.'
          },
          { status: 400 }
        );
      }

      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      // Determine component hint
      let componentHint = 'GenericResultTable';
      if (preGeneratedIntent === 'daily_sales_by_branch' ||
          preGeneratedIntent === 'monthly_sales_by_branch') {
        componentHint = 'SalesTable';
      }

      const executionTime = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        data: {
          rows,
          columns,
          sql: preGeneratedSQL,
          intent: preGeneratedIntent,
          componentHint
        },
        metadata: {
          executionTime,
          rowCount: rows.length,
          method: 'template',
          remaining: rateLimit.remaining
        }
      });
    }

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '쿼리를 입력해주세요.'
        },
        { status: 400 }
      );
    }

    const userQuery = query.trim();

    if (userQuery.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '쿼리를 입력해주세요.'
        },
        { status: 400 }
      );
    }

    if (userQuery.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error: '쿼리가 너무 깁니다. 500자 이하로 입력해주세요.'
        },
        { status: 400 }
      );
    }

    // 3. Try template system first
    const templateResult = generateSQLFromTemplate(userQuery);

    if (templateResult) {
      console.log(`\n✅ Template matched: ${templateResult.results.length} queries`);

      // Check rate limit for multiple queries
      const queryCount = templateResult.results.length;
      const multiRateLimit = checkRateLimitMultiple(rateLimitId, queryCount);

      if (!multiRateLimit.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `너무 많은 요청입니다. ${formatResetTime(multiRateLimit.resetTime)} 후 다시 시도해주세요.`
          },
          { status: 429 }
        );
      }

      // Execute all template queries
      const results = [];
      const errors: string[] = [];

      for (const templateQuery of templateResult.results) {
        try {
          const sanitized = sanitizeSQL(templateQuery.sql);
          const validation = validateSQL(sanitized);

          if (!validation.isValid) {
            errors.push(`${templateQuery.title}: 생성된 쿼리가 안전하지 않습니다.`);
            continue;
          }

          const result = await executeSQL(sanitized);
          const rows = Array.isArray(result) ? result : (result?.rows || result?.data || []);
          const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

          results.push({
            title: templateQuery.title,
            description: templateQuery.description,
            rows,
            columns,
            sql: sanitized,
            intent: templateQuery.intent
          });
        } catch (sqlError: any) {
          console.error(`Template query "${templateQuery.title}" failed:`, sqlError);
          errors.push(`${templateQuery.title}: ${sqlError.message}`);
        }
      }

      // Return results (even if some queries failed)
      if (results.length > 0) {
        const executionTime = Date.now() - startTime;
        return formatMultiQueryResponse(results, {
          executionTime,
          method: 'template',
          remaining: multiRateLimit.remaining,
          ...(errors.length > 0 && { errors })
        });
      }

      // All template queries failed
      return NextResponse.json(
        {
          success: false,
          error: '템플릿 쿼리 실행 중 오류가 발생했습니다.',
          errors
        },
        { status: 400 }
      );
    }

    // 4. Fall back to AI-driven multi-query with verification
    let multiQueryResult;
    try {
      multiQueryResult = await executeMultiQuery(userQuery);
    } catch (aiError: any) {
      console.error('AI query failed:', aiError);

      // User-friendly error messages
      let errorMessage = '죄송합니다. 요청을 처리하지 못했습니다. 다시 시도해주세요.';

      if (aiError.message?.includes('API key')) {
        errorMessage = 'AI 기능을 사용하려면 API 키 설정이 필요합니다.';
      } else if (aiError.message?.includes('timeout')) {
        errorMessage = 'AI 응답 시간이 초과되었습니다. 다시 시도해주세요.';
      } else if (aiError.message?.includes('rate limit')) {
        errorMessage = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
      } else if (aiError.message?.includes('no such table') || aiError.message?.includes('no such column')) {
        errorMessage = '데이터베이스 오류가 발생했습니다. 다른 방식으로 질문해주세요.';
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          debug: process.env.NODE_ENV === 'development' ? aiError.message : undefined
        },
        { status: 400 }
      );
    }

    // 5. Check rate limit for AI multi-query
    const queryCount = multiQueryResult.results.length;
    const multiRateLimit = checkRateLimitMultiple(rateLimitId, queryCount);

    if (!multiRateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `너무 많은 요청입니다. ${formatResetTime(multiRateLimit.resetTime)} 후 다시 시도해주세요.`
        },
        { status: 429 }
      );
    }

    // 6. Validate all SQL queries (safety check)
    const validatedResults = [];
    for (const result of multiQueryResult.results) {
      const sanitized = sanitizeSQL(result.sql);
      const validation = validateSQL(sanitized);

      if (!validation.isValid) {
        console.warn(`Query "${result.title}" failed validation`);
        continue;
      }

      validatedResults.push({
        ...result,
        sql: sanitized
      });
    }

    if (validatedResults.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '생성된 쿼리가 안전하지 않습니다. 다시 시도해주세요.'
        },
        { status: 400 }
      );
    }

    const executionTime = Date.now() - startTime;

    // 7. Return multi-query response
    return formatMultiQueryResponse(
      validatedResults.map(r => ({
        title: r.title,
        description: r.description,
        rows: r.rows,
        columns: r.columns,
        sql: r.sql,
        intent: r.intent
      })),
      {
        executionTime,
        method: 'ai',
        remaining: multiRateLimit.remaining,
        attempts: multiQueryResult.attempts,
        verified: true,
        errors: multiQueryResult.errors
      }
    );

  } catch (error: any) {
    console.error('NL Query API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      },
      { status: 500 }
    );
  }
}
