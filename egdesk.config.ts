/**
 * EGDesk User Data Configuration
 * Generated at: 2026-04-02T02:58:28.548Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: 'f820c40a-0f8c-45c5-b76a-c1bf4557815a',
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
    name: 'activity_generation_log',
    displayName: 'Activity Generation Log',
    description: undefined,
    rowCount: undefined,
    columnCount: 10,
    columns: ['id', 'eml_file_id', 'chat_room', 'start_date', 'end_date', 'status', 'activities_generated', 'error_message', 'started_at', 'completed_at']
  } as TableDefinition,
  table2: {
    name: 'drive_file_events',
    displayName: 'Drive File Events',
    description: 'Logs all Google Drive file change events',
    rowCount: 4,
    columnCount: 12,
    columns: ['id', 'file_id', 'file_name', 'mime_type', 'folder_id', 'event_type', 'modified_time', 'detected_at', 'downloaded', 'download_path', 'file_size', 'metadata']
  } as TableDefinition,
  table3: {
    name: 'drive_sync_state',
    displayName: 'Drive Sync State',
    description: 'Stores Google Drive sync state and watch channel info',
    rowCount: 1,
    columnCount: 8,
    columns: ['id', 'page_token', 'channel_id', 'channel_resource_id', 'channel_expiration', 'target_folder_ids', 'last_updated', 'created_at']
  } as TableDefinition,
  table4: {
    name: 'eml_processing_log',
    displayName: 'EML Processing Log',
    description: undefined,
    rowCount: 12,
    columnCount: 14,
    columns: ['id', 'file_id', 'file_name', 'chat_room', 'download_path', 'status', 'messages_found', 'messages_inserted', 'messages_duplicate', 'error_message', 'started_at', 'completed_at', 'deleted_from_drive', 'deleted_from_local']
  } as TableDefinition,
  table5: {
    name: 'west_division_purchases',
    displayName: '서부구매현황',
    description: undefined,
    rowCount: 7103,
    columnCount: 15,
    columns: ['id', '일자', '최초작성일자', '최종수정일시', '거래처코드', '창고코드', '품목코드', '수량', '중량', '공급가액', '합계', '적요', '적요1', '작성자', '최종수정자']
  } as TableDefinition,
  table6: {
    name: 'east_division_purchases',
    displayName: '동부구매현황',
    description: undefined,
    rowCount: 5325,
    columnCount: 14,
    columns: ['id', '일자', '최초작성일자', '최종수정일시', '거래처코드', '창고코드', '품목코드', '수량', '중량', '공급가액', '합계', '적요1', '작성자', '최종수정자']
  } as TableDefinition,
  table7: {
    name: 'disposed_inventory',
    displayName: '재고폐기',
    description: undefined,
    rowCount: 81,
    columnCount: 8,
    columns: ['id', '일자', '품목코드', '수량', '금액_수량_입고단가_', '적요', '창고명', '관리항목코드명']
  } as TableDefinition,
  table8: {
    name: 'shopping_sales',
    displayName: '쇼핑몰판매현황',
    description: undefined,
    rowCount: 1401,
    columnCount: 17,
    columns: ['id', '주문번호', '사업소', '담당자', '거래처', 'erp', '사업자번호', '주문상품', '용량', '수량', '주문금액', '총_주문금액', '사용한_포인트', '보유포인트', '결제한_금액', '결재_방법', '주문_날짜']
  } as TableDefinition,
  table9: {
    name: 'sales_profit',
    displayName: '월별이익현황',
    description: undefined,
    rowCount: 590,
    columnCount: 12,
    columns: ['id', '품목코드', '품목명', '판매수량', '판매단가', '판매금액', '원가단가', '원가금액', '이익단가', '이익금액', '이익율', 'imported_at']
  } as TableDefinition,
  table10: {
    name: 'pending_purchases',
    displayName: '미구매현황',
    description: undefined,
    rowCount: 92,
    columnCount: 12,
    columns: ['id', '일자', '품목코드', '수량', '잔량', '잔량_중량_', '단가', '합계', '납기일자', '거래처코드', '창고명', '품목별납기일자']
  } as TableDefinition,
  table11: {
    name: 'pending_sales',
    displayName: '미판매현황',
    description: undefined,
    rowCount: 22,
    columnCount: 12,
    columns: ['id', '일자', '품목코드', '거래처코드', '실납업체', '담당자코드', '수량', '잔량', '중량', '합계', '적요', '납기일자']
  } as TableDefinition,
  table12: {
    name: 'ar_baselines',
    displayName: '채권기초잔액',
    description: undefined,
    rowCount: 557,
    columnCount: 14,
    columns: ['id', 'manager_code', 'manager_name', 'client_code', 'client_name', 'total_ar', 'notes_receivable', 'ar_total', 'ar_feb', 'ar_jan', 'ar_dec', 'ar_nov', 'ar_others', 'baseline_date']
  } as TableDefinition,
  table13: {
    name: 'sales_goals',
    displayName: '매출목표',
    description: undefined,
    rowCount: 384,
    columnCount: 7,
    columns: ['id', 'year', 'month', 'goal_type', 'target_name', 'target_weight', 'target_amount']
  } as TableDefinition,
  table14: {
    name: 'west_division_sales',
    displayName: '서부판매현황',
    description: undefined,
    rowCount: 49926,
    columnCount: 19,
    columns: ['id', '일자', '최초작성일자', '최종수정일시', '작성자', '최종수정자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '합계', '창고코드', '신규일', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table15: {
    name: 'esz018r_6',
    displayName: 'esz018r 6',
    description: undefined,
    rowCount: 759,
    columnCount: 5,
    columns: ['id', '품목코드', '창고코드', '재고수량', '중량']
  } as TableDefinition,
  table16: {
    name: 'east_division_sales',
    displayName: '동부판매현황',
    description: undefined,
    rowCount: 37227,
    columnCount: 20,
    columns: ['id', '일자', '최초작성일자', '최종수정일시', '작성자', '최종수정자', '거래처코드', '담당자코드', '창고코드', '품목코드', '수량', '중량', '단가', '합계', '창고코드2', '신규일', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table17: {
    name: 'ledger',
    displayName: '계정별원장',
    description: 'Exact schema from 계정별원장-거래처코드포함2.xlsx',
    rowCount: 17876,
    columnCount: 13,
    columns: ['id', '일자', '최초작성일자', '최종수정일자', '어음만기일자', '거래유형', '적요', '계정코드', '거래처코드', '차변금액', '대변금액', '잔액', 'imported_at']
  } as TableDefinition,
  table18: {
    name: 'bank_accounts',
    displayName: '계좌리스트',
    description: undefined,
    rowCount: 56,
    columnCount: 8,
    columns: ['id', '계좌코드', '계좌명', '계정명_계정코드_', '검색창내용', '적요', '외화통장', '사용']
  } as TableDefinition,
  table19: {
    name: 'promissory_notes',
    displayName: '받을어음거래내역',
    description: undefined,
    rowCount: 156,
    columnCount: 13,
    columns: ['id', '일자', '증감구분', '어음번호', '거래처코드', '계정명', '부서명', '프로젝트명', '적요', '증가금액', '감소금액', '잔액', 'imported_at']
  } as TableDefinition,
  table20: {
    name: 'clients',
    displayName: '거래처리스트',
    description: '거래처리스트 (clients) table from CSV',
    rowCount: 10762,
    columnCount: 10,
    columns: ['id', '거래처코드', '거래처명', '거래처그룹1코드', '거래처그룹1명', '업종분류코드', '담당자코드', '지역코드', '신규일', 'imported_at']
  } as TableDefinition,
  table21: {
    name: 'purchase_orders',
    displayName: '발주서현황',
    description: undefined,
    rowCount: 1348,
    columnCount: 10,
    columns: ['id', '일자', '품목코드', '창고코드', '품목그룹1코드', '수량', '단가', '합계', '거래처코드', '적요']
  } as TableDefinition,
  table22: {
    name: 'purchases',
    displayName: '구매현황',
    description: undefined,
    rowCount: 141877,
    columnCount: 16,
    columns: ['id', '일자', '최초작성일자', '최종수정일시', '거래처코드', '창고코드', '품목코드', '수량', '중량', '공급가액', '합_계', '적요', '적요1', '작성자', '최종수정자', 'imported_at']
  } as TableDefinition,
  table23: {
    name: 'sales',
    displayName: '판매현황',
    description: undefined,
    rowCount: 677948,
    columnCount: 19,
    columns: ['id', '일자', '최초작성일자', '최종수정일시', '작성자', '최종수정자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '합계', '출하창고코드', '신규일', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table24: {
    name: 'employee_category',
    displayName: '사원분류',
    description: undefined,
    rowCount: 47,
    columnCount: 9,
    columns: ['id', '담당자', 'b2b팀', 'b2b사업소', 'b2b팀별담당', 'b2c_팀', 'b2c사업소', '전체사업소', 'imported_at']
  } as TableDefinition,
  table25: {
    name: 'employee_activity_log',
    displayName: '직원활동로그',
    description: 'Individual activities extracted from KakaoTalk messages',
    rowCount: 41668,
    columnCount: 16,
    columns: ['id', 'source_message_id', 'employee_name', 'activity_date', 'activity_type', 'activity_label', 'customer', 'location', 'products', 'outcome', 'issue_severity', 'action_taken', 'resolved_by', 'chat_room', 'extracted_at', 'confidence_score']
  } as TableDefinition,
  table26: {
    name: 'kakaotalk_raw_messages',
    displayName: '카카오톡원본메시지',
    description: 'Raw KakaoTalk messages with multi-line support',
    rowCount: 6116,
    columnCount: 5,
    columns: ['id', 'chat_room', 'chat_date', 'user_name', 'message']
  } as TableDefinition,
  table27: {
    name: 'company_type_auto',
    displayName: 'AUTO 업종분류기준',
    description: undefined,
    rowCount: 35,
    columnCount: 5,
    columns: ['id', '업종분류코드', '오토_대분류', '모빌_대시보드채널', '거래처그룹2']
  } as TableDefinition,
  table28: {
    name: 'company_type',
    displayName: '업종분류',
    description: undefined,
    rowCount: 116,
    columnCount: 7,
    columns: ['id', '업종분류코드', '모빌분류', '산업분류', '섹터분류', '영일분류', '비고']
  } as TableDefinition,
  table29: {
    name: 'employees',
    displayName: '사원',
    description: undefined,
    rowCount: 128,
    columnCount: 4,
    columns: ['id', '사원_담당_코드', '사원_담당_명', 'imported_at']
  } as TableDefinition,
  table30: {
    name: 'items',
    displayName: '품목',
    description: undefined,
    rowCount: 3317,
    columnCount: 12,
    columns: ['id', '품목코드', '품목그룹1코드', '품목그룹2코드', '품목그룹3코드', '품목명', '품목구분', '규격정보', '구분', '석유류', '제품군', 'imported_at']
  } as TableDefinition,
  table31: {
    name: 'warehouses',
    displayName: '창고',
    description: undefined,
    rowCount: 25,
    columnCount: 10,
    columns: ['id', '창고코드', '창고명', '계층그룹코드', '구분', '생산공정명', '외주거래처명', '사용', '추가사업장명', 'imported_at']
  } as TableDefinition,
  table32: {
    name: 'user_data_embedding_metadata',
    displayName: 'user_data_embedding_metadata',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 8,
    columns: ['id', 'table_id', 'column_name', 'total_embeddings', 'embedding_model', 'embedding_dimensions', 'last_updated', 'estimated_cost_usd']
  } as TableDefinition,
  table33: {
    name: 'user_data_embeddings',
    displayName: 'user_data_embeddings',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 9,
    columns: ['id', 'table_id', 'row_id', 'column_name', 'embedding_model', 'embedding_dimensions', 'embedding', 'created_at', 'updated_at']
  } as TableDefinition,
  table34: {
    name: 'sync_activity_log',
    displayName: 'sync_activity_log',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 12,
    columns: ['id', 'config_id', 'file_name', 'file_path', 'status', 'rows_imported', 'rows_skipped', 'duplicates_skipped', 'error_message', 'started_at', 'completed_at', 'duration_ms']
  } as TableDefinition,
  table35: {
    name: 'sync_configurations',
    displayName: 'sync_configurations',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: 11,
    columnCount: 23,
    columns: ['id', 'script_folder_path', 'script_name', 'folder_name', 'target_table_id', 'header_row', 'skip_bottom_rows', 'sheet_index', 'column_mappings', 'applied_splits', 'file_action', 'enabled', 'auto_sync_enabled', 'unique_key_columns', 'duplicate_action', 'last_sync_at', 'last_sync_status', 'last_sync_rows_imported', 'last_sync_rows_skipped', 'last_sync_duplicates', 'last_sync_error', 'created_at', 'updated_at']
  } as TableDefinition,
  table36: {
    name: 'user_data_files',
    displayName: 'user_data_files',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: undefined,
    columnCount: 15,
    columns: ['id', 'table_id', 'row_id', 'column_name', 'filename', 'mime_type', 'size_bytes', 'storage_type', 'file_data', 'file_path', 'is_compressed', 'compression_type', 'original_size', 'created_at', 'updated_at']
  } as TableDefinition,
  table37: {
    name: 'inventory_transfers',
    displayName: '창고이동현황',
    description: undefined,
    rowCount: 182,
    columnCount: 13,
    columns: ['id', '일자', '일자_번호', '출고창고명', '입고창고명', '품목명_규격', '수량', '중량', '금액_수량_입고단가', '품목그룹1코드', '품목그룹3코드', '적요', 'imported_at']
  } as TableDefinition,
  table38: {
    name: 'internal_uses',
    displayName: '자가사용현황',
    description: undefined,
    rowCount: 62,
    columnCount: 15,
    columns: ['id', '일자', '일자_번호', '사용유형', '적요', '품목코드', '품명_및_규격', '수량', '중량', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', 'imported_at']
  } as TableDefinition,
  table39: {
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
  table1: 'activity_generation_log',
  table2: 'drive_file_events',
  table3: 'drive_sync_state',
  table4: 'eml_processing_log',
  table5: 'west_division_purchases',
  table6: 'east_division_purchases',
  table7: 'disposed_inventory',
  table8: 'shopping_sales',
  table9: 'sales_profit',
  table10: 'pending_purchases',
  table11: 'pending_sales',
  table12: 'ar_baselines',
  table13: 'sales_goals',
  table14: 'west_division_sales',
  table15: 'esz018r_6',
  table16: 'east_division_sales',
  table17: 'ledger',
  table18: 'bank_accounts',
  table19: 'promissory_notes',
  table20: 'clients',
  table21: 'purchase_orders',
  table22: 'purchases',
  table23: 'sales',
  table24: 'employee_category',
  table25: 'employee_activity_log',
  table26: 'kakaotalk_raw_messages',
  table27: 'company_type_auto',
  table28: 'company_type',
  table29: 'employees',
  table30: 'items',
  table31: 'warehouses',
  table32: 'user_data_embedding_metadata',
  table33: 'user_data_embeddings',
  table34: 'sync_activity_log',
  table35: 'sync_configurations',
  table36: 'user_data_files',
  table37: 'inventory_transfers',
  table38: 'internal_uses',
  table39: 'inventory'
} as const;
