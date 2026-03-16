/**
 * EGDesk User Data Configuration
 * Generated at: 2026-03-15T14:40:48.105Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: 'c561b590-817a-44f3-98ad-2672cda34146',
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
    name: 'sales',
    displayName: '판매현황',
    description: undefined,
    rowCount: 6506,
    columnCount: 17,
    columns: ['id', '일자', '거래처코드', '담당자코드', '품목코드', '단위', '규격명', '수량', '중량', '단가', '공급가액', '부가세', '합계', '출하창고코드', '신규일', '적요', '적요2']
  } as TableDefinition,
  table2: {
    name: 'company_type_auto',
    displayName: 'AUTO 업종분류기준',
    description: undefined,
    rowCount: 35,
    columnCount: 5,
    columns: ['id', '업종분류코드', '오토_대분류', '모빌_대시보드채널', '거래처그룹2']
  } as TableDefinition,
  table3: {
    name: 'company_type',
    displayName: '업종분류',
    description: undefined,
    rowCount: 116,
    columnCount: 7,
    columns: ['id', '업종분류코드', '모빌분류', '산업분류', '섹터분류', '영일분류', '비고']
  } as TableDefinition,
  table4: {
    name: 'employee_category',
    displayName: '사원분류',
    description: undefined,
    rowCount: 47,
    columnCount: 8,
    columns: ['id', '담당자', 'b2b팀', 'b2b사업소', 'b2b팀별담당', 'b2c_팀', 'b2c사업소', '전체사업소']
  } as TableDefinition,
  table5: {
    name: 'employees',
    displayName: '사원',
    description: undefined,
    rowCount: 65,
    columnCount: 4,
    columns: ['id', '사원_담당_코드', '사원_담당_명', 'imported_at']
  } as TableDefinition,
  table6: {
    name: 'items',
    displayName: '품목',
    description: undefined,
    rowCount: 3317,
    columnCount: 12,
    columns: ['id', '품목코드', '품목그룹1코드', '품목그룹2코드', '품목그룹3코드', '품목명', '품목구분', '규격정보', '구분', '석유류', '제품군', 'imported_at']
  } as TableDefinition,
  table7: {
    name: 'warehouses',
    displayName: '창고',
    description: undefined,
    rowCount: 25,
    columnCount: 10,
    columns: ['id', '창고코드', '창고명', '계층그룹코드', '구분', '생산공정명', '외주거래처명', '사용', '추가사업장명', 'imported_at']
  } as TableDefinition,
  table8: {
    name: 'clients',
    displayName: '거래처리스트',
    description: undefined,
    rowCount: 10755,
    columnCount: 7,
    columns: ['id', '거래처코드', '거래처명', '업종분류코드', '담당자코드', '지역코드', 'imported_at']
  } as TableDefinition,
  table9: {
    name: 'user_data_embedding_metadata',
    displayName: 'user_data_embedding_metadata',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 8,
    columns: ['id', 'table_id', 'column_name', 'total_embeddings', 'embedding_model', 'embedding_dimensions', 'last_updated', 'estimated_cost_usd']
  } as TableDefinition,
  table10: {
    name: 'user_data_embeddings',
    displayName: 'user_data_embeddings',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 9,
    columns: ['id', 'table_id', 'row_id', 'column_name', 'embedding_model', 'embedding_dimensions', 'embedding', 'created_at', 'updated_at']
  } as TableDefinition,
  table11: {
    name: 'sync_activity_log',
    displayName: 'sync_activity_log',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 12,
    columns: ['id', 'config_id', 'file_name', 'file_path', 'status', 'rows_imported', 'rows_skipped', 'duplicates_skipped', 'error_message', 'started_at', 'completed_at', 'duration_ms']
  } as TableDefinition,
  table12: {
    name: 'sync_configurations',
    displayName: 'sync_configurations',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: 11,
    columnCount: 23,
    columns: ['id', 'script_folder_path', 'script_name', 'folder_name', 'target_table_id', 'header_row', 'skip_bottom_rows', 'sheet_index', 'column_mappings', 'applied_splits', 'file_action', 'enabled', 'auto_sync_enabled', 'unique_key_columns', 'duplicate_action', 'last_sync_at', 'last_sync_status', 'last_sync_rows_imported', 'last_sync_rows_skipped', 'last_sync_duplicates', 'last_sync_error', 'created_at', 'updated_at']
  } as TableDefinition,
  table13: {
    name: 'user_data_files',
    displayName: 'user_data_files',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 15,
    columns: ['id', 'table_id', 'row_id', 'column_name', 'filename', 'mime_type', 'size_bytes', 'storage_type', 'file_data', 'file_path', 'is_compressed', 'compression_type', 'original_size', 'created_at', 'updated_at']
  } as TableDefinition,
  table14: {
    name: 'inventory_transfers',
    displayName: '창고이동현황',
    description: undefined,
    rowCount: 138,
    columnCount: 13,
    columns: ['id', '일자', '일자_번호', '출고창고명', '입고창고명', '품목명_규격', '수량', '중량', '금액_수량_입고단가', '품목그룹1코드', '품목그룹3코드', '적요', 'imported_at']
  } as TableDefinition,
  table15: {
    name: 'internal_uses',
    displayName: '자가사용현황',
    description: undefined,
    rowCount: 53,
    columnCount: 15,
    columns: ['id', '일자', '일자_번호', '사용유형', '적요', '품목코드', '품명_및_규격', '수량', '중량', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', 'imported_at']
  } as TableDefinition,
  table16: {
    name: 'purchase_orders',
    displayName: '발주서현황',
    description: undefined,
    rowCount: 1189,
    columnCount: 15,
    columns: ['id', '월_일', '월_일_번호', '품명_및_규격', '품목그룹1코드', '수량', '단가', '공급가액', '부가세', '합계', '거래처명', '적요', '창고명', '품목그룹1명', 'imported_at']
  } as TableDefinition,
  table17: {
    name: 'deposits',
    displayName: '입금보고서집계',
    description: undefined,
    rowCount: 1489,
    columnCount: 17,
    columns: ['id', '전표번호', '전표번호_번호', '계좌', '돈들어온계좌번호', '계정명', '부서명', '거래처코드', '거래처명', '적요', '금액', '수수료', '담당자명', '프로젝트명', '세무신고거래처', '대표자명', 'imported_at']
  } as TableDefinition,
  table18: {
    name: 'promissory_notes',
    displayName: '받을어음거래내역',
    description: undefined,
    rowCount: 162,
    columnCount: 13,
    columns: ['id', '일자', '증감구분', '어음번호', '거래처명', '계정명', '부서명', '프로젝트명', '적요', '증가금액', '감소금액', '잔액', 'imported_at']
  } as TableDefinition,
  table19: {
    name: 'product_mapping',
    displayName: '품목코드매핑',
    description: 'Product code mapping table for inventory categorization',
    rowCount: 709,
    columnCount: 8,
    columns: ['id', '품목코드', '품목명', '품목그룹1코드', '품목그룹1명', '품목그룹2명', '품목그룹3코드', 'last_seen_date']
  } as TableDefinition,
  table20: {
    name: 'ledger',
    displayName: '계정별원장',
    description: 'Rebuilt from CSV with proper date formatting',
    rowCount: 20622,
    columnCount: 18,
    columns: ['id', '일자', '일자_no', '적요', '계정코드', '계정명', '거래처명', '거래처코드', '부서명', '담당자코드', '차변금액', '대변금액', '잔액', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table21: {
    name: 'pending_purchases',
    displayName: '미구매현황',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 미구매현황(pending_purchases)',
    rowCount: 155,
    columnCount: 20,
    columns: ['id', '월_일', '품목코드', '품명_및_규격', '수량', '잔량', '잔량_중량_', '미구매공급가액', '미구매부가세', '합계', '납기일자', '거래처명', '품목그룹1명', '창고명', '품목별납기일자', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table22: {
    name: 'pending_sales',
    displayName: '미판매현황',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 미판매현황(pending_sales)',
    rowCount: 15,
    columnCount: 15,
    columns: ['id', '월_일', '품목코드', '품명_및_규격', '수량', '잔량', '공급가액', '거래처명', '적요', '납기일자', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table23: {
    name: 'inventory',
    displayName: '창고별재고',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 창고별재고(inventory)',
    rowCount: 54815,
    columnCount: 7,
    columns: ['id', '품목코드', '품목명_규격_', '창고코드', '창고명', '재고수량', 'imported_at']
  } as TableDefinition,
  table24: {
    name: 'purchases',
    displayName: '구매현황',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 구매현황(purchases)',
    rowCount: 5154,
    columnCount: 23,
    columns: ['id', '일자', '거래처코드', '거래처그룹1명', '구매처명', '창고명', '품목코드', '품목명', '단위', '규격_규격명', '수량', '중량', '단가', '공급가액', '합_계', '적요', '적요1', '적요2', '품목그룹1명', '품목그룹1코드', '품목그룹2명', '품목그룹3코드', 'imported_at']
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
  table1: 'sales',
  table2: 'company_type_auto',
  table3: 'company_type',
  table4: 'employee_category',
  table5: 'employees',
  table6: 'items',
  table7: 'warehouses',
  table8: 'clients',
  table9: 'user_data_embedding_metadata',
  table10: 'user_data_embeddings',
  table11: 'sync_activity_log',
  table12: 'sync_configurations',
  table13: 'user_data_files',
  table14: 'inventory_transfers',
  table15: 'internal_uses',
  table16: 'purchase_orders',
  table17: 'deposits',
  table18: 'promissory_notes',
  table19: 'product_mapping',
  table20: 'ledger',
  table21: 'pending_purchases',
  table22: 'pending_sales',
  table23: 'inventory',
  table24: 'purchases'
} as const;
