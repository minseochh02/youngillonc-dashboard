/**
 * 대시보드 집계 등에서 제외하는 담당자(특별처리) 이름 목록과 SQL 조각.
 * 한 곳에서만 이름을 정의하고 API·lib에서 동일하게 사용합니다.
 */

function sqlEscapeSingleQuotedLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/** @remarks 특별처리 — 대시보드 집계에서 제외하는 사원_담당_명 */
export const SPECIAL_HANDLING_EMPLOYEE_NAMES = ['김도량'] as const;

function sqlQuotedNameList(): string {
  return SPECIAL_HANDLING_EMPLOYEE_NAMES.map((n) => `'${sqlEscapeSingleQuotedLiteral(n)}'`).join(', ');
}

/** 조건만: `alias.사원_담당_명 NOT IN (...)` (WHERE/AND 뒤에 붙임) */
export function employeeAliasNotSpecialHandlingCondition(alias: string = 'e'): string {
  return `${alias}.사원_담당_명 NOT IN (${sqlQuotedNameList()})`;
}

/** `AND alias.사원_담당_명 NOT IN (...)` */
export function sqlAndEmployeeNotSpecialHandling(alias: string = 'e'): string {
  return `AND ${employeeAliasNotSpecialHandlingCondition(alias)}`;
}

/** `AND COALESCE(alias.사원_담당_명, '') NOT IN (...)` — NULL 담당을 빈 문자열과 동일하게 취급 */
export function sqlAndEmployeeNotSpecialHandlingCoalescedEmpty(alias: string = 'e'): string {
  return `AND COALESCE(${alias}.사원_담당_명, '') NOT IN (${sqlQuotedNameList()})`;
}

/** LEFT JOIN employees 시 미매칭 행 유지: 담당 미존재이거나 특별처리가 아닌 경우만 */
export function sqlAndEmployeeNotSpecialHandlingOrNull(alias: string = 'e'): string {
  return `AND (${alias}.사원_담당_명 IS NULL OR ${employeeAliasNotSpecialHandlingCondition(alias)})`;
}

/**
 * 매출 비고(적요) 값이 특정 문자열과 정확히 일치하는 행을 제외합니다.
 * 기본값은 `삼광`이며, exact match만 제외합니다.
 */
export function sqlAndSalesRemarkNotExact(remarkColumnExpr: string = 's.적요', exactValue: string = '삼광'): string {
  const escaped = sqlEscapeSingleQuotedLiteral(exactValue);
  return `AND (${remarkColumnExpr} IS NULL OR ${remarkColumnExpr} != '${escaped}')`;
}

/**
 * 실납업체가 clients.거래처코드에 존재할 때만 실납업체를 사용하고,
 * 그렇지 않으면 sales의 거래처코드로 안전하게 폴백하는 거래처 키 SQL 식.
 */
export function sqlSalesResolvedClientKeyExpr(
  salesAlias: string = 's',
  clientsTable: string = 'clients',
  clientsAliasForExists: string = 'c_lookup'
): string {
  return `CASE
    WHEN NULLIF(${salesAlias}.실납업체, '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM ${clientsTable} ${clientsAliasForExists}
        WHERE ${clientsAliasForExists}.거래처코드 = NULLIF(${salesAlias}.실납업체, '')
      )
    THEN NULLIF(${salesAlias}.실납업체, '')
    ELSE ${salesAlias}.거래처코드
  END`;
}

/** 구매 집계에서 품목그룹1코드가 분류 대상(6개 그룹)인 행만 포함 */
export function sqlPurchaseOnlyClassifiedGroups(groupAlias: string = 'i'): string {
  return `AND ${groupAlias}.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')`;
}

/** 매입 집계에서 제외하는 거래처코드 (내부·특수 매입처 등). 목록만 수정하면 전역 적용. */
export const PURCHASE_EXCLUDED_CLIENT_CODES = ['PR00061'] as const;

function sqlPurchaseExcludedClientCodesList(): string {
  return PURCHASE_EXCLUDED_CLIENT_CODES.map((c) => `'${sqlEscapeSingleQuotedLiteral(c)}'`).join(', ');
}

/**
 * SQL predicate: 거래처코드가 제외 목록에 없음. NULL·빈 문자열은 제외 목록과 매칭되지 않으면 포함.
 * @param clientCodeColumnExpr 예: `p.거래처코드`, `거래처코드`
 */
export function sqlPurchaseExcludedClientPredicate(clientCodeColumnExpr: string): string {
  return `COALESCE(${clientCodeColumnExpr}, '') NOT IN (${sqlPurchaseExcludedClientCodesList()})`;
}

/** `AND p.거래처코드 …` — purchases 테이블 별칭 기본 `p` */
export function sqlAndPurchaseExcludeCounterpartyCodes(purchaseAlias: string = 'p'): string {
  return `AND ${sqlPurchaseExcludedClientPredicate(`${purchaseAlias}.거래처코드`)}`;
}

/**
 * 거래처 키가 특별처리 담당에게 배정된 거래처가 아닌 경우(또는 키가 NULL).
 * @param clientKeyExpr SQL 식, 예: `s.거래처코드`, `sqlSalesResolvedClientKeyExpr('s')`
 */
export function sqlAndClientKeyNotAssignedToSpecialHandling(clientKeyExpr: string): string {
  const inner = `SELECT 거래처코드 FROM clients WHERE 담당자코드 IN (SELECT 사원_담당_코드 FROM employees WHERE 사원_담당_명 IN (${sqlQuotedNameList()}))`;
  return `AND (${clientKeyExpr} NOT IN (${inner}) OR ${clientKeyExpr} IS NULL)\n${sqlAndSalesRemarkNotExact('s.적요')}`;
}
