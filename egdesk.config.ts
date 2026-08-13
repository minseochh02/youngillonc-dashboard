/**
 * EGDesk User Data Configuration
 * Generated at: 2026-08-13T06:49:08.256Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: 'aecf2733-3fd4-4596-a6e3-baab76cb9690',
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
    name: 'inventory_transfers',
    displayName: '창고이동현황',
    rowCount: 0,
    columnCount: 14,
    columns: ['id', '_version', '일자', '일자_번호', '출고창고명', '입고창고명', '품목명_규격', '수량', '중량', '금액_수량_입고단가', '품목그룹1코드', '품목그룹3코드', '적요', 'imported_at']
  } as TableDefinition,
  table2: {
    name: 'west_inventory_transfers',
    displayName: '서부창고이동현황',
    rowCount: 0,
    columnCount: 14,
    columns: ['id', '_version', '일자', '일자_번호', '출고창고명', '입고창고명', '품목명_규격', '수량', '중량', '금액_수량_입고단가', '품목그룹1코드', '품목그룹3코드', '적요', 'imported_at']
  } as TableDefinition,
  table3: {
    name: 'inventory_transfer',
    displayName: '창고이동현황',
    rowCount: 427,
    columnCount: 13,
    columns: ['id', '_version', '일자', '일자번호', '출고창고명', '입고창고명', '품목코드', '수량', '중량', '금액_수량_입고단가_', '품목그룹1코드', '품목그룹3코드', '적요']
  } as TableDefinition,
  table4: {
    name: 'east_production_material_consumption',
    displayName: '동부생산입고/소모현황',
    description: '동부 생산 원자재 소모현황',
    rowCount: 0,
    columnCount: 17,
    columns: ['id', '_version', '일자', '일자번호', '생산품목코드', '출고창고코드', '입고창고코드', '생산품목명', '소모품목코드', '소모품목명', '생산수량', '표준소모수량', '실제소모수량', '생산품목단가', '소모품목단가', '차이', '금액']
  } as TableDefinition,
  table5: {
    name: 'east_inventory_adjustments',
    displayName: '동부재고조정현황',
    description: '동부 재고조정현황',
    rowCount: 0,
    columnCount: 9,
    columns: ['id', '_version', '일자', '품목코드', '창고코드', '장부수량', '실사수량', '조정수량', '적요']
  } as TableDefinition,
  table6: {
    name: 'east_inventory_transfers',
    displayName: '동부창고이동현황',
    description: '동부 창고이동현황',
    rowCount: 5187,
    columnCount: 14,
    columns: ['id', '_version', '일자', '일자_번호', '출고창고명', '입고창고명', '품목명_규격', '수량', '중량', '금액_수량_입고단가', '품목그룹1코드', '품목그룹3코드', '적요', 'imported_at']
  } as TableDefinition,
  table7: {
    name: 'west_production_material_consumption',
    displayName: '서부생산입고/소모현황',
    description: '서부 생산 원자재 소모현황',
    rowCount: 0,
    columnCount: 17,
    columns: ['id', '_version', '일자', '일자번호', '생산품목코드', '출고창고코드', '입고창고코드', '생산품목명', '소모품목코드', '소모품목명', '생산수량', '표준소모수량', '실제소모수량', '생산품목단가', '소모품목단가', '차이', '금액']
  } as TableDefinition,
  table8: {
    name: 'west_inventory_adjustments',
    displayName: '서부재고조정현황',
    description: '서부 재고조정현황',
    rowCount: 0,
    columnCount: 9,
    columns: ['id', '_version', '일자', '품목코드', '창고코드', '장부수량', '실사수량', '조정수량', '적요']
  } as TableDefinition,
  table9: {
    name: 'west_disposed_inventory',
    displayName: '서부재고폐기',
    description: '서부 폐기재고현황',
    rowCount: 0,
    columnCount: 9,
    columns: ['id', '_version', '일자', '품목코드', '수량', '금액_수량_입고단가_', '적요', '창고명', '관리항목코드명']
  } as TableDefinition,
  table10: {
    name: 'west_internal_transfers',
    displayName: '서부창고이동현황',
    rowCount: 6067,
    columnCount: 13,
    columns: ['id', '_version', '일자', '일자번호', '출고창고명', '입고창고명', '품목명_규격_', '수량', '중량', '금액_수량_입고단가_', '품목그룹1코드', '품목그룹3코드', '적요']
  } as TableDefinition,
  table11: {
    name: 'items',
    displayName: '품목',
    rowCount: 3360,
    columnCount: 13,
    columns: ['id', '_version', '품목코드', '재고수량관리', '품목그룹1코드', '품목그룹2코드', '품목그룹3코드', '품목명', '품목구분', '규격정보', '구분', '석유류', '제품군']
  } as TableDefinition,
  table12: {
    name: 'production_material_consumption',
    displayName: '생산입고/소모현황',
    rowCount: 22,
    columnCount: 17,
    columns: ['id', '_version', '일자', '일자번호', '생산품목코드', '출고창고코드', '입고창고코드', '생산품목명', '소모품목코드', '소모품목명', '생산수량', '표준소모수량', '실제소모수량', '생산품목단가', '소모품목단가', '차이', '금액']
  } as TableDefinition,
  table13: {
    name: 'inventory_adjustments',
    displayName: '재고조정현황',
    rowCount: 49,
    columnCount: 9,
    columns: ['id', '_version', '일자', '품목코드', '창고코드', '장부수량', '실사수량', '조정수량', '적요']
  } as TableDefinition,
  table14: {
    name: 'youngil_inventory_20251231',
    displayName: '영일재고 20251231스냅샷',
    description: '본사 ESZ018R 스냅샷',
    rowCount: 776,
    columnCount: 7,
    columns: ['id', '_version', '품목코드', '창고코드', '재고수량', '중량', 'imported_at']
  } as TableDefinition,
  table15: {
    name: 'sales_goals',
    displayName: '판매 목표',
    description: 'Client-level monthly sales targets by product category',
    rowCount: 4545,
    columnCount: 9,
    columns: ['id', '_version', 'year', 'month', 'client_code', 'category_type', 'category', 'target_weight', 'target_amount']
  } as TableDefinition,
  table16: {
    name: 'goal_setting_clients',
    displayName: '목표설정 신규 거래처',
    description: '일괄 목표 설정에서 생성한 임시/수동 거래처. ERP 거래처 마스터(clients)와 분리 보관.',
    rowCount: 0,
    columnCount: 9,
    columns: ['id', '_version', 'client_code', 'client_name', 'industry_code', 'employee_code', 'region_code', 'new_client_date', 'created_at']
  } as TableDefinition,
  table17: {
    name: 'region_code',
    displayName: '지역코드',
    rowCount: 256,
    columnCount: 9,
    columns: ['id', '_version', '지역코드', '시도명', '시군구명', '3분류', '대분류', '지역세분', '비고']
  } as TableDefinition,
  table18: {
    name: 'sales_goals_client_category_backup',
    displayName: '판매 목표 (카테고리 분할 백업)',
    description: 'Client-level sales targets by month and product category slice',
    rowCount: 4441,
    columnCount: 11,
    columns: ['id', '_version', 'year', 'month', 'client_code', 'category_type', 'category', 'industry', 'sector', 'target_weight', 'target_amount']
  } as TableDefinition,
  table19: {
    name: 'drive_file_events',
    displayName: 'Drive File Events',
    description: 'Logs all Google Drive file change events',
    rowCount: 21,
    columnCount: 13,
    columns: ['id', '_version', 'file_id', 'file_name', 'mime_type', 'folder_id', 'event_type', 'modified_time', 'detected_at', 'downloaded', 'download_path', 'file_size', 'metadata']
  } as TableDefinition,
  table20: {
    name: 'drive_sync_state',
    displayName: 'Drive Sync State',
    description: 'Stores Google Drive sync state and watch channel info',
    rowCount: 1,
    columnCount: 9,
    columns: ['id', '_version', 'page_token', 'channel_id', 'channel_resource_id', 'channel_expiration', 'target_folder_ids', 'last_updated', 'created_at']
  } as TableDefinition,
  table21: {
    name: 'west_internal_uses',
    displayName: '서부자가사용현황',
    rowCount: 57,
    columnCount: 19,
    columns: ['id', '_version', '월_일', '월_일_번호', '사용유형', '적요', '품목코드', '품목명', '수량', '사용자지정_숫자형_1', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', '회사명', '기간', '계정코드_메타', '계정명_메타']
  } as TableDefinition,
  table22: {
    name: 'east_disposed_inventory',
    displayName: '동부페기재고',
    rowCount: 6,
    columnCount: 10,
    columns: ['id', '_version', '일자', '품목코드', '수량', '중량', '금액_수량_입고단가_', '적요', '창고코드', '관리항목코드']
  } as TableDefinition,
  table23: {
    name: 'east_internal_uses',
    displayName: '동부자가사용',
    rowCount: 236,
    columnCount: 15,
    columns: ['id', '_version', '월_일', '월_일_번호', '사용유형', '적요', '품목코드', '품목명', '수량', '사용자지정_숫자형_1', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드']
  } as TableDefinition,
  table24: {
    name: 'computed_inventory_monthly',
    displayName: 'computed 재고(월말)',
    description: '카테고리별 월말 계산재고 (스냅샷 기반)',
    rowCount: 826,
    columnCount: 14,
    columns: ['id', '_version', 'month', 'month_end_date', 'category', 'purchase_weight', 'sales_weight', 'internal_use_weight', 'disposed_weight', 'net_weight', 'inventory_weight', 'snapshot_month', 'snapshot_date', 'computed_at']
  } as TableDefinition,
  table25: {
    name: 'clients',
    displayName: '거래처리스트',
    rowCount: 10940,
    columnCount: 11,
    columns: ['id', '_version', '거래처코드', '거래처명', '거래처그룹1코드', '거래처그룹1명', '업종분류코드', '담당자코드', '지역코드', '신규일', 'imported_at']
  } as TableDefinition,
  table26: {
    name: 'sync_activity_log',
    displayName: 'sync_activity_log',
    description: 'Imported from user_database_export_2026-04-20.sql',
    rowCount: 0,
    columnCount: 13,
    columns: ['id', '_version', 'config_id', 'file_name', 'file_path', 'status', 'rows_imported', 'rows_skipped', 'duplicates_skipped', 'error_message', 'started_at', 'completed_at', 'duration_ms']
  } as TableDefinition,
  table27: {
    name: 'sync_configurations',
    displayName: 'sync_configurations',
    description: 'Imported from user_database_export_2026-04-20.sql',
    rowCount: 8,
    columnCount: 24,
    columns: ['id', '_version', 'script_folder_path', 'script_name', 'folder_name', 'target_table_id', 'header_row', 'skip_bottom_rows', 'sheet_index', 'column_mappings', 'applied_splits', 'file_action', 'enabled', 'auto_sync_enabled', 'unique_key_columns', 'duplicate_action', 'last_sync_at', 'last_sync_status', 'last_sync_rows_imported', 'last_sync_rows_skipped', 'last_sync_duplicates', 'last_sync_error', 'created_at', 'updated_at']
  } as TableDefinition,
  table28: {
    name: 'east_inventory_20251231',
    displayName: '동부재고 20251231스냅샷',
    description: '동부 ESZ018R 스냅샷',
    rowCount: 317,
    columnCount: 8,
    columns: ['id', '_version', '품목코드', '창고코드', '재고수량', '중량', '총중량', 'imported_at']
  } as TableDefinition,
  table29: {
    name: 'west_inventory_20251231',
    displayName: '서부재고 20251231스냅샷',
    description: '서부 ESZ018R 스냅샷',
    rowCount: 371,
    columnCount: 8,
    columns: ['id', '_version', '품목코드', '창고코드', '재고수량', '중량', '총중량', 'imported_at']
  } as TableDefinition,
  table30: {
    name: 'team_display_order',
    displayName: '팀 노출 순서 (B2C/B2B)',
    description: 'B2C(b2c_팀) / B2B(b2b팀) 팀 표시 순서 — employee_category가 마스터',
    rowCount: 19,
    columnCount: 5,
    columns: ['id', '_version', 'scope', '팀', '노출순서']
  } as TableDefinition,
  table31: {
    name: 'employee_display_order',
    displayName: '팀 내 사원 노출 순서',
    description: '채널·팀별 담당자 표시 순서 — employee_category가 마스터',
    rowCount: 98,
    columnCount: 6,
    columns: ['id', '_version', 'scope', '팀', '담당자', '팀내_노출순서']
  } as TableDefinition,
  table32: {
    name: 'office_display_order',
    displayName: '사업소 노출 순서',
    description: '대시보드 내 사업소 표시 순서 관리',
    rowCount: 9,
    columnCount: 4,
    columns: ['id', '_version', '사업소', '노출순서']
  } as TableDefinition,
  table33: {
    name: 'east_division_purchases',
    displayName: '동부구매현황',
    rowCount: 5931,
    columnCount: 14,
    columns: ['id', '_version', '일자', '거래처코드', '창고코드', '품목코드', '수량', '단가', '중량', '공급가액', '합계', '적요', '적요1', 'imported_at']
  } as TableDefinition,
  table34: {
    name: 'east_division_sales',
    displayName: '동부판매현황',
    rowCount: 43575,
    columnCount: 16,
    columns: ['id', '_version', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table35: {
    name: 'west_division_purchases',
    displayName: '서부구매현황',
    rowCount: 7814,
    columnCount: 14,
    columns: ['id', '_version', '일자', '거래처코드', '창고코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '적요', '적요1', 'imported_at']
  } as TableDefinition,
  table36: {
    name: 'west_division_sales',
    displayName: '서부판매현황',
    rowCount: 57133,
    columnCount: 16,
    columns: ['id', '_version', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table37: {
    name: 'purchases',
    displayName: '구매현황',
    rowCount: 132094,
    columnCount: 14,
    columns: ['id', '_version', '일자', '거래처코드', '창고코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '적요', '적요1', 'imported_at']
  } as TableDefinition,
  table38: {
    name: 'sales',
    displayName: '판매현황',
    rowCount: 618214,
    columnCount: 16,
    columns: ['id', '_version', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at']
  } as TableDefinition,
  table39: {
    name: 'sales_goals_employee_backup',
    displayName: '판매 목표 (담당자 기준 백업)',
    rowCount: 238,
    columnCount: 11,
    columns: ['id', '_version', 'year', 'month', 'employee_name', 'category_type', 'category', 'industry', 'sector', 'target_weight', 'target_amount']
  } as TableDefinition,
  table40: {
    name: 'disposed_inventory',
    displayName: '재고폐기',
    rowCount: 83,
    columnCount: 9,
    columns: ['id', '_version', '일자', '품목코드', '수량', '금액_수량_입고단가_', '적요', '창고명', '관리항목코드명']
  } as TableDefinition,
  table41: {
    name: 'shopping_sales',
    displayName: '쇼핑몰판매현황',
    rowCount: 1400,
    columnCount: 18,
    columns: ['id', '_version', '주문번호', '사업소', '담당자', '거래처', 'erp', '사업자번호', '주문상품', '용량', '수량', '주문금액', '총_주문금액', '사용한_포인트', '보유포인트', '결제한_금액', '결재_방법', '주문_날짜']
  } as TableDefinition,
  table42: {
    name: 'sales_profit',
    displayName: '월별이익현황',
    rowCount: 590,
    columnCount: 13,
    columns: ['id', '_version', '품목코드', '품목명', '판매수량', '판매단가', '판매금액', '원가단가', '원가금액', '이익단가', '이익금액', '이익율', 'imported_at']
  } as TableDefinition,
  table43: {
    name: 'pending_purchases',
    displayName: '미구매현황',
    rowCount: 8025,
    columnCount: 13,
    columns: ['id', '_version', '일자', '품목코드', '수량', '잔량', '잔량_중량_', '단가', '합계', '납기일자', '거래처코드', '창고명', '품목별납기일자']
  } as TableDefinition,
  table44: {
    name: 'pending_sales',
    displayName: '미판매현황',
    rowCount: 19,
    columnCount: 13,
    columns: ['id', '_version', '일자', '품목코드', '거래처코드', '실납업체', '담당자코드', '수량', '잔량', '중량', '합계', '적요', '납기일자']
  } as TableDefinition,
  table45: {
    name: 'ar_baselines',
    displayName: '채권기초잔액',
    rowCount: 557,
    columnCount: 15,
    columns: ['id', '_version', 'manager_code', 'manager_name', 'client_code', 'client_name', 'total_ar', 'notes_receivable', 'ar_total', 'ar_feb', 'ar_jan', 'ar_dec', 'ar_nov', 'ar_others', 'baseline_date']
  } as TableDefinition,
  table46: {
    name: 'ledger',
    displayName: '계정별원장',
    description: 'Exact schema from 계정별원장-거래처코드포함2.xlsx',
    rowCount: 48117,
    columnCount: 14,
    columns: ['id', '_version', '일자', '최초작성일자', '최종수정일자', '어음만기일자', '거래유형', '적요', '계정코드', '거래처코드', '차변금액', '대변금액', '잔액', 'imported_at']
  } as TableDefinition,
  table47: {
    name: 'bank_accounts',
    displayName: '계좌리스트',
    rowCount: 56,
    columnCount: 9,
    columns: ['id', '_version', '계좌코드', '계좌명', '계정명_계정코드_', '검색창내용', '적요', '외화통장', '사용']
  } as TableDefinition,
  table48: {
    name: 'promissory_notes',
    displayName: '받을어음거래내역',
    rowCount: 535,
    columnCount: 14,
    columns: ['id', '_version', '일자', '증감구분', '어음번호', '거래처코드', '계정명', '부서명', '프로젝트명', '적요', '증가금액', '감소금액', '잔액', 'imported_at']
  } as TableDefinition,
  table49: {
    name: 'purchase_orders',
    displayName: '발주서현황',
    rowCount: 4458,
    columnCount: 11,
    columns: ['id', '_version', '일자', '품목코드', '창고코드', '품목그룹1코드', '수량', '단가', '합계', '거래처코드', '적요']
  } as TableDefinition,
  table50: {
    name: 'employee_category',
    displayName: '사원분류',
    rowCount: 47,
    columnCount: 10,
    columns: ['id', '_version', '담당자', 'b2b팀', 'b2b사업소', 'b2b팀별담당', 'b2c_팀', 'b2c사업소', '전체사업소', 'imported_at']
  } as TableDefinition,
  table51: {
    name: 'employee_activity_log',
    displayName: '직원활동로그',
    description: 'Individual activities extracted from KakaoTalk messages',
    rowCount: 47765,
    columnCount: 17,
    columns: ['id', '_version', 'source_message_id', 'employee_name', 'activity_date', 'activity_type', 'activity_label', 'customer', 'location', 'products', 'outcome', 'issue_severity', 'action_taken', 'resolved_by', 'chat_room', 'extracted_at', 'confidence_score']
  } as TableDefinition,
  table52: {
    name: 'kakaotalk_raw_messages',
    displayName: '카카오톡원본메시지',
    description: 'Raw KakaoTalk messages with multi-line support',
    rowCount: 7143,
    columnCount: 6,
    columns: ['id', '_version', 'chat_room', 'chat_date', 'user_name', 'message']
  } as TableDefinition,
  table53: {
    name: 'company_type_auto',
    displayName: 'AUTO 업종분류기준',
    rowCount: 35,
    columnCount: 6,
    columns: ['id', '_version', '업종분류코드', '오토_대분류', '모빌_대시보드채널', '거래처그룹2']
  } as TableDefinition,
  table54: {
    name: 'company_type',
    displayName: '업종분류',
    rowCount: 115,
    columnCount: 8,
    columns: ['id', '_version', '업종분류코드', '모빌분류', '산업분류', '섹터분류', '영일분류', '비고']
  } as TableDefinition,
  table55: {
    name: 'employees',
    displayName: '사원',
    rowCount: 128,
    columnCount: 5,
    columns: ['id', '_version', '사원_담당_코드', '사원_담당_명', 'imported_at']
  } as TableDefinition,
  table56: {
    name: 'warehouses',
    displayName: '창고',
    rowCount: 64,
    columnCount: 11,
    columns: ['id', '_version', '창고코드', '창고명', '계층그룹코드', '구분', '생산공정명', '외주거래처명', '사용', '추가사업장명', 'imported_at']
  } as TableDefinition,
  table57: {
    name: 'user_data_files',
    displayName: 'user_data_files',
    description: 'Imported from user_database_export_2026-03-12.sql',
    rowCount: 0,
    columnCount: 16,
    columns: ['id', '_version', 'table_id', 'row_id', 'column_name', 'filename', 'mime_type', 'size_bytes', 'storage_type', 'file_data', 'file_path', 'is_compressed', 'compression_type', 'original_size', 'created_at', 'updated_at']
  } as TableDefinition,
  table58: {
    name: 'internal_uses',
    displayName: '자가사용현황',
    rowCount: 151,
    columnCount: 16,
    columns: ['id', '_version', '일자', '일자_번호', '사용유형', '적요', '품목코드', '품명_및_규격', '수량', '중량', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', 'imported_at']
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
  table2: 'west_inventory_transfers',
  table3: 'inventory_transfer',
  table4: 'east_production_material_consumption',
  table5: 'east_inventory_adjustments',
  table6: 'east_inventory_transfers',
  table7: 'west_production_material_consumption',
  table8: 'west_inventory_adjustments',
  table9: 'west_disposed_inventory',
  table10: 'west_internal_transfers',
  table11: 'items',
  table12: 'production_material_consumption',
  table13: 'inventory_adjustments',
  table14: 'youngil_inventory_20251231',
  table15: 'sales_goals',
  table16: 'goal_setting_clients',
  table17: 'region_code',
  table18: 'sales_goals_client_category_backup',
  table19: 'drive_file_events',
  table20: 'drive_sync_state',
  table21: 'west_internal_uses',
  table22: 'east_disposed_inventory',
  table23: 'east_internal_uses',
  table24: 'computed_inventory_monthly',
  table25: 'clients',
  table26: 'sync_activity_log',
  table27: 'sync_configurations',
  table28: 'east_inventory_20251231',
  table29: 'west_inventory_20251231',
  table30: 'team_display_order',
  table31: 'employee_display_order',
  table32: 'office_display_order',
  table33: 'east_division_purchases',
  table34: 'east_division_sales',
  table35: 'west_division_purchases',
  table36: 'west_division_sales',
  table37: 'purchases',
  table38: 'sales',
  table39: 'sales_goals_employee_backup',
  table40: 'disposed_inventory',
  table41: 'shopping_sales',
  table42: 'sales_profit',
  table43: 'pending_purchases',
  table44: 'pending_sales',
  table45: 'ar_baselines',
  table46: 'ledger',
  table47: 'bank_accounts',
  table48: 'promissory_notes',
  table49: 'purchase_orders',
  table50: 'employee_category',
  table51: 'employee_activity_log',
  table52: 'kakaotalk_raw_messages',
  table53: 'company_type_auto',
  table54: 'company_type',
  table55: 'employees',
  table56: 'warehouses',
  table57: 'user_data_files',
  table58: 'internal_uses'
} as const;
