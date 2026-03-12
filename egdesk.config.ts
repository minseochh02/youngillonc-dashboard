/**
 * EGDesk User Data Configuration
 * Generated at: 2026-03-11T00:34:15.342Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '094f130f-d99e-4dc9-9e33-063703718b43',
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
    name: 'inventory_transfers',
    displayName: '창고이동현황',
    description: undefined,
    rowCount: 122,
    columnCount: 13,
    columns: ['id', '일자', '일자_번호', '출고창고명', '입고창고명', '품목명_규격', '수량', '중량', '금액_수량_입고단가', '품목그룹1코드', '품목그룹3코드', '적요', 'imported_at']
  } as TableDefinition,
  table2: {
    name: 'internal_uses',
    displayName: '자가사용현황',
    description: undefined,
    rowCount: 51,
    columnCount: 15,
    columns: ['id', '일자', '일자_번호', '사용유형', '적요', '품목코드', '품명_및_규격', '수량', '중량', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', 'imported_at']
  } as TableDefinition,
  table3: {
    name: 'kakaotalk_egdesk_pm',
    displayName: 'kakaotalk_egdesk_pm',
    description: 'Imported from kakaotalk-import.sql',
    rowCount: 905,
    columnCount: 4,
    columns: ['id', 'chat_date', 'user_name', 'message']
  } as TableDefinition,
  table4: {
    name: 'user_data_embedding_metadata',
    displayName: 'user_data_embedding_metadata',
    description: 'Imported from kakaotalk-import.sql',
    rowCount: undefined,
    columnCount: 8,
    columns: ['id', 'table_id', 'column_name', 'total_embeddings', 'embedding_model', 'embedding_dimensions', 'last_updated', 'estimated_cost_usd']
  } as TableDefinition,
  table5: {
    name: 'user_data_embeddings',
    displayName: 'user_data_embeddings',
    description: 'Imported from kakaotalk-import.sql',
    rowCount: undefined,
    columnCount: 9,
    columns: ['id', 'table_id', 'row_id', 'column_name', 'embedding_model', 'embedding_dimensions', 'embedding', 'created_at', 'updated_at']
  } as TableDefinition,
  table6: {
    name: 'sync_activity_log',
    displayName: 'sync_activity_log',
    description: 'Imported from kakaotalk-import.sql',
    rowCount: undefined,
    columnCount: 12,
    columns: ['id', 'config_id', 'file_name', 'file_path', 'status', 'rows_imported', 'rows_skipped', 'duplicates_skipped', 'error_message', 'started_at', 'completed_at', 'duration_ms']
  } as TableDefinition,
  table7: {
    name: 'sync_configurations',
    displayName: 'sync_configurations',
    description: 'Imported from kakaotalk-import.sql',
    rowCount: undefined,
    columnCount: 22,
    columns: ['id', 'script_folder_path', 'script_name', 'folder_name', 'target_table_id', 'header_row', 'skip_bottom_rows', 'sheet_index', 'column_mappings', 'file_action', 'enabled', 'auto_sync_enabled', 'unique_key_columns', 'duplicate_action', 'last_sync_at', 'last_sync_status', 'last_sync_rows_imported', 'last_sync_rows_skipped', 'last_sync_duplicates', 'last_sync_error', 'created_at', 'updated_at']
  } as TableDefinition,
  table8: {
    name: 'import_operations',
    displayName: 'import_operations',
    description: 'Imported from kakaotalk-import.sql',
    rowCount: 12,
    columnCount: 9,
    columns: ['id', 'table_id', 'file_name', 'status', 'started_at', 'completed_at', 'rows_imported', 'rows_skipped', 'error_message']
  } as TableDefinition,
  table9: {
    name: 'purchase_orders',
    displayName: '발주서현황',
    description: undefined,
    rowCount: 1122,
    columnCount: 15,
    columns: ['id', '월_일', '월_일_번호', '품명_및_규격', '품목그룹1코드', '수량', '단가', '공급가액', '부가세', '합계', '거래처명', '적요', '창고명', '품목그룹1명', 'imported_at']
  } as TableDefinition,
  table10: {
    name: 'deposits',
    displayName: '입금보고서집계',
    description: undefined,
    rowCount: 1410,
    columnCount: 17,
    columns: ['id', '전표번호', '전표번호_번호', '계좌', '돈들어온계좌번호', '계정명', '부서명', '거래처코드', '거래처명', '적요', '금액', '수수료', '담당자명', '프로젝트명', '세무신고거래처', '대표자명', 'imported_at']
  } as TableDefinition,
  table11: {
    name: 'promissory_notes',
    displayName: '받을어음거래내역',
    description: undefined,
    rowCount: 157,
    columnCount: 13,
    columns: ['id', '일자', '증감구분', '어음번호', '거래처명', '계정명', '부서명', '프로젝트명', '적요', '증가금액', '감소금액', '잔액', 'imported_at']
  } as TableDefinition,
  table12: {
    name: 'product_mapping',
    displayName: '품목코드매핑',
    description: 'Product code mapping table for inventory categorization',
    rowCount: 709,
    columnCount: 8,
    columns: ['id', '품목코드', '품목명', '품목그룹1코드', '품목그룹1명', '품목그룹2명', '품목그룹3코드', 'last_seen_date']
  } as TableDefinition,
  table13: {
    name: 'vpso3wu1if6yi7eo',
    displayName: 'vpso3wu1if6yi7eo',
    description: undefined,
    rowCount: 6911,
    columnCount: 8,
    columns: ['id', '일자_no_', '일자_no__번호', '적요', '거래처명', '차변금액', '대변금액', '잔액']
  } as TableDefinition,
  table14: {
    name: 'sales',
    displayName: '판매현황',
    description: undefined,
    rowCount: 14496,
    columnCount: 27,
    columns: ['id', '일자', '거래처그룹1코드명', '세무신고거래처코드', '거래처코드', '담당자코드명', '판매처명', '품목코드', '품목명_규격_', '단위', '규격명', '수량', '중량', '단가', '공급가액', '합_계', '품목그룹1코드', '품목그룹2명', '품목그룹3코드', '창고명', '거래처그룹2명', '신규일', '적요', '적요2', '코드변경', '실납업체', 'imported_at']
  } as TableDefinition,
  table15: {
    name: 'ledger',
    displayName: '계정별원장',
    description: 'Rebuilt from CSV with proper date formatting',
    rowCount: 20209,
    columnCount: 18,
    columns: ['id', '일자', '일자_no', '적요', '계정코드', '계정명', '거래처명', '거래처코드', '부서명', '담당자코드', '차변금액', '대변금액', '잔액', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table16: {
    name: 'pending_purchases',
    displayName: '미구매현황',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 미구매현황(pending_purchases)',
    rowCount: 221,
    columnCount: 20,
    columns: ['id', '월_일', '품목코드', '품명_및_규격', '수량', '잔량', '잔량_중량_', '미구매공급가액', '미구매부가세', '합계', '납기일자', '거래처명', '품목그룹1명', '창고명', '품목별납기일자', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table17: {
    name: 'pending_sales',
    displayName: '미판매현황',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 미판매현황(pending_sales)',
    rowCount: 12,
    columnCount: 15,
    columns: ['id', '월_일', '품목코드', '품명_및_규격', '수량', '잔량', '공급가액', '거래처명', '적요', '납기일자', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table18: {
    name: 'inventory',
    displayName: '창고별재고',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 창고별재고(inventory)',
    rowCount: 54026,
    columnCount: 7,
    columns: ['id', '품목코드', '품목명_규격_', '창고코드', '창고명', '재고수량', 'imported_at']
  } as TableDefinition,
  table19: {
    name: 'purchases',
    displayName: '구매현황',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 구매현황(purchases)',
    rowCount: 4918,
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
  table1: 'inventory_transfers',
  table2: 'internal_uses',
  table3: 'kakaotalk_egdesk_pm',
  table4: 'user_data_embedding_metadata',
  table5: 'user_data_embeddings',
  table6: 'sync_activity_log',
  table7: 'sync_configurations',
  table8: 'import_operations',
  table9: 'purchase_orders',
  table10: 'deposits',
  table11: 'promissory_notes',
  table12: 'product_mapping',
  table13: 'vpso3wu1if6yi7eo',
  table14: 'sales',
  table15: 'ledger',
  table16: 'pending_purchases',
  table17: 'pending_sales',
  table18: 'inventory',
  table19: 'purchases'
} as const;
