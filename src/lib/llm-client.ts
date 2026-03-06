/**
 * LLM Client
 *
 * Anthropic Claude API integration for natural language to SQL conversion.
 */

import { buildSchemaContext } from './schema-builder';

export interface LLMResponse {
  sql: string;
  intent: string;
}

/**
 * Generate SQL query using Anthropic Claude API
 */
export async function generateSQLWithLLM(query: string, retries = 2): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const schemaContext = buildSchemaContext(query);
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];

  // Calculate common date ranges for reference
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  const monthBeforeLastStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
  const monthBeforeLastEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0).toISOString().split('T')[0];

  const systemPrompt = `Generate valid SQLite SELECT queries for a Korean business database.

${schemaContext}

DATES:
- Today: ${currentDate}
- This month: ${thisMonthStart} to now
- Last month: ${lastMonthStart} to ${lastMonthEnd}
- 2 months ago: ${monthBeforeLastStart} to ${monthBeforeLastEnd}

INSTRUCTIONS:
- Return ONLY the SQL query (no markdown, no explanations)
- Use LIMIT (max 1000)
- For growth rates: ((new-old)/old)*100 using WITH clauses`;

  const userPrompt = `Generate a SQL query for: ${query}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      let sql = data.content?.[0]?.text?.trim() || '';

      // Extract SQL from markdown code blocks if present
      const codeBlockMatch = sql.match(/```(?:sql)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        sql = codeBlockMatch[1].trim();
      }

      // Remove any trailing semicolons
      sql = sql.replace(/;+$/, '').trim();

      if (!sql) {
        throw new Error('Empty SQL response from Claude');
      }

      // Detect query intent from the generated SQL
      const intent = detectQueryIntent(sql);

      return { sql, intent };

    } catch (error) {
      lastError = error as Error;
      console.error(`LLM attempt ${attempt + 1}/${retries + 1} failed:`, error);

      if (attempt < retries) {
        // Exponential backoff: 1s, 2s
        console.log(`Retrying in ${attempt + 1} second(s)...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  console.error('All LLM attempts failed. Last error:', lastError);
  throw lastError || new Error('Failed to generate SQL with LLM');
}

/**
 * Detect query intent from SQL for component routing
 */
function detectQueryIntent(sql: string): string {
  const lowerSQL = sql.toLowerCase();

  if (lowerSQL.includes('사업소') && lowerSQL.includes('매출')) {
    return 'sales_by_branch';
  }

  if (lowerSQL.includes('거래처') && lowerSQL.includes('매출')) {
    return 'customer_sales';
  }

  if (lowerSQL.includes('재고')) {
    return 'inventory_status';
  }

  if (lowerSQL.includes('수금') || lowerSQL.includes('deposits')) {
    return 'collections';
  }

  if (lowerSQL.includes('미구매')) {
    return 'pending_purchases';
  }

  if (lowerSQL.includes('미판매')) {
    return 'pending_sales';
  }

  if (lowerSQL.includes('구매')) {
    return 'purchases';
  }

  return 'generic';
}
