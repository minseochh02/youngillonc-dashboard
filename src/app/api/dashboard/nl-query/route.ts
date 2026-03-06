/**
 * Natural Language Query API Route
 *
 * Converts natural language queries to SQL and executes them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateSQLFromTemplate } from '@/lib/query-templates';
import { generateSQLWithLLM } from '@/lib/llm-client';
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
    const { query, context } = body;

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

    // 3. Try template matching first
    let sql = '';
    let intent = '';
    let method: 'template' | 'llm' = 'template';

    const templateResult = generateSQLFromTemplate(userQuery);

    if (templateResult) {
      sql = templateResult.sql;
      intent = templateResult.intent;
      method = 'template';
    } else {
      // 4. Fallback to LLM
      try {
        const llmResult = await generateSQLWithLLM(userQuery);
        sql = llmResult.sql;
        intent = llmResult.intent;
        method = 'llm';
      } catch (llmError: any) {
        console.error('LLM generation failed:', llmError);
        console.error('Error details:', {
          message: llmError.message,
          stack: llmError.stack
        });

        // Check for specific error types
        let errorMessage = '죄송합니다. 요청을 이해하지 못했습니다. 예시 쿼리를 참고해주세요.';

        if (llmError.message?.includes('API key')) {
          errorMessage = 'API 키 설정이 필요합니다. 관리자에게 문의해주세요.';
        } else if (llmError.message?.includes('timeout')) {
          errorMessage = 'AI 응답 시간이 초과되었습니다. 다시 시도해주세요.';
        } else if (llmError.message?.includes('rate limit')) {
          errorMessage = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
        }

        return NextResponse.json(
          {
            success: false,
            error: errorMessage,
            debug: process.env.NODE_ENV === 'development' ? llmError.message : undefined
          },
          { status: 400 }
        );
      }
    }

    // 5. Sanitize and validate SQL
    sql = sanitizeSQL(sql);
    const validation = validateSQL(sql);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || '유효하지 않은 SQL 쿼리입니다.'
        },
        { status: 400 }
      );
    }

    // 6. Add LIMIT if not present (safety measure)
    if (!sql.toLowerCase().includes('limit')) {
      sql = `${sql} LIMIT 1000`;
    }

    // 7. Execute SQL
    let result;
    try {
      result = await executeSQL(sql);
    } catch (execError: any) {
      console.error('SQL execution failed:', execError);

      // User-friendly error messages
      let errorMessage = '쿼리 실행 중 오류가 발생했습니다.';

      if (execError.message?.includes('timeout')) {
        errorMessage = '쿼리 실행 시간이 초과되었습니다. 더 구체적인 조건을 추가해보세요.';
      } else if (execError.message?.includes('no such table')) {
        errorMessage = '존재하지 않는 테이블입니다.';
      } else if (execError.message?.includes('no such column')) {
        errorMessage = '존재하지 않는 컬럼입니다.';
      } else if (execError.message?.includes('syntax error')) {
        errorMessage = 'SQL 쿼리에 문법 오류가 있습니다.';
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage
        },
        { status: 500 }
      );
    }

    // 8. Process results
    const rows = result.rows || [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    // Determine component hint based on intent
    let componentHint = 'GenericResultTable';
    if (intent === 'sales_by_branch' || intent === 'monthly_sales_by_branch') {
      componentHint = 'SalesTable';
    }

    const executionTime = Date.now() - startTime;

    // 9. Return response
    return NextResponse.json({
      success: true,
      data: {
        rows,
        columns,
        sql,
        intent,
        componentHint
      },
      metadata: {
        executionTime,
        rowCount: rows.length,
        method,
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
