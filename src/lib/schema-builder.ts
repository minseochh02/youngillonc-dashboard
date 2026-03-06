/**
 * Schema Context Builder
 *
 * Builds comprehensive database schema context for LLM to generate accurate SQL queries.
 */

import { TABLES } from '../../egdesk.config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Detect relevant context sections based on query keywords
 */
function getRelevantSections(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const sections: string[] = [];

  // Always include core sections (small and critical):
  // 1: Database Tables
  // 2: Branch Names (CRITICAL - tells which column to use: sales→거래처그룹1코드명)
  // 3: Product Categories
  // 4: Data Cleaning
  // 5: Dates
  sections.push('1', '2', '3', '4', '5');

  // Collection/payment queries
  if (lowerQuery.match(/수금|입금|어음|카드|현금|결제/)) {
    sections.push('6', '7');
  }

  // Ledger/funds queries
  if (lowerQuery.match(/원장|자금|잔액|입출금|예금|차입금/)) {
    sections.push('8');
  }

  // Units/conversion queries
  if (lowerQuery.match(/D\/M|드럼|중량|리터|무게/)) {
    sections.push('9');
  }

  return sections;
}

/**
 * Load and filter DB_KNOWLEDGE.md content
 */
function loadDBKnowledge(query?: string): string {
  try {
    const knowledgePath = path.join(process.cwd(), 'DB_KNOWLEDGE.md');
    if (!fs.existsSync(knowledgePath)) {
      return '';
    }

    const fullContent = fs.readFileSync(knowledgePath, 'utf-8');

    // If no query provided, return full content
    if (!query) {
      return fullContent;
    }

    // Get relevant sections
    const relevantSections = getRelevantSections(query);

    // Split by section headers (## 1., ## 2., etc.)
    const sections = fullContent.split(/(?=^## \d+\.)/m);
    const header = sections[0]; // Title and intro

    // Filter to only relevant sections
    const filtered = sections.filter((section, idx) => {
      if (idx === 0) return true; // Always include header
      const match = section.match(/^## (\d+)\./);
      return match && relevantSections.includes(match[1]);
    });

    return filtered.join('');
  } catch (error) {
    console.warn('Could not load DB_KNOWLEDGE.md:', error);
    return '';
  }
}

/**
 * Build schema context for LLM
 */
export function buildSchemaContext(query?: string): string {
  const dbKnowledge = loadDBKnowledge(query);
  let context = '';

  // Include DB_KNOWLEDGE.md if available
  if (dbKnowledge) {
    context += `${dbKnowledge}\n\n---\n\n`;
  }

  context += `
# Database Tables

${Object.values(TABLES).map(table => `
**${table.name}** (${table.displayName}) - ${table.rowCount.toLocaleString()} rows
Columns: ${table.columns.join(', ')}
`).join('\n')}

# Query Rules

- SELECT only (no INSERT/UPDATE/DELETE/DROP)
- Use LIMIT (max 1000 rows)
- Clean numeric columns: CAST(REPLACE(column,',','') AS NUMERIC)
- Date format: YYYY-MM-DD
`;

  return context.trim();
}

/**
 * Build user-friendly error messages
 */
export function getErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    'timeout': '쿼리 실행 시간이 초과되었습니다. 더 구체적인 조건을 추가해보세요.',
    'no_results': '조건에 맞는 데이터가 없습니다.',
    'invalid_table': '존재하지 않는 테이블입니다.',
    'invalid_column': '존재하지 않는 컬럼입니다.',
    'syntax_error': 'SQL 쿼리에 문법 오류가 있습니다.',
    'permission_denied': '이 작업을 수행할 권한이 없습니다.',
    'rate_limit': '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.'
  };

  // Try to match error patterns
  for (const [key, message] of Object.entries(errorMessages)) {
    if (error.toLowerCase().includes(key)) {
      return message;
    }
  }

  return '쿼리 실행 중 오류가 발생했습니다. 다시 시도해주세요.';
}
