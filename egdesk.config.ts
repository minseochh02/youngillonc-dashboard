/**
 * EGDesk User Data Configuration
 * Generated at: 2026-02-28T08:57:50.841Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '6de9b12c-3cf0-41d7-8c18-89421c08913f',
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
    name: 'pending_purchases',
    displayName: '미구매현황',
    description: 'Merged from 1 islands',
    rowCount: 30,
    columnCount: 20,
    columns: ['id', '월_일', '품목코드', '품명_및_규격', '수량', '잔량', '잔량_중량_', '미구매공급가액', '미구매부가세', '합계', '납기일자', '거래처명', '품목그룹1명', '창고명', '품목별납기일자', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table2: {
    name: 'pending_sales',
    displayName: '미판매현황',
    description: 'Merged from 1 islands',
    rowCount: 5,
    columnCount: 15,
    columns: ['id', '월_일', '품목코드', '품명_및_규격', '수량', '잔량', '공급가액', '거래처명', '적요', '납기일자', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table3: {
    name: 'inventory',
    displayName: '창고별재고',
    description: 'Merged from 1 islands',
    rowCount: 758,
    columnCount: 7,
    columns: ['id', '품목코드', '품목명_규격_', '창고코드', '창고명', '재고수량', 'imported_at']
  } as TableDefinition,
  table4: {
    name: 'ledger',
    displayName: '계정별원장',
    description: 'Merged from 61 islands',
    rowCount: 6685,
    columnCount: 16,
    columns: ['id', '일자_no_', '적요', '계정코드', '계정명', '거래처명', '거래처코드', '부서명', '담당자코드', '차변금액', '대변금액', '잔액', '회사명', '기간', '계정코드_메타', '계정명_메타']
  } as TableDefinition,
  table5: {
    name: 'purchases',
    displayName: '구매현황',
    description: undefined,
    rowCount: 2026,
    columnCount: 22,
    columns: ['id', '일자', '거래처코드', '거래처그룹1명', '구매처명', '창고명', '품목코드', '품목명', '단위', '규격_규격명', '수량', '중량', '단가', '공급가액', '합_계', '적요', '적요1', '적요2', '품목그룹1명', '품목그룹1코드', '품목그룹2명', '품목그룹3코드']
  } as TableDefinition,
  table6: {
    name: 'sales',
    displayName: '판매현황',
    description: undefined,
    rowCount: 12381,
    columnCount: 26,
    columns: ['id', '일자', '거래처그룹1코드명', '세무신고거래처코드', '거래처코드', '담당자코드명', '판매처명', '품목코드', '품목명_규격_', '단위', '규격명', '수량', '중량', '단가', '공급가액', '합_계', '품목그룹1코드', '품목그룹2명', '품목그룹3코드', '창고명', '거래처그룹2명', '신규일', '적요', '적요2', '코드변경', '실납업체']
  } as TableDefinition,
  table7: {
    name: 'inventory_transfers',
    displayName: '창고이동현황',
    description: undefined,
    rowCount: 42,
    columnCount: 12,
    columns: ['id', '월_일', '월_일_번호', '출고창고', '입고창고', '품목코드', '품명_및_규격', '수량', '중량', '원가', '적요', '품목그룹3코드']
  } as TableDefinition,
  table8: {
    name: 'internal_uses',
    displayName: '자가사용현황',
    description: undefined,
    rowCount: 45,
    columnCount: 10,
    columns: ['id', '일자', '일자_번호', '거래처명', '품목명_규격', '창고명', '수량', '금액_수량_입고단가', '품목그룹1코드', '적요']
  } as TableDefinition,
  table9: {
    name: 'purchase_orders',
    displayName: '발주서현황',
    description: undefined,
    rowCount: 819,
    columnCount: 14,
    columns: ['id', '월_일', '월_일_번호', '품명_및_규격', '품목그룹1코드', '수량', '단가', '공급가액', '부가세', '합계', '거래처명', '적요', '창고명', '품목그룹1명']
  } as TableDefinition,
  table10: {
    name: 'deposits',
    displayName: '입금보고서집계',
    description: undefined,
    rowCount: 674,
    columnCount: 16,
    columns: ['id', '전표번호', '전표번호_번호', '계좌', '돈들어온계좌번호', '계정명', '부서명', '거래처코드', '거래처명', '적요', '금액', '수수료', '담당자명', '프로젝트명', '세무신고거래처', '대표자명']
  } as TableDefinition,
  table11: {
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
  table1: 'pending_purchases',
  table2: 'pending_sales',
  table3: 'inventory',
  table4: 'ledger',
  table5: 'purchases',
  table6: 'sales',
  table7: 'inventory_transfers',
  table8: 'internal_uses',
  table9: 'purchase_orders',
  table10: 'deposits',
  table11: 'promissory_notes'
} as const;
