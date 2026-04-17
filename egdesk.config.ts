/**
 * EGDesk User Data Configuration
 * Generated at: 2026-04-17T00:51:45.156Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: undefined,
} as const;

export interface TableDefinition {
  name: string;
  displayName: string;
  description?: string;
  /** Omitted or unknown until synced / counted */
  rowCount?: number;
  columnCount: number;
  columns: string[];
}

export const TABLES = {
  table1: {
    name: 'user_data_embedding_metadata',
    displayName: 'user_data_embedding_metadata',
    description: 'Imported from user_database_export_2026-04-16.sql',
    columnCount: 8,
    columns: ['id', 'table_id', 'column_name', 'total_embeddings', 'embedding_model', 'embedding_dimensions', 'last_updated', 'estimated_cost_usd']
  } as TableDefinition,
  table2: {
    name: 'user_data_embeddings',
    displayName: 'user_data_embeddings',
    description: 'Imported from user_database_export_2026-04-16.sql',
    columnCount: 9,
    columns: ['id', 'table_id', 'row_id', 'column_name', 'embedding_model', 'embedding_dimensions', 'embedding', 'created_at', 'updated_at']
  } as TableDefinition,
  table3: {
    name: 'sync_activity_log',
    displayName: 'sync_activity_log',
    description: 'Imported from user_database_export_2026-04-16.sql',
    columnCount: 12,
    columns: ['id', 'config_id', 'file_name', 'file_path', 'status', 'rows_imported', 'rows_skipped', 'duplicates_skipped', 'error_message', 'started_at', 'completed_at', 'duration_ms']
  } as TableDefinition,
  table4: {
    name: 'sync_configurations',
    displayName: 'sync_configurations',
    description: 'Imported from user_database_export_2026-04-16.sql',
    rowCount: 8,
    columnCount: 23,
    columns: ['id', 'script_folder_path', 'script_name', 'folder_name', 'target_table_id', 'header_row', 'skip_bottom_rows', 'sheet_index', 'column_mappings', 'applied_splits', 'file_action', 'enabled', 'auto_sync_enabled', 'unique_key_columns', 'duplicate_action', 'last_sync_at', 'last_sync_status', 'last_sync_rows_imported', 'last_sync_rows_skipped', 'last_sync_duplicates', 'last_sync_error', 'created_at', 'updated_at']
  } as TableDefinition,
  table5: {
    name: 'team_display_order',
    displayName: '팀 노출 순서 (B2C/B2B)',
    description: 'B2C(b2c_팀) / B2B(b2b팀) 팀 표시 순서 — employee_category가 마스터',
    rowCount: 21,
    columnCount: 4,
    columns: ['id', 'scope', '팀', '노출순서']
  } as TableDefinition,
  table6: {
    name: 'employee_display_order',
    displayName: '팀 내 사원 노출 순서',
    description: '채널·팀별 담당자 표시 순서 — employee_category가 마스터',
    rowCount: 94,
    columnCount: 5,
    columns: ['id', 'scope', '팀', '담당자', '팀내_노출순서']
  } as TableDefinition,
  table7: {
    name: 'office_display_order',
    displayName: '사업소 노출 순서',
    description: '대시보드 내 사업소 표시 순서 관리',
    columnCount: 3,
    columns: ['id', '사업소', '노출순서']
  } as TableDefinition,
  table8: {
    name: 'clients',
    displayName: '거래처리스트',
    rowCount: 10793,
    columnCount: 9,
    columns: ['id', '거래처코드', '거래처명', '거래처그룹1코드', '거래처그룹1명', '업종분류코드', '담당자코드', '지역코드', '신규일']
  } as TableDefinition,
  table9: {
    name: 'east_division_purchases',
    displayName: '동부구매현황',
    rowCount: 4048,
    columnCount: 13,
    columns: ['id', '일자', '거래처코드', '창고코드', '품목코드', '수량', '단가', '중량', '공급가액', '합계', '적요', '적요1', 'imported_at']
  } as TableDefinition,
  table10: {
    name: 'east_division_sales',
    displayName: '동부판매현황',
    rowCount: 37827,
    columnCount: 15,
    columns: ['id', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table11: {
    name: 'west_division_purchases',
    displayName: '서부구매현황',
    rowCount: 4956,
    columnCount: 13,
    columns: ['id', '일자', '거래처코드', '창고코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '적요', '적요1', 'imported_at']
  } as TableDefinition,
  table12: {
    name: 'west_division_sales',
    displayName: '서부판매현황',
    rowCount: 49728,
    columnCount: 15,
    columns: ['id', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table13: {
    name: 'purchases',
    displayName: '구매현황',
    rowCount: 103085,
    columnCount: 13,
    columns: ['id', '일자', '거래처코드', '창고코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '적요', '적요1', 'imported_at']
  } as TableDefinition,
  table14: {
    name: 'sales',
    displayName: '판매현황',
    rowCount: 210379,
    columnCount: 15,
    columns: ['id', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table15: {
    name: 'sales_goals',
    displayName: '판매 목표',
    columnCount: 10,
    columns: ['id', 'year', 'month', 'employee_name', 'category_type', 'category', 'industry', 'sector', 'target_weight', 'target_amount']
  } as TableDefinition,
  table16: {
    name: 'disposed_inventory',
    displayName: '재고폐기',
    rowCount: 81,
    columnCount: 8,
    columns: ['id', '일자', '품목코드', '수량', '금액_수량_입고단가_', '적요', '창고명', '관리항목코드명']
  } as TableDefinition,
  table17: {
    name: 'shopping_sales',
    displayName: '쇼핑몰판매현황',
    rowCount: 1401,
    columnCount: 17,
    columns: ['id', '주문번호', '사업소', '담당자', '거래처', 'erp', '사업자번호', '주문상품', '용량', '수량', '주문금액', '총_주문금액', '사용한_포인트', '보유포인트', '결제한_금액', '결재_방법', '주문_날짜']
  } as TableDefinition,
  table18: {
    name: 'sales_profit',
    displayName: '월별이익현황',
    rowCount: 590,
    columnCount: 12,
    columns: ['id', '품목코드', '품목명', '판매수량', '판매단가', '판매금액', '원가단가', '원가금액', '이익단가', '이익금액', '이익율', 'imported_at']
  } as TableDefinition,
  table19: {
    name: 'pending_purchases',
    displayName: '미구매현황',
    rowCount: 92,
    columnCount: 12,
    columns: ['id', '일자', '품목코드', '수량', '잔량', '잔량_중량_', '단가', '합계', '납기일자', '거래처코드', '창고명', '품목별납기일자']
  } as TableDefinition,
  table20: {
    name: 'pending_sales',
    displayName: '미판매현황',
    rowCount: 22,
    columnCount: 12,
    columns: ['id', '일자', '품목코드', '거래처코드', '실납업체', '담당자코드', '수량', '잔량', '중량', '합계', '적요', '납기일자']
  } as TableDefinition,
  table21: {
    name: 'ar_baselines',
    displayName: '채권기초잔액',
    rowCount: 557,
    columnCount: 14,
    columns: ['id', 'manager_code', 'manager_name', 'client_code', 'client_name', 'total_ar', 'notes_receivable', 'ar_total', 'ar_feb', 'ar_jan', 'ar_dec', 'ar_nov', 'ar_others', 'baseline_date']
  } as TableDefinition,
  table22: {
    name: 'esz018r_6',
    displayName: 'esz018r 6',
    rowCount: 759,
    columnCount: 5,
    columns: ['id', '품목코드', '창고코드', '재고수량', '중량']
  } as TableDefinition,
  table23: {
    name: 'ledger',
    displayName: '계정별원장',
    description: 'Exact schema from 계정별원장-거래처코드포함2.xlsx',
    rowCount: 17876,
    columnCount: 13,
    columns: ['id', '일자', '최초작성일자', '최종수정일자', '어음만기일자', '거래유형', '적요', '계정코드', '거래처코드', '차변금액', '대변금액', '잔액', 'imported_at']
  } as TableDefinition,
  table24: {
    name: 'bank_accounts',
    displayName: '계좌리스트',
    rowCount: 56,
    columnCount: 8,
    columns: ['id', '계좌코드', '계좌명', '계정명_계정코드_', '검색창내용', '적요', '외화통장', '사용']
  } as TableDefinition,
  table25: {
    name: 'promissory_notes',
    displayName: '받을어음거래내역',
    rowCount: 156,
    columnCount: 13,
    columns: ['id', '일자', '증감구분', '어음번호', '거래처코드', '계정명', '부서명', '프로젝트명', '적요', '증가금액', '감소금액', '잔액', 'imported_at']
  } as TableDefinition,
  table26: {
    name: 'purchase_orders',
    displayName: '발주서현황',
    rowCount: 1348,
    columnCount: 10,
    columns: ['id', '일자', '품목코드', '창고코드', '품목그룹1코드', '수량', '단가', '합계', '거래처코드', '적요']
  } as TableDefinition,
  table27: {
    name: 'employee_category',
    displayName: '사원분류',
    rowCount: 47,
    columnCount: 9,
    columns: ['id', '담당자', 'b2b팀', 'b2b사업소', 'b2b팀별담당', 'b2c_팀', 'b2c사업소', '전체사업소', 'imported_at']
  } as TableDefinition,
  table28: {
    name: 'employee_activity_log',
    displayName: '직원활동로그',
    description: 'Individual activities extracted from KakaoTalk messages',
    rowCount: 41668,
    columnCount: 16,
    columns: ['id', 'source_message_id', 'employee_name', 'activity_date', 'activity_type', 'activity_label', 'customer', 'location', 'products', 'outcome', 'issue_severity', 'action_taken', 'resolved_by', 'chat_room', 'extracted_at', 'confidence_score']
  } as TableDefinition,
  table29: {
    name: 'kakaotalk_raw_messages',
    displayName: '카카오톡원본메시지',
    description: 'Raw KakaoTalk messages with multi-line support',
    rowCount: 6103,
    columnCount: 5,
    columns: ['id', 'chat_room', 'chat_date', 'user_name', 'message']
  } as TableDefinition,
  table30: {
    name: 'company_type_auto',
    displayName: 'AUTO 업종분류기준',
    rowCount: 35,
    columnCount: 5,
    columns: ['id', '업종분류코드', '오토_대분류', '모빌_대시보드채널', '거래처그룹2']
  } as TableDefinition,
  table31: {
    name: 'company_type',
    displayName: '업종분류',
    rowCount: 116,
    columnCount: 7,
    columns: ['id', '업종분류코드', '모빌분류', '산업분류', '섹터분류', '영일분류', '비고']
  } as TableDefinition,
  table32: {
    name: 'employees',
    displayName: '사원',
    rowCount: 128,
    columnCount: 4,
    columns: ['id', '사원_담당_코드', '사원_담당_명', 'imported_at']
  } as TableDefinition,
  table33: {
    name: 'items',
    displayName: '품목',
    rowCount: 3317,
    columnCount: 12,
    columns: ['id', '품목코드', '품목그룹1코드', '품목그룹2코드', '품목그룹3코드', '품목명', '품목구분', '규격정보', '구분', '석유류', '제품군', 'imported_at']
  } as TableDefinition,
  table34: {
    name: 'warehouses',
    displayName: '창고',
    rowCount: 25,
    columnCount: 10,
    columns: ['id', '창고코드', '창고명', '계층그룹코드', '구분', '생산공정명', '외주거래처명', '사용', '추가사업장명', 'imported_at']
  } as TableDefinition,
  table35: {
    name: 'user_data_files',
    displayName: 'user_data_files',
    description: 'Imported from user_database_export_2026-03-12.sql',
    columnCount: 15,
    columns: ['id', 'table_id', 'row_id', 'column_name', 'filename', 'mime_type', 'size_bytes', 'storage_type', 'file_data', 'file_path', 'is_compressed', 'compression_type', 'original_size', 'created_at', 'updated_at']
  } as TableDefinition,
  table36: {
    name: 'inventory_transfers',
    displayName: '창고이동현황',
    rowCount: 182,
    columnCount: 13,
    columns: ['id', '일자', '일자_번호', '출고창고명', '입고창고명', '품목명_규격', '수량', '중량', '금액_수량_입고단가', '품목그룹1코드', '품목그룹3코드', '적요', 'imported_at']
  } as TableDefinition,
  table37: {
    name: 'internal_uses',
    displayName: '자가사용현황',
    rowCount: 62,
    columnCount: 15,
    columns: ['id', '일자', '일자_번호', '사용유형', '적요', '품목코드', '품명_및_규격', '수량', '중량', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', 'imported_at']
  } as TableDefinition,
  table38: {
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
  table1: 'user_data_embedding_metadata',
  table2: 'user_data_embeddings',
  table3: 'sync_activity_log',
  table4: 'sync_configurations',
  table5: 'team_display_order',
  table6: 'employee_display_order',
  table7: 'office_display_order',
  table8: 'clients',
  table9: 'east_division_purchases',
  table10: 'east_division_sales',
  table11: 'west_division_purchases',
  table12: 'west_division_sales',
  table13: 'purchases',
  table14: 'sales',
  table15: 'sales_goals',
  table16: 'disposed_inventory',
  table17: 'shopping_sales',
  table18: 'sales_profit',
  table19: 'pending_purchases',
  table20: 'pending_sales',
  table21: 'ar_baselines',
  table22: 'esz018r_6',
  table23: 'ledger',
  table24: 'bank_accounts',
  table25: 'promissory_notes',
  table26: 'purchase_orders',
  table27: 'employee_category',
  table28: 'employee_activity_log',
  table29: 'kakaotalk_raw_messages',
  table30: 'company_type_auto',
  table31: 'company_type',
  table32: 'employees',
  table33: 'items',
  table34: 'warehouses',
  table35: 'user_data_files',
  table36: 'inventory_transfers',
  table37: 'internal_uses',
  table38: 'inventory'
} as const;
