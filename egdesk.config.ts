/**
 * EGDesk User Data Configuration
 * Generated at: 2026-03-22T08:56:43.071Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '901ff376-242e-417e-939a-120598b4e7c7',
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
    name: 'east_division_sales',
    displayName: '동부판매',
    description: undefined,
    rowCount: 2738,
    columnCount: 18,
    columns: ['id', '일자', '창고코드', '품목코드', '중량', '합계', '담당자코드', '거래처코드', '작성자', '최초작성일자', '최종수정자', '최종수정일시', '수량', '단가', '적요', '적요2', '신규일', '실납업체']
  } as TableDefinition,
  table2: {
    name: 'west_division_sales',
    displayName: '서부판매',
    description: undefined,
    rowCount: 5207,
    columnCount: 18,
    columns: ['id', '일자', '최초작성일자', '최종수정일시', '작성자', '최종수정자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '합계', '창고코드', '신규일', '적요', '적요2', '실납업체']
  } as TableDefinition,
  table3: {
    name: 'ledger',
    displayName: '계정별원장',
    description: 'Rebuilt from 계정별원장.csv (2026-03-22)',
    rowCount: 15842,
    columnCount: 8,
    columns: ['id', '일자', '적요', '계정명', '부서명', '차변금액', '대변금액', 'imported_at']
  } as TableDefinition,
  table4: {
    name: 'deposits',
    displayName: '입금보고서집계',
    description: undefined,
    rowCount: 1657,
    columnCount: 9,
    columns: ['id', '일자', '계정코드', '계좌', '계정명', '거래처코드', '적요', '금액', '수수료']
  } as TableDefinition,
  table5: {
    name: 'clients',
    displayName: '거래처리스트',
    description: '거래처리스트 (clients) table from CSV',
    rowCount: 10762,
    columnCount: 10,
    columns: ['id', '거래처코드', '거래처명', '거래처그룹1코드', '거래처그룹1명', '업종분류코드', '담당자코드', '지역코드', '신규일', 'imported_at']
  } as TableDefinition,
  table6: {
    name: 'purchase_orders',
    displayName: '발주서현황',
    description: undefined,
    rowCount: 1301,
    columnCount: 10,
    columns: ['id', '일자', '품목코드', '창고코드', '품목그룹1코드', '수량', '단가', '합계', '거래처코드', '적요']
  } as TableDefinition,
  table7: {
    name: 'purchases',
    displayName: '구매현황',
    description: undefined,
    rowCount: 3124,
    columnCount: 15,
    columns: ['id', '일자', '최초작성일자', '최종수정일시', '거래처코드', '창고코드', '품목코드', '수량', '중량', '공급가액', '합_계', '적요', '적요1', '작성자', '최종수정자']
  } as TableDefinition,
  table8: {
    name: 'sales',
    displayName: '판매현황',
    description: undefined,
    rowCount: 11554,
    columnCount: 18,
    columns: ['id', '일자', '최초작성일자', '최종수정일시', '작성자', '최종수정자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '합계', '출하창고코드', '신규일', '적요', '적요2', '실납업체']
  } as TableDefinition,
  table9: {
    name: 'employee_category',
    displayName: '사원분류',
    description: undefined,
    rowCount: 47,
    columnCount: 9,
    columns: ['id', '담당자', 'b2b팀', 'b2b사업소', 'b2b팀별담당', 'b2c_팀', 'b2c사업소', '전체사업소', 'imported_at']
  } as TableDefinition,
  table10: {
    name: 'south_division_purchases',
    displayName: '남부구매',
    description: 'South division purchases data',
    rowCount: 86,
    columnCount: 22,
    columns: ['id', '일자', '거래처코드', '거래처그룹1명', '구매처명', '창고명', '품목코드', '품목명', '단위', '규격_규격명', '수량', '중량', '단가', '공급가액', '합_계', '적요', '적요1', '적요2', '품목그룹1명', '품목그룹1코드', '품목그룹2명', '품목그룹3코드']
  } as TableDefinition,
  table11: {
    name: 'south_division_sales',
    displayName: '남부판매',
    description: 'South division sales data',
    rowCount: 994,
    columnCount: 18,
    columns: ['id', '일자', '거래처코드', '담당자명', '판매처명', '출하창고코드', '출하창고명', '품목코드', '품목명', '단위', '규격명', '수량', '중량', '단가', '공급가액', '부가세', '합계', 'imported_at']
  } as TableDefinition,
  table12: {
    name: 'west_division_purchases',
    displayName: '서부구매',
    description: '서부사업소 February 2026 purchase data (purchases schema)',
    rowCount: 161,
    columnCount: 22,
    columns: ['id', '일자', '거래처코드', '거래처그룹1명', '구매처명', '창고명', '품목코드', '품목명', '단위', '규격_규격명', '수량', '중량', '단가', '공급가액', '합_계', '적요', '적요1', '적요2', '품목그룹1명', '품목그룹1코드', '품목그룹2명', '품목그룹3코드']
  } as TableDefinition,
  table13: {
    name: 'east_division_purchases',
    displayName: '동부구매',
    description: '동부사업소 February 2026 purchase data (purchases schema)',
    rowCount: 139,
    columnCount: 22,
    columns: ['id', '일자', '거래처코드', '거래처그룹1명', '구매처명', '창고명', '품목코드', '품목명', '단위', '규격_규격명', '수량', '중량', '단가', '공급가액', '합_계', '적요', '적요1', '적요2', '품목그룹1명', '품목그룹1코드', '품목그룹2명', '품목그룹3코드']
  } as TableDefinition,
  table14: {
    name: 'employee_activity_log',
    displayName: '직원활동로그',
    description: 'Individual activities extracted from KakaoTalk messages',
    rowCount: 9496,
    columnCount: 16,
    columns: ['id', 'source_message_id', 'employee_name', 'activity_date', 'activity_type', 'activity_label', 'customer', 'location', 'products', 'outcome', 'issue_severity', 'action_taken', 'resolved_by', 'chat_room', 'extracted_at', 'confidence_score']
  } as TableDefinition,
  table15: {
    name: 'kakaotalk_raw_messages',
    displayName: '카카오톡원본메시지',
    description: 'Raw KakaoTalk messages with multi-line support',
    rowCount: 6103,
    columnCount: 5,
    columns: ['id', 'chat_room', 'chat_date', 'user_name', 'message']
  } as TableDefinition,
  table16: {
    name: 'company_type_auto',
    displayName: 'AUTO 업종분류기준',
    description: undefined,
    rowCount: 35,
    columnCount: 5,
    columns: ['id', '업종분류코드', '오토_대분류', '모빌_대시보드채널', '거래처그룹2']
  } as TableDefinition,
  table17: {
    name: 'company_type',
    displayName: '업종분류',
    description: undefined,
    rowCount: 116,
    columnCount: 7,
    columns: ['id', '업종분류코드', '모빌분류', '산업분류', '섹터분류', '영일분류', '비고']
  } as TableDefinition,
  table18: {
    name: 'employees',
    displayName: '사원',
    description: undefined,
    rowCount: 127,
    columnCount: 4,
    columns: ['id', '사원_담당_코드', '사원_담당_명', 'imported_at']
  } as TableDefinition,
  table19: {
    name: 'items',
    displayName: '품목',
    description: undefined,
    rowCount: 3317,
    columnCount: 12,
    columns: ['id', '품목코드', '품목그룹1코드', '품목그룹2코드', '품목그룹3코드', '품목명', '품목구분', '규격정보', '구분', '석유류', '제품군', 'imported_at']
  } as TableDefinition,
  table20: {
    name: 'warehouses',
    displayName: '창고',
    description: undefined,
    rowCount: 25,
    columnCount: 10,
    columns: ['id', '창고코드', '창고명', '계층그룹코드', '구분', '생산공정명', '외주거래처명', '사용', '추가사업장명', 'imported_at']
  } as TableDefinition,
  table21: {
    name: 'user_data_embedding_metadata',
    displayName: 'user_data_embedding_metadata',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 8,
    columns: ['id', 'table_id', 'column_name', 'total_embeddings', 'embedding_model', 'embedding_dimensions', 'last_updated', 'estimated_cost_usd']
  } as TableDefinition,
  table22: {
    name: 'user_data_embeddings',
    displayName: 'user_data_embeddings',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 9,
    columns: ['id', 'table_id', 'row_id', 'column_name', 'embedding_model', 'embedding_dimensions', 'embedding', 'created_at', 'updated_at']
  } as TableDefinition,
  table23: {
    name: 'sync_activity_log',
    displayName: 'sync_activity_log',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 12,
    columns: ['id', 'config_id', 'file_name', 'file_path', 'status', 'rows_imported', 'rows_skipped', 'duplicates_skipped', 'error_message', 'started_at', 'completed_at', 'duration_ms']
  } as TableDefinition,
  table24: {
    name: 'sync_configurations',
    displayName: 'sync_configurations',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: 11,
    columnCount: 23,
    columns: ['id', 'script_folder_path', 'script_name', 'folder_name', 'target_table_id', 'header_row', 'skip_bottom_rows', 'sheet_index', 'column_mappings', 'applied_splits', 'file_action', 'enabled', 'auto_sync_enabled', 'unique_key_columns', 'duplicate_action', 'last_sync_at', 'last_sync_status', 'last_sync_rows_imported', 'last_sync_rows_skipped', 'last_sync_duplicates', 'last_sync_error', 'created_at', 'updated_at']
  } as TableDefinition,
  table25: {
    name: 'user_data_files',
    displayName: 'user_data_files',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 15,
    columns: ['id', 'table_id', 'row_id', 'column_name', 'filename', 'mime_type', 'size_bytes', 'storage_type', 'file_data', 'file_path', 'is_compressed', 'compression_type', 'original_size', 'created_at', 'updated_at']
  } as TableDefinition,
  table26: {
    name: 'inventory_transfers',
    displayName: '창고이동현황',
    description: undefined,
    rowCount: 138,
    columnCount: 13,
    columns: ['id', '일자', '일자_번호', '출고창고명', '입고창고명', '품목명_규격', '수량', '중량', '금액_수량_입고단가', '품목그룹1코드', '품목그룹3코드', '적요', 'imported_at']
  } as TableDefinition,
  table27: {
    name: 'internal_uses',
    displayName: '자가사용현황',
    description: undefined,
    rowCount: 53,
    columnCount: 15,
    columns: ['id', '일자', '일자_번호', '사용유형', '적요', '품목코드', '품명_및_규격', '수량', '중량', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', 'imported_at']
  } as TableDefinition,
  table28: {
    name: 'promissory_notes',
    displayName: '받을어음거래내역',
    description: undefined,
    rowCount: 187,
    columnCount: 13,
    columns: ['id', '일자', '증감구분', '어음번호', '거래처명', '계정명', '부서명', '프로젝트명', '적요', '증가금액', '감소금액', '잔액', 'imported_at']
  } as TableDefinition,
  table29: {
    name: 'pending_purchases',
    displayName: '미구매현황',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 미구매현황(pending_purchases)',
    rowCount: 155,
    columnCount: 20,
    columns: ['id', '월_일', '품목코드', '품명_및_규격', '수량', '잔량', '잔량_중량_', '미구매공급가액', '미구매부가세', '합계', '납기일자', '거래처명', '품목그룹1명', '창고명', '품목별납기일자', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table30: {
    name: 'pending_sales',
    displayName: '미판매현황',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 미판매현황(pending_sales)',
    rowCount: 15,
    columnCount: 15,
    columns: ['id', '월_일', '품목코드', '품명_및_규격', '수량', '잔량', '공급가액', '거래처명', '적요', '납기일자', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table31: {
    name: 'inventory',
    displayName: '창고별재고',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 창고별재고(inventory)',
    rowCount: 54815,
    columnCount: 7,
    columns: ['id', '품목코드', '품목명_규격_', '창고코드', '창고명', '재고수량', 'imported_at']
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
  table1: 'east_division_sales',
  table2: 'west_division_sales',
  table3: 'ledger',
  table4: 'deposits',
  table5: 'clients',
  table6: 'purchase_orders',
  table7: 'purchases',
  table8: 'sales',
  table9: 'employee_category',
  table10: 'south_division_purchases',
  table11: 'south_division_sales',
  table12: 'west_division_purchases',
  table13: 'east_division_purchases',
  table14: 'employee_activity_log',
  table15: 'kakaotalk_raw_messages',
  table16: 'company_type_auto',
  table17: 'company_type',
  table18: 'employees',
  table19: 'items',
  table20: 'warehouses',
  table21: 'user_data_embedding_metadata',
  table22: 'user_data_embeddings',
  table23: 'sync_activity_log',
  table24: 'sync_configurations',
  table25: 'user_data_files',
  table26: 'inventory_transfers',
  table27: 'internal_uses',
  table28: 'promissory_notes',
  table29: 'pending_purchases',
  table30: 'pending_sales',
  table31: 'inventory'
} as const;
