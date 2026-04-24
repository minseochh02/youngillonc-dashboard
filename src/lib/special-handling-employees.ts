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

/** 
 * 마감회의 및 각종 회의(B2C, B2B) 매입 집계에서 사용하는 유일한 거래처코드.
 * 이 목록에 있는 거래처의 매입 데이터만 회의용 매입/계산재고에 반영됩니다.
 */
export const MEETING_PURCHASE_INCLUDED_CLIENT_CODES = ['PR00061'] as const;

function sqlMeetingPurchaseIncludedClientCodesList(): string {
  return MEETING_PURCHASE_INCLUDED_CLIENT_CODES.map((c) => `'${sqlEscapeSingleQuotedLiteral(c)}'`).join(', ');
}

/**
 * SQL predicate: 거래처코드가 회의용 포함 목록에 있음.
 * @param clientCodeColumnExpr 예: `p.거래처코드`, `거래처코드`
 */
export function sqlMeetingPurchaseIncludedClientPredicate(clientCodeColumnExpr: string): string {
  return `COALESCE(${clientCodeColumnExpr}, '') IN (${sqlMeetingPurchaseIncludedClientCodesList()})`;
}

/** `AND p.거래처코드 …` — 회의 전용 포함 필터. */
export function sqlAndPurchaseIncludeMeetingCounterpartyCodes(purchaseAlias: string = 'p'): string {
  return `AND ${sqlMeetingPurchaseIncludedClientPredicate(`${purchaseAlias}.거래처코드`)}`;
}

/** 
 * @deprecated 회의용 매입 필터는 이제 Inclusion(포함) 방식입니다.
 * 대신 sqlAndPurchaseIncludeMeetingCounterpartyCodes를 사용하세요.
 */
export function sqlAndPurchaseExcludeMeetingCounterpartyCodes(purchaseAlias: string = 'p'): string {
  return sqlAndPurchaseIncludeMeetingCounterpartyCodes(purchaseAlias);
}

/** 
 * @deprecated 대신 sqlMeetingPurchaseIncludedClientPredicate를 사용하세요.
 */
export function sqlMeetingPurchaseExcludedClientPredicate(clientCodeColumnExpr: string): string {
  return sqlMeetingPurchaseIncludedClientPredicate(clientCodeColumnExpr);
}

/** 
 * @deprecated 대시보드 전체 적용에서 회의 전용 적용으로 변경되었습니다.
 * 대신 sqlAndPurchaseExcludeMeetingCounterpartyCodes를 사용하세요.
 */
export function sqlAndPurchaseExcludeCounterpartyCodes(_purchaseAlias: string = 'p'): string {
  return '';
}

/** 
 * @deprecated 대신 sqlMeetingPurchaseExcludedClientPredicate를 사용하세요.
 */
export function sqlPurchaseExcludedClientPredicate(_clientCodeColumnExpr: string): string {
  return '1=1';
}

/**
 * 거래처 키가 특별처리 담당에게 배정된 거래처가 아닌 경우(또는 키가 NULL).
 * @param clientKeyExpr SQL 식, 예: `s.거래처코드`, `sqlSalesResolvedClientKeyExpr('s')`
 */
export function sqlAndClientKeyNotAssignedToSpecialHandling(clientKeyExpr: string): string {
  const inner = `SELECT 거래처코드 FROM clients WHERE 담당자코드 IN (SELECT 사원_담당_코드 FROM employees WHERE 사원_담당_명 IN (${sqlQuotedNameList()}))`;
  return `AND (${clientKeyExpr} NOT IN (${inner}) OR ${clientKeyExpr} IS NULL)\n${sqlAndSalesRemarkNotExact('s.적요')}`;
}
