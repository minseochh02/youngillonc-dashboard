/**
 * egdesk.schema.ts — committed seed schema
 *
 * COMMIT THIS FILE TO GIT.
 *
 * When someone opens this project in their EGDesk, these tables are created
 * automatically in their dev database on first server start.
 *
 * Unlike egdesk.config.ts (auto-generated, gitignored), this file is the
 * portable source of truth for your app's database structure.
 *
 * Edit this file when you add/remove tables or columns. Do NOT edit
 * egdesk.config.ts — EGDesk regenerates it from the live database.
 *
 * Generated from user_database_export_2026-06-05.sql
 */

export const TABLES = {
  drive_file_events: {
    name: 'drive_file_events',
    displayName: 'Drive File Events',
    columns: ['id', 'file_id', 'file_name', 'mime_type', 'folder_id', 'event_type', 'modified_time', 'detected_at', 'downloaded', 'download_path', 'file_size', 'metadata'],
    columnCount: 12,
    rowCount: 0,
  },
  drive_sync_state: {
    name: 'drive_sync_state',
    displayName: 'Drive Sync State',
    columns: ['id', 'page_token', 'channel_id', 'channel_resource_id', 'channel_expiration', 'target_folder_ids', 'last_updated', 'created_at'],
    columnCount: 8,
    rowCount: 0,
  },
  west_internal_uses: {
    name: 'west_internal_uses',
    displayName: '서부자가사용현황',
    columns: ['id', '월_일', '월_일_번호', '사용유형', '적요', '품목코드', '품목명', '수량', '사용자지정_숫자형_1', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', '회사명', '기간', '계정코드_메타', '계정명_메타'],
    columnCount: 18,
    rowCount: 0,
  },
  east_disposed_inventory: {
    name: 'east_disposed_inventory',
    displayName: '동부페기재고',
    columns: ['id', '일자', '품목코드', '수량', '중량', '금액_수량_입고단가_', '적요', '창고코드', '관리항목코드'],
    columnCount: 9,
    rowCount: 0,
  },
  east_internal_uses: {
    name: 'east_internal_uses',
    displayName: '동부자가사용',
    columns: ['id', '월_일', '월_일_번호', '사용유형', '적요', '품목코드', '품목명', '수량', '사용자지정_숫자형_1', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드'],
    columnCount: 14,
    rowCount: 0,
  },
  computed_inventory_monthly: {
    name: 'computed_inventory_monthly',
    displayName: 'computed 재고(월말)',
    columns: ['id', 'month', 'month_end_date', 'category', 'purchase_weight', 'sales_weight', 'internal_use_weight', 'disposed_weight', 'net_weight', 'inventory_weight', 'snapshot_month', 'snapshot_date', 'computed_at'],
    columnCount: 13,
    rowCount: 0,
  },
  clients: {
    name: 'clients',
    displayName: '거래처리스트',
    columns: ['id', '거래처코드', '거래처명', '거래처그룹1코드', '거래처그룹1명', '업종분류코드', '담당자코드', '지역코드', '신규일'],
    columnCount: 9,
    rowCount: 0,
  },
  east_inventory_20251231: {
    name: 'east_inventory_20251231',
    displayName: '동부재고 20251231스냅샷',
    columns: ['id', '품목코드', '창고코드', '재고수량', '중량', '총중량', 'imported_at'],
    columnCount: 7,
    rowCount: 0,
  },
  west_inventory_20251231: {
    name: 'west_inventory_20251231',
    displayName: '서부재고 20251231스냅샷',
    columns: ['id', '품목코드', '창고코드', '재고수량', '중량', '총중량', 'imported_at'],
    columnCount: 7,
    rowCount: 0,
  },
  youngil_inventory_20251231: {
    name: 'youngil_inventory_20251231',
    displayName: '영일재고 20251231스냅샷',
    columns: ['id', '품목코드', '창고코드', '재고수량', '중량', '총중량', 'imported_at'],
    columnCount: 7,
    rowCount: 0,
  },
  team_display_order: {
    name: 'team_display_order',
    displayName: '팀 노출 순서 (B2C/B2B)',
    columns: ['id', 'scope', '팀', '노출순서'],
    columnCount: 4,
    rowCount: 0,
  },
  employee_display_order: {
    name: 'employee_display_order',
    displayName: '팀 내 사원 노출 순서',
    columns: ['id', 'scope', '팀', '담당자', '팀내_노출순서'],
    columnCount: 5,
    rowCount: 0,
  },
  office_display_order: {
    name: 'office_display_order',
    displayName: '사업소 노출 순서',
    columns: ['id', '사업소', '노출순서'],
    columnCount: 3,
    rowCount: 0,
  },
  east_division_purchases: {
    name: 'east_division_purchases',
    displayName: '동부구매현황',
    columns: ['id', '일자', '거래처코드', '창고코드', '품목코드', '수량', '단가', '중량', '공급가액', '합계', '적요', '적요1', 'imported_at'],
    columnCount: 13,
    rowCount: 0,
  },
  east_division_sales: {
    name: 'east_division_sales',
    displayName: '동부판매현황',
    columns: ['id', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at'],
    columnCount: 15,
    rowCount: 0,
  },
  west_division_purchases: {
    name: 'west_division_purchases',
    displayName: '서부구매현황',
    columns: ['id', '일자', '거래처코드', '창고코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '적요', '적요1', 'imported_at'],
    columnCount: 13,
    rowCount: 0,
  },
  west_division_sales: {
    name: 'west_division_sales',
    displayName: '서부판매현황',
    columns: ['id', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at'],
    columnCount: 15,
    rowCount: 0,
  },
  purchases: {
    name: 'purchases',
    displayName: '구매현황',
    columns: ['id', '일자', '거래처코드', '창고코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '적요', '적요1', 'imported_at'],
    columnCount: 13,
    rowCount: 0,
  },
  sales: {
    name: 'sales',
    displayName: '판매현황',
    columns: ['id', '일자', '거래처코드', '담당자코드', '품목코드', '수량', '중량', '단가', '공급가액', '합계', '출하창고코드', '적요', '적요2', '실납업체', 'imported_at'],
    columnCount: 15,
    rowCount: 0,
  },
  sales_goals: {
    name: 'sales_goals',
    displayName: '판매 목표',
    columns: ['id', 'year', 'month', 'client_code', 'target_weight', 'target_amount'],
    columnCount: 6,
    rowCount: 0,
  },
  sales_goals_client_category_backup: {
    name: 'sales_goals_client_category_backup',
    displayName: '판매 목표 (카테고리 분할 백업)',
    columns: ['id', 'year', 'month', 'client_code', 'category_type', 'category', 'industry', 'sector', 'target_weight', 'target_amount'],
    columnCount: 10,
    rowCount: 0,
  },
  disposed_inventory: {
    name: 'disposed_inventory',
    displayName: '재고폐기',
    columns: ['id', '일자', '품목코드', '수량', '금액_수량_입고단가_', '적요', '창고명', '관리항목코드명'],
    columnCount: 8,
    rowCount: 0,
  },
  shopping_sales: {
    name: 'shopping_sales',
    displayName: '쇼핑몰판매현황',
    columns: ['id', '주문번호', '사업소', '담당자', '거래처', 'erp', '사업자번호', '주문상품', '용량', '수량', '주문금액', '총_주문금액', '사용한_포인트', '보유포인트', '결제한_금액', '결재_방법', '주문_날짜'],
    columnCount: 17,
    rowCount: 0,
  },
  sales_profit: {
    name: 'sales_profit',
    displayName: '월별이익현황',
    columns: ['id', '품목코드', '품목명', '판매수량', '판매단가', '판매금액', '원가단가', '원가금액', '이익단가', '이익금액', '이익율', 'imported_at'],
    columnCount: 12,
    rowCount: 0,
  },
  pending_purchases: {
    name: 'pending_purchases',
    displayName: '미구매현황',
    columns: ['id', '일자', '품목코드', '수량', '잔량', '잔량_중량_', '단가', '합계', '납기일자', '거래처코드', '창고명', '품목별납기일자'],
    columnCount: 12,
    rowCount: 0,
  },
  pending_sales: {
    name: 'pending_sales',
    displayName: '미판매현황',
    columns: ['id', '일자', '품목코드', '거래처코드', '실납업체', '담당자코드', '수량', '잔량', '중량', '합계', '적요', '납기일자'],
    columnCount: 12,
    rowCount: 0,
  },
  ar_baselines: {
    name: 'ar_baselines',
    displayName: '채권기초잔액',
    columns: ['id', 'manager_code', 'manager_name', 'client_code', 'client_name', 'total_ar', 'notes_receivable', 'ar_total', 'ar_feb', 'ar_jan', 'ar_dec', 'ar_nov', 'ar_others', 'baseline_date'],
    columnCount: 14,
    rowCount: 0,
  },
  ledger: {
    name: 'ledger',
    displayName: '계정별원장',
    columns: ['id', '일자', '최초작성일자', '최종수정일자', '어음만기일자', '거래유형', '적요', '계정코드', '거래처코드', '차변금액', '대변금액', '잔액', 'imported_at'],
    columnCount: 13,
    rowCount: 0,
  },
  bank_accounts: {
    name: 'bank_accounts',
    displayName: '계좌리스트',
    columns: ['id', '계좌코드', '계좌명', '계정명_계정코드_', '검색창내용', '적요', '외화통장', '사용'],
    columnCount: 8,
    rowCount: 0,
  },
  promissory_notes: {
    name: 'promissory_notes',
    displayName: '받을어음거래내역',
    columns: ['id', '일자', '증감구분', '어음번호', '거래처코드', '계정명', '부서명', '프로젝트명', '적요', '증가금액', '감소금액', '잔액', 'imported_at'],
    columnCount: 13,
    rowCount: 0,
  },
  purchase_orders: {
    name: 'purchase_orders',
    displayName: '발주서현황',
    columns: ['id', '일자', '품목코드', '창고코드', '품목그룹1코드', '수량', '단가', '합계', '거래처코드', '적요'],
    columnCount: 10,
    rowCount: 0,
  },
  employee_category: {
    name: 'employee_category',
    displayName: '사원분류',
    columns: ['id', '담당자', 'b2b팀', 'b2b사업소', 'b2b팀별담당', 'b2c_팀', 'b2c사업소', '전체사업소', 'imported_at'],
    columnCount: 9,
    rowCount: 0,
  },
  employee_activity_log: {
    name: 'employee_activity_log',
    displayName: '직원활동로그',
    columns: ['id', 'source_message_id', 'employee_name', 'activity_date', 'activity_type', 'activity_label', 'customer', 'location', 'products', 'outcome', 'issue_severity', 'action_taken', 'resolved_by', 'chat_room', 'extracted_at', 'confidence_score'],
    columnCount: 16,
    rowCount: 0,
  },
  kakaotalk_raw_messages: {
    name: 'kakaotalk_raw_messages',
    displayName: '카카오톡원본메시지',
    columns: ['id', 'chat_room', 'chat_date', 'user_name', 'message'],
    columnCount: 5,
    rowCount: 0,
  },
  company_type_auto: {
    name: 'company_type_auto',
    displayName: 'AUTO 업종분류기준',
    columns: ['id', '업종분류코드', '오토_대분류', '모빌_대시보드채널', '거래처그룹2'],
    columnCount: 5,
    rowCount: 0,
  },
  company_type: {
    name: 'company_type',
    displayName: '업종분류',
    columns: ['id', '업종분류코드', '모빌분류', '산업분류', '섹터분류', '영일분류', '비고'],
    columnCount: 7,
    rowCount: 0,
  },
  employees: {
    name: 'employees',
    displayName: '사원',
    columns: ['id', '사원_담당_코드', '사원_담당_명', 'imported_at'],
    columnCount: 4,
    rowCount: 0,
  },
  items: {
    name: 'items',
    displayName: '품목',
    columns: ['id', '품목코드', '품목그룹1코드', '품목그룹2코드', '품목그룹3코드', '품목명', '품목구분', '규격정보', '구분', '석유류', '제품군', 'imported_at'],
    columnCount: 12,
    rowCount: 0,
  },
  warehouses: {
    name: 'warehouses',
    displayName: '창고',
    columns: ['id', '창고코드', '창고명', '계층그룹코드', '구분', '생산공정명', '외주거래처명', '사용', '추가사업장명', 'imported_at'],
    columnCount: 10,
    rowCount: 0,
  },
  user_data_files: {
    name: 'user_data_files',
    displayName: 'user_data_files',
    columns: ['id', 'table_id', 'row_id', 'column_name', 'filename', 'mime_type', 'size_bytes', 'storage_type', 'file_data', 'file_path', 'is_compressed', 'compression_type', 'original_size', 'created_at', 'updated_at'],
    columnCount: 15,
    rowCount: 0,
  },
  inventory_transfers: {
    name: 'inventory_transfers',
    displayName: '창고이동현황',
    columns: ['id', '일자', '일자_번호', '출고창고명', '입고창고명', '품목명_규격', '수량', '중량', '금액_수량_입고단가', '품목그룹1코드', '품목그룹3코드', '적요', 'imported_at'],
    columnCount: 13,
    rowCount: 0,
  },
  internal_uses: {
    name: 'internal_uses',
    displayName: '자가사용현황',
    columns: ['id', '일자', '일자_번호', '사용유형', '적요', '품목코드', '품명_및_규격', '수량', '중량', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', 'imported_at'],
    columnCount: 15,
    rowCount: 0,
  },
} as const;

export type TableName = keyof typeof TABLES;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];
