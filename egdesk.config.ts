/**
 * EGDesk User Data Configuration
 * Generated at: 2026-02-26T10:45:30.728Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: 'cf3661d8-a918-4544-9800-96c01b54dc87',
} as const;

export interface TableDefinition {
  name: string;
  displayName: string;
  description?: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
}

export const TABLES = {
  table1: {
    name: 'purchases',
    displayName: '구매현황',
    description: undefined,
    rowCount: 2026,
    columnCount: 22,
    columns: ['id', '일자', '거래처코드', '거래처그룹1명', '구매처명', '창고명', '품목코드', '품목명', '단위', '규격_규격명', '수량', '중량', '단가', '공급가액', '합_계', '적요', '적요1', '적요2', '품목그룹1명', '품목그룹1코드', '품목그룹2명', '품목그룹3코드']
  } as TableDefinition,
  table2: {
    name: 'sales',
    displayName: '판매현황',
    description: undefined,
    rowCount: 7694,
    columnCount: 26,
    columns: ['id', '일자', '거래처그룹1코드명', '세무신고거래처코드', '거래처코드', '담당자코드명', '판매처명', '품목코드', '품목명_규격_', '단위', '규격명', '수량', '중량', '단가', '공급가액', '합_계', '품목그룹1코드', '품목그룹2명', '품목그룹3코드', '창고명', '거래처그룹2명', '신규일', '적요', '적요2', '코드변경', '실납업체']
  } as TableDefinition,
  table3: {
    name: 'inventory_transfers',
    displayName: '창고이동현황',
    description: undefined,
    rowCount: 42,
    columnCount: 12,
    columns: ['id', '월_일', '월_일_번호', '출고창고', '입고창고', '품목코드', '품명_및_규격', '수량', '중량', '원가', '적요', '품목그룹3코드']
  } as TableDefinition,
  table4: {
    name: 'internal_uses',
    displayName: '자가사용현황',
    description: undefined,
    rowCount: 45,
    columnCount: 10,
    columns: ['id', '일자', '일자_번호', '거래처명', '품목명_규격', '창고명', '수량', '금액_수량_입고단가', '품목그룹1코드', '적요']
  } as TableDefinition,
  table5: {
    name: 'purchase_orders',
    displayName: '발주서현황',
    description: undefined,
    rowCount: 418,
    columnCount: 14,
    columns: ['id', '월_일', '월_일_번호', '품명_및_규격', '품목그룹1코드', '수량', '단가', '공급가액', '부가세', '합계', '거래처명', '적요', '창고명', '품목그룹1명']
  } as TableDefinition,
  table6: {
    name: 'deposits',
    displayName: '입금보고서집계',
    description: undefined,
    rowCount: 674,
    columnCount: 16,
    columns: ['id', '전표번호', '전표번호_번호', '계좌', '돈들어온계좌번호', '계정명', '부서명', '거래처코드', '거래처명', '적요', '금액', '수수료', '담당자명', '프로젝트명', '세무신고거래처', '대표자명']
  } as TableDefinition,
  table7: {
    name: 'promissory_notes',
    displayName: '받을어음거래내역',
    description: undefined,
    rowCount: 83,
    columnCount: 12,
    columns: ['id', '일자', '증감구분', '어음번호', '거래처명', '계정명', '부서명', '프로젝트명', '적요', '증가금액', '감소금액', '잔액']
  } as TableDefinition
} as const;


// Main table (first table by default)
export const MAIN_TABLE = TABLES.table1;


// Helper to get table by name
export function getTableByName(tableName: string): TableDefinition | undefined {
  return Object.values(TABLES).find(t => t.name === tableName);
}

// Export table names for easy access
export const TABLE_NAMES = {
  table1: 'purchases',
  table2: 'sales',
  table3: 'inventory_transfers',
  table4: 'internal_uses',
  table5: 'purchase_orders',
  table6: 'deposits',
  table7: 'promissory_notes'
} as const;
