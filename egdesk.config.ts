/**
 * EGDesk User Data Configuration
 * Generated at: 2026-03-12T23:47:10.584Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '4e5fb529-a686-4431-852d-3bc9baa94b44',
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
    name: 'employee_master',
    displayName: '직원마스터',
    description: 'Master list of employees with contact and organizational information, populated from KakaoTalk data',
    rowCount: 21,
    columnCount: 17,
    columns: ['id', 'employee_name', 'employee_name_variants', 'phone_number', 'email', 'department', 'position', 'team', 'region', 'chat_rooms', 'total_messages', 'first_message_date', 'last_message_date', 'employment_status', 'start_date', 'created_at', 'updated_at']
  } as TableDefinition,
  table2: {
    name: 'daily_standup_log',
    displayName: '일일업무요약',
    description: 'Daily standup-style summary of employee work activities aggregated by date',
    rowCount: 79,
    columnCount: 16,
    columns: ['id', 'employee_name', 'report_date', 'completed_today', 'planned_tasks', 'blockers', 'customers_visited', 'products_discussed', 'availability_status', 'absence_reason', 'checkout_location', 'work_region', 'notes', 'source_messages', 'extracted_at', 'confidence_score']
  } as TableDefinition,
  table3: {
    name: 'employee_activity_log',
    displayName: '직원활동로그',
    description: 'Employee activities extracted from KakaoTalk messages - tracks customer visits, sales activities, work completed',
    rowCount: 80,
    columnCount: 25,
    columns: ['id', 'source_message_id', 'extracted_at', 'employee_name', 'activity_date', 'activity_type', 'activity_summary', 'activity_details', 'customer_name', 'location', 'products_mentioned', 'task_status', 'task_priority', 'time_spent_hours', 'planned_completion_date', 'related_project', 'related_department', 'mentioned_employees', 'requires_followup', 'is_blocker', 'sentiment', 'next_action', 'next_action_date', 'confidence_score', 'extraction_model']
  } as TableDefinition,
  table4: {
    name: 'kakaotalk_raw_messages',
    displayName: '카카오톡원본메시지',
    description: 'Raw KakaoTalk messages parsed from .eml export files',
    rowCount: 6127,
    columnCount: 6,
    columns: ['id', 'chat_room', 'chat_date', 'user_name', 'message', 'imported_at']
  } as TableDefinition,
  table5: {
    name: 'inventory_transfers',
    displayName: '창고이동현황',
    description: undefined,
    rowCount: 138,
    columnCount: 13,
    columns: ['id', '일자', '일자_번호', '출고창고명', '입고창고명', '품목명_규격', '수량', '중량', '금액_수량_입고단가', '품목그룹1코드', '품목그룹3코드', '적요', 'imported_at']
  } as TableDefinition,
  table6: {
    name: 'internal_uses',
    displayName: '자가사용현황',
    description: undefined,
    rowCount: 53,
    columnCount: 15,
    columns: ['id', '일자', '일자_번호', '사용유형', '적요', '품목코드', '품명_및_규격', '수량', '중량', '입고단가', '원가', '담당자코드명', '창고명', '품목그룹3코드', 'imported_at']
  } as TableDefinition,
  table7: {
    name: 'purchase_orders',
    displayName: '발주서현황',
    description: undefined,
    rowCount: 1189,
    columnCount: 15,
    columns: ['id', '월_일', '월_일_번호', '품명_및_규격', '품목그룹1코드', '수량', '단가', '공급가액', '부가세', '합계', '거래처명', '적요', '창고명', '품목그룹1명', 'imported_at']
  } as TableDefinition,
  table8: {
    name: 'deposits',
    displayName: '입금보고서집계',
    description: undefined,
    rowCount: 1489,
    columnCount: 17,
    columns: ['id', '전표번호', '전표번호_번호', '계좌', '돈들어온계좌번호', '계정명', '부서명', '거래처코드', '거래처명', '적요', '금액', '수수료', '담당자명', '프로젝트명', '세무신고거래처', '대표자명', 'imported_at']
  } as TableDefinition,
  table9: {
    name: 'promissory_notes',
    displayName: '받을어음거래내역',
    description: undefined,
    rowCount: 162,
    columnCount: 13,
    columns: ['id', '일자', '증감구분', '어음번호', '거래처명', '계정명', '부서명', '프로젝트명', '적요', '증가금액', '감소금액', '잔액', 'imported_at']
  } as TableDefinition,
  table10: {
    name: 'product_mapping',
    displayName: '품목코드매핑',
    description: 'Product code mapping table for inventory categorization',
    rowCount: 709,
    columnCount: 8,
    columns: ['id', '품목코드', '품목명', '품목그룹1코드', '품목그룹1명', '품목그룹2명', '품목그룹3코드', 'last_seen_date']
  } as TableDefinition,
  table11: {
    name: 'sales',
    displayName: '판매현황',
    description: undefined,
    rowCount: 15038,
    columnCount: 27,
    columns: ['id', '일자', '거래처그룹1코드명', '세무신고거래처코드', '거래처코드', '담당자코드명', '판매처명', '품목코드', '품목명_규격_', '단위', '규격명', '수량', '중량', '단가', '공급가액', '합_계', '품목그룹1코드', '품목그룹2명', '품목그룹3코드', '창고명', '거래처그룹2명', '신규일', '적요', '적요2', '코드변경', '실납업체', 'imported_at']
  } as TableDefinition,
  table12: {
    name: 'ledger',
    displayName: '계정별원장',
    description: 'Rebuilt from CSV with proper date formatting',
    rowCount: 20622,
    columnCount: 18,
    columns: ['id', '일자', '일자_no', '적요', '계정코드', '계정명', '거래처명', '거래처코드', '부서명', '담당자코드', '차변금액', '대변금액', '잔액', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table13: {
    name: 'pending_purchases',
    displayName: '미구매현황',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 미구매현황(pending_purchases)',
    rowCount: 155,
    columnCount: 20,
    columns: ['id', '월_일', '품목코드', '품명_및_규격', '수량', '잔량', '잔량_중량_', '미구매공급가액', '미구매부가세', '합계', '납기일자', '거래처명', '품목그룹1명', '창고명', '품목별납기일자', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table14: {
    name: 'pending_sales',
    displayName: '미판매현황',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 미판매현황(pending_sales)',
    rowCount: 15,
    columnCount: 15,
    columns: ['id', '월_일', '품목코드', '품명_및_규격', '수량', '잔량', '공급가액', '거래처명', '적요', '납기일자', '회사명', '기간', '계정코드_메타', '계정명_메타', 'imported_at']
  } as TableDefinition,
  table15: {
    name: 'inventory',
    displayName: '창고별재고',
    description: 'Imported from user_database_export_2026-03-02.xlsx - Sheet: 창고별재고(inventory)',
    rowCount: 54815,
    columnCount: 7,
    columns: ['id', '품목코드', '품목명_규격_', '창고코드', '창고명', '재고수량', 'imported_at']
  } as TableDefinition,
  table16: {
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
  table1: 'employee_master',
  table2: 'daily_standup_log',
  table3: 'employee_activity_log',
  table4: 'kakaotalk_raw_messages',
  table5: 'inventory_transfers',
  table6: 'internal_uses',
  table7: 'purchase_orders',
  table8: 'deposits',
  table9: 'promissory_notes',
  table10: 'product_mapping',
  table11: 'sales',
  table12: 'ledger',
  table13: 'pending_purchases',
  table14: 'pending_sales',
  table15: 'inventory',
  table16: 'purchases'
} as const;
