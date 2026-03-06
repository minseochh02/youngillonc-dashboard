/**
 * Natural Language Query API Route
 *
 * AI-driven query system: User Question → AI → SQL → Execute → Verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeAIQuery } from '@/lib/ai-query-system';
import { validateSQL, sanitizeSQL } from '@/lib/sql-validator';
import { checkRateLimit, getRateLimitIdentifier, formatResetTime } from '@/lib/rate-limiter';
import { executeSQL } from '../../../../../egdesk-helpers';

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

    // 3. Execute AI-driven query with verification
    let queryResult;
    try {
      queryResult = await executeAIQuery(userQuery);
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

    // 4. Validate SQL (safety check)
    const sanitized = sanitizeSQL(queryResult.sql);
    const validation = validateSQL(sanitized);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: '생성된 쿼리가 안전하지 않습니다. 다시 시도해주세요.'
        },
        { status: 400 }
      );
    }

    // 5. Determine component hint
    let componentHint = 'GenericResultTable';
    if (queryResult.intent === 'daily_sales_by_branch' ||
        queryResult.intent === 'monthly_sales_by_branch') {
      componentHint = 'SalesTable';
    }

    const executionTime = Date.now() - startTime;

    // 6. Return response
    return NextResponse.json({
      success: true,
      data: {
        rows: queryResult.rows,
        columns: queryResult.columns,
        sql: queryResult.sql,
        intent: queryResult.intent,
        componentHint
      },
      metadata: {
        executionTime,
        rowCount: queryResult.rows.length,
        method: 'ai',
        verified: queryResult.verified,
        attempts: queryResult.attempts,
        remaining: rateLimit.remaining
      }
    });

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
