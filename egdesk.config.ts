/**
 * EGDesk User Data Configuration
 * Generated at: 2026-06-11T04:52:17.056Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '44c9e9ba-d732-42c1-9ad5-d0344ee1705c',
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
    name: 'sales_goals',
    displayName: '판매 목표',
    description: 'Client-level monthly sales targets (one goal per client per month)',
    rowCount: 2781,
    columnCount: 6,
    columns: ['id', 'year', 'month', 'client_code', 'target_weight', 'target_amount']
  } as TableDefinition,
  table2: {
    name: 'sales_goals_client_category_backup',
    displayName: '판매 목표 (카테고리 분할 백업)',
    description: 'Client-level sales targets by month and product category slice',
    rowCount: 4441,
    columnCount: 10,
    columns: ['id', 'year', 'month', 'client_code', 'category_type', 'category', 'industry', 'sector', 'target_weight', 'target_amount']
  } as TableDefinition,
  table3: {
    name: 'sync_activity_log',
    displayName: 'sync_activity_log',
    description: 'Imported from user_database_export_2026-06-05.sql',
    rowCount: 0,
    columnCount: 12,
    columns: ['id', 'config_id', 'file_name', 'file_path', 'status', 'rows_imported', 'rows_skipped', 'duplicates_skipped', 'error_message', 'started_at', 'completed_at', 'duration_ms']
  } as TableDefinition,
  table4: {
    name: 'sync_configurations',
    displayName: 'sync_configurations',
    description: 'Imported from user_database_export_2026-06-05.sql',
    rowCount: 17,
    columnCount: 24,
    columns: ['id', 'script_folder_path', 'script_name', 'folder_name', 'target_table_id', 'header_row', 'skip_bottom_rows', 'sheet_index', 'column_mappings', 'applied_splits', 'file_action', 'enabled', 'auto_sync_enabled', 'unique_key_columns', 'duplicate_action', 'last_sync_at', 'last_sync_status', 'last_sync_rows_imported', 'last_sync_rows_skipped', 'last_sync_duplicates', 'last_sync_error', 'created_at', 'updated_at', 'source']
  } as TableDefinition,
  table5: {
    name: 'drive_file_events',
    displayName: 'Drive File Events',
    description: 'Logs all Google Drive file change events',
    rowCount: 0,
    columnCount: 12,
    columns: ['id', 'file_id', 'file_name', 'mime_type', 'folder_id', 'event_type', 'modified_time', 'detected_at', 'downloaded', 'download_path', 'file_size', 'metadata']
  } as TableDefinition,
  table6: {
    name: 'drive_sync_state',
    displayName: 'Drive Sync State',
    description: 'Stores Google Drive sync state and watch channel info',
    rowCount: 1,
    columnCount: 8,
    columns: ['id', 'page_token', 'channel_id', 'channel_resource_id', 'channel_expiration', 'target_folder_ids', 'last_updated', 'created_at']
  } as TableDefinition,
  table7: {
    name: 'west_internal_uses',
    displayName: '서부자가사용현황',
    rowCount: 6,
    columnCount: 18,
    columns: ['id', '월_일', '월_일_번호', '사용유형', '적요', '품목코드', '품목명', '수량', '사용자지정_숫자형_1', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', '회사명', '기간', '계정코드_메타', '계정명_메타']
  } as TableDefinition,
  table8: {
    name: 'east_disposed_inventory',
    displayName: '동부페기재고',
    rowCount: 5,
    columnCount: 9,
    columns: ['id', '일자', '품목코드', '수량', '중량', '금액_수량_입고단가_', '적요', '창고코드', '관리항목코드']
  } as TableDefinition,
  table9: {
    name: 'east_internal_uses',
    displayName: '동부자가사용',
    rowCount: 222,
    columnCount: 14,
    columns: ['id', '월_일', '월_일_번호', '사용유형', '적요', '품목코드', '품목명', '수량', '사용자지정_숫자형_1', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드']
  } as TableDefinition,
  table10: {
    name: 'computed_inventory_monthly',
    displayName: 'computed 재고(월말)',
    description: '카테고리별 월말 계산재고 (스냅샷 기반)',
    rowCount: 812,
    columnCount: 13,
    columns: ['id', 'month', 'month_end_date', 'category', 'purchase_weight', 'sales_weight', 'internal_use_weight', 'disposed_weight', 'net_weight', 'inventory_weight', 'snapshot_month', 'snapshot_date', 'computed_at']
  } as TableDefinition,
  table11: {
    name: 'clients',
    displayName: '거래처리스트',
    rowCount: 10820,
    columnCount: 9,
    columns: ['id', '거래처코드', '거래처명', '거래처그룹1코드', '거래처그룹1명', '업종분류코드', '담당자코드', '지역코드', '신규일']
  } as TableDefinition,
  table12: {
    name: 'east_inventory_20251231',
    displayName: '동부재고 20251231스냅샷',
    description: '동부 ESZ018R 스냅샷',
    rowCount: 317,
    columnCount: 7,
    columns: ['id', '품목코드', '창고코드', '재고수량', '중량', '총중량', 'imported_at']
  } as TableDefinition,
  table13: {
    name: 'west_inventory_20251231',
    displayName: '서부재고 20251231스냅샷',
    description: '서부 ESZ018R 스냅샷',
    rowCount: 371,
    columnCount: 7,
    columns: ['id', '품목코드', '창고코드', '재고수량', '중량', '총중량', 'imported_at']
  } as TableDefinition,
  table14: {
    name: 'youngil_inventory_20251231',
    displayName: '영일재고 20251231스냅샷',
    description: '본사 ESZ018R 스냅샷',
    rowCount: 769,
    columnCount: 7,
    columns: ['id', '품목코드', '창고코드', '재고수량', '중량', '총중량', 'imported_at']
  } as TableDefinition,
  table15: {
    name: 'team_display_order',
    displayName: '팀 노출 순서 (B2C/B2B)',
    description: 'B2C(b2c_팀) / B2B(b2b팀) 팀 표시 순서 — employee_category가 마스터',
    rowCount: 19,
    columnCount: 4,
    columns: ['id', 'scope', '팀', '노출순서']
  } as TableDefinition,
  table16: {
    name: 'employee_display_order',
    displayName: '팀 내 사원 노출 순서',
    description: '채널·팀별 담당자 표시 순서 — employee_category가 마스터',
    rowCount: 98,
    columnCount: 5,
    columns: ['id', 'scope', '팀', '담당자', '팀내_노출순서']
  } as TableDefinition,
  table17: {
    name: 'office_display_order',
    displayName: '사업소 노출 순서',
    description: '대시보드 내 사업소 표시 순서 관리',
    rowCount: 9,
    columnCount: 3,
    columns: ['id', '사업소', '노출순서']
  } as TableDefinition,
  table18: {
    name: 'east_division_purchases',
    displayName: '동부구매현황',
    rowCount: 5587,
    columnCount: 13,
    columns: ['id', '일자', '거래처코드', '창고코드', '품목코드', '수량', '단가', '중량', '공급가액', '합계', '적요', '적요1', 'imported_at']
  } as TableDefinition,
  table19: {
    name: 'east_division_sales',
    displayName: '동부판매현황',
    rowCount: 40714,
    columnCount: 15,
    columns: ['id', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table20: {
    name: 'west_division_purchases',
    displayName: '서부구매현황',
    rowCount: 7396,
    columnCount: 13,
    columns: ['id', '일자', '거래처코드', '창고코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '적요', '적요1', 'imported_at']
  } as TableDefinition,
  table21: {
    name: 'west_division_sales',
    displayName: '서부판매현황',
    rowCount: 53089,
    columnCount: 15,
    columns: ['id', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table22: {
    name: 'purchases',
    displayName: '구매현황',
    rowCount: 129558,
    columnCount: 13,
    columns: ['id', '일자', '거래처코드', '창고코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '적요', '적요1', 'imported_at']
  } as TableDefinition,
  table23: {
    name: 'sales',
    displayName: '판매현황',
    rowCount: 609441,
    columnCount: 15,
    columns: ['id', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table24: {
    name: 'sales_goals_employee_backup',
    displayName: '판매 목표 (담당자 기준 백업)',
    rowCount: 238,
    columnCount: 10,
    columns: ['id', 'year', 'month', 'employee_name', 'category_type', 'category', 'industry', 'sector', 'target_weight', 'target_amount']
  } as TableDefinition,
  table25: {
    name: 'disposed_inventory',
    displayName: '재고폐기',
    rowCount: 83,
    columnCount: 8,
    columns: ['id', '일자', '품목코드', '수량', '금액_수량_입고단가_', '적요', '창고명', '관리항목코드명']
  } as TableDefinition,
  table26: {
    name: 'shopping_sales',
    displayName: '쇼핑몰판매현황',
    rowCount: 1401,
    columnCount: 17,
    columns: ['id', '주문번호', '사업소', '담당자', '거래처', 'erp', '사업자번호', '주문상품', '용량', '수량', '주문금액', '총_주문금액', '사용한_포인트', '보유포인트', '결제한_금액', '결재_방법', '주문_날짜']
  } as TableDefinition,
  table27: {
    name: 'sales_profit',
    displayName: '월별이익현황',
    rowCount: 590,
    columnCount: 12,
    columns: ['id', '품목코드', '품목명', '판매수량', '판매단가', '판매금액', '원가단가', '원가금액', '이익단가', '이익금액', '이익율', 'imported_at']
  } as TableDefinition,
  table28: {
    name: 'pending_purchases',
    displayName: '미구매현황',
    rowCount: 113,
    columnCount: 12,
    columns: ['id', '일자', '품목코드', '수량', '잔량', '잔량_중량_', '단가', '합계', '납기일자', '거래처코드', '창고명', '품목별납기일자']
  } as TableDefinition,
  table29: {
    name: 'pending_sales',
    displayName: '미판매현황',
    rowCount: 22,
    columnCount: 12,
    columns: ['id', '일자', '품목코드', '거래처코드', '실납업체', '담당자코드', '수량', '잔량', '중량', '합계', '적요', '납기일자']
  } as TableDefinition,
  table30: {
    name: 'ar_baselines',
    displayName: '채권기초잔액',
    rowCount: 557,
    columnCount: 14,
    columns: ['id', 'manager_code', 'manager_name', 'client_code', 'client_name', 'total_ar', 'notes_receivable', 'ar_total', 'ar_feb', 'ar_jan', 'ar_dec', 'ar_nov', 'ar_others', 'baseline_date']
  } as TableDefinition,
  table31: {
    name: 'ledger',
    displayName: '계정별원장',
    description: 'Exact schema from 계정별원장-거래처코드포함2.xlsx',
    rowCount: 30660,
    columnCount: 13,
    columns: ['id', '일자', '최초작성일자', '최종수정일자', '어음만기일자', '거래유형', '적요', '계정코드', '거래처코드', '차변금액', '대변금액', '잔액', 'imported_at']
  } as TableDefinition,
  table32: {
    name: 'bank_accounts',
    displayName: '계좌리스트',
    rowCount: 56,
    columnCount: 8,
    columns: ['id', '계좌코드', '계좌명', '계정명_계정코드_', '검색창내용', '적요', '외화통장', '사용']
  } as TableDefinition,
  table33: {
    name: 'promissory_notes',
    displayName: '받을어음거래내역',
    rowCount: 369,
    columnCount: 13,
    columns: ['id', '일자', '증감구분', '어음번호', '거래처코드', '계정명', '부서명', '프로젝트명', '적요', '증가금액', '감소금액', '잔액', 'imported_at']
  } as TableDefinition,
  table34: {
    name: 'purchase_orders',
    displayName: '발주서현황',
    rowCount: 2815,
    columnCount: 10,
    columns: ['id', '일자', '품목코드', '창고코드', '품목그룹1코드', '수량', '단가', '합계', '거래처코드', '적요']
  } as TableDefinition,
  table35: {
    name: 'employee_category',
    displayName: '사원분류',
    rowCount: 47,
    columnCount: 9,
    columns: ['id', '담당자', 'b2b팀', 'b2b사업소', 'b2b팀별담당', 'b2c_팀', 'b2c사업소', '전체사업소', 'imported_at']
  } as TableDefinition,
  table36: {
    name: 'employee_activity_log',
    displayName: '직원활동로그',
    description: 'Individual activities extracted from KakaoTalk messages',
    rowCount: 41668,
    columnCount: 16,
    columns: ['id', 'source_message_id', 'employee_name', 'activity_date', 'activity_type', 'activity_label', 'customer', 'location', 'products', 'outcome', 'issue_severity', 'action_taken', 'resolved_by', 'chat_room', 'extracted_at', 'confidence_score']
  } as TableDefinition,
  table37: {
    name: 'kakaotalk_raw_messages',
    displayName: '카카오톡원본메시지',
    description: 'Raw KakaoTalk messages with multi-line support',
    rowCount: 6103,
    columnCount: 5,
    columns: ['id', 'chat_room', 'chat_date', 'user_name', 'message']
  } as TableDefinition,
  table38: {
    name: 'company_type_auto',
    displayName: 'AUTO 업종분류기준',
    rowCount: 35,
    columnCount: 5,
    columns: ['id', '업종분류코드', '오토_대분류', '모빌_대시보드채널', '거래처그룹2']
  } as TableDefinition,
  table39: {
    name: 'company_type',
    displayName: '업종분류',
    rowCount: 116,
    columnCount: 7,
    columns: ['id', '업종분류코드', '모빌분류', '산업분류', '섹터분류', '영일분류', '비고']
  } as TableDefinition,
  table40: {
    name: 'employees',
    displayName: '사원',
    rowCount: 128,
    columnCount: 4,
    columns: ['id', '사원_담당_코드', '사원_담당_명', 'imported_at']
  } as TableDefinition,
  table41: {
    name: 'items',
    displayName: '품목',
    rowCount: 3317,
    columnCount: 12,
    columns: ['id', '품목코드', '품목그룹1코드', '품목그룹2코드', '품목그룹3코드', '품목명', '품목구분', '규격정보', '구분', '석유류', '제품군', 'imported_at']
  } as TableDefinition,
  table42: {
    name: 'warehouses',
    displayName: '창고',
    rowCount: 25,
    columnCount: 10,
    columns: ['id', '창고코드', '창고명', '계층그룹코드', '구분', '생산공정명', '외주거래처명', '사용', '추가사업장명', 'imported_at']
  } as TableDefinition,
  table43: {
    name: 'user_data_files',
    displayName: 'user_data_files',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: 0,
    columnCount: 15,
    columns: ['id', 'table_id', 'row_id', 'column_name', 'filename', 'mime_type', 'size_bytes', 'storage_type', 'file_data', 'file_path', 'is_compressed', 'compression_type', 'original_size', 'created_at', 'updated_at']
  } as TableDefinition,
  table44: {
    name: 'inventory_transfers',
    displayName: '창고이동현황',
    rowCount: 301,
    columnCount: 13,
    columns: ['id', '일자', '일자_번호', '출고창고명', '입고창고명', '품목명_규격', '수량', '중량', '금액_수량_입고단가', '품목그룹1코드', '품목그룹3코드', '적요', 'imported_at']
  } as TableDefinition,
  table45: {
    name: 'internal_uses',
    displayName: '자가사용현황',
    rowCount: 99,
    columnCount: 15,
    columns: ['id', '일자', '일자_번호', '사용유형', '적요', '품목코드', '품명_및_규격', '수량', '중량', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', 'imported_at']
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
  table1: 'sales_goals',
  table2: 'sales_goals_client_category_backup',
  table3: 'sync_activity_log',
  table4: 'sync_configurations',
  table5: 'drive_file_events',
  table6: 'drive_sync_state',
  table7: 'west_internal_uses',
  table8: 'east_disposed_inventory',
  table9: 'east_internal_uses',
  table10: 'computed_inventory_monthly',
  table11: 'clients',
  table12: 'east_inventory_20251231',
  table13: 'west_inventory_20251231',
  table14: 'youngil_inventory_20251231',
  table15: 'team_display_order',
  table16: 'employee_display_order',
  table17: 'office_display_order',
  table18: 'east_division_purchases',
  table19: 'east_division_sales',
  table20: 'west_division_purchases',
  table21: 'west_division_sales',
  table22: 'purchases',
  table23: 'sales',
  table24: 'sales_goals_employee_backup',
  table25: 'disposed_inventory',
  table26: 'shopping_sales',
  table27: 'sales_profit',
  table28: 'pending_purchases',
  table29: 'pending_sales',
  table30: 'ar_baselines',
  table31: 'ledger',
  table32: 'bank_accounts',
  table33: 'promissory_notes',
  table34: 'purchase_orders',
  table35: 'employee_category',
  table36: 'employee_activity_log',
  table37: 'kakaotalk_raw_messages',
  table38: 'company_type_auto',
  table39: 'company_type',
  table40: 'employees',
  table41: 'items',
  table42: 'warehouses',
  table43: 'user_data_files',
  table44: 'inventory_transfers',
  table45: 'internal_uses'
} as const;
