/**
 * SQL Validator
 *
 * Multi-layered security validation for SQL queries.
 * Prevents SQL injection and enforces read-only access.
 */

import { TABLES } from '../../egdesk.config';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate SQL query for security and correctness
 */
export function validateSQL(sql: string): ValidationResult {
  // Normalize SQL for validation
  const normalizedSQL = sql.trim().toLowerCase();

  // 1. Check if query is SELECT only (allow WITH clauses for CTEs)
  if (!normalizedSQL.startsWith('select') && !normalizedSQL.startsWith('with')) {
    return {
      isValid: false,
      error: '보안상의 이유로 SELECT 쿼리만 실행할 수 있습니다.'
    };
  }

  // 1b. If it starts with WITH, ensure it contains SELECT
  if (normalizedSQL.startsWith('with') && !normalizedSQL.includes('select')) {
    return {
      isValid: false,
      error: '보안상의 이유로 SELECT 쿼리만 실행할 수 있습니다.'
    };
  }

  // 2. Blacklist dangerous keywords
  const dangerousKeywords = [
    'drop',
    'delete',
    'update',
    'insert',
    'alter',
    'create',
    'truncate',
    'exec',
    'execute',
    'pragma',
    'attach',
    'detach'
  ];

  for (const keyword of dangerousKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(sql)) {
      return {
        isValid: false,
        error: `보안상의 이유로 ${keyword.toUpperCase()} 명령어는 사용할 수 없습니다.`
      };
    }
  }

  // 3. Check for SQL injection patterns
  const injectionPatterns = [
    /;\s*--/,           // Comment-based injection
    /;\s*\/\*/,         // Multi-line comment injection
    /union\s+select/i,  // UNION injection
    /;\s*drop/i,        // Statement chaining
    /;\s*delete/i,      // Statement chaining
    /;\s*update/i,      // Statement chaining
    /;\s*insert/i,      // Statement chaining
    /xp_/i,             // Extended procedures
    /sp_/i              // System stored procedures
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(sql)) {
      return {
        isValid: false,
        error: '보안상의 이유로 이 쿼리는 실행할 수 없습니다.'
      };
    }
  }

  // 4. Validate table names (ensure they exist in schema or are CTEs)
  const validTableNames = Object.values(TABLES).map(t => t.name);

  // Extract CTE names if query uses WITH clause
  const cteNames: string[] = [];
  if (normalizedSQL.startsWith('with')) {
    // Match CTE names: WITH cte_name AS (...), another_cte AS (...)
    const ctePattern = /with\s+([a-z_]+)\s+as|,\s*([a-z_]+)\s+as/gi;
    const cteMatches = [...sql.matchAll(ctePattern)];
    for (const match of cteMatches) {
      const cteName = (match[1] || match[2])?.toLowerCase();
      if (cteName) {
        cteNames.push(cteName);
      }
    }
  }

  // Check table names in FROM/JOIN clauses
  // Match: FROM table1, table2 or JOIN table
  const tablePattern = /(?:from|join)\s+([a-z_]+(?:\s*,\s*[a-z_]+)*)/gi;
  const matches = [...sql.matchAll(tablePattern)];

  for (const match of matches) {
    const tableList = match[1];
    // Split by comma to handle multiple tables
    const tables = tableList.split(/\s*,\s*/).map(t => t.trim().toLowerCase());

    for (const tableName of tables) {
      if (tableName &&
          !validTableNames.includes(tableName) &&
          !cteNames.includes(tableName)) {
        return {
          isValid: false,
          error: `테이블 '${tableName}'은(는) 존재하지 않습니다.`
        };
      }
    }
  }

  // 5. Check for multiple statements (simple check)
  const statementCount = sql.split(';').filter(s => s.trim().length > 0).length;
  if (statementCount > 1) {
    return {
      isValid: false,
      error: '한 번에 하나의 쿼리만 실행할 수 있습니다.'
    };
  }

  // All checks passed
  return { isValid: true };
}

/**
 * Sanitize SQL query (remove excessive whitespace, normalize)
 */
export function sanitizeSQL(sql: string): string {
  return sql
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .trim();
}
