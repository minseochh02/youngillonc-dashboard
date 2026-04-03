# Database Knowledge - Youngil ONC

## Overview
This document contains essential knowledge about the Youngil ONC database structure, business rules, and calculation methods. Use this as a reference when building queries or implementing new features.

---

## 1. Database Tables

### Core Operational Tables (Normalized)
| Table | Display Name | Row Count | Key Columns | Purpose |
|-------|-------------|-----------|-------------|---------|
| `sales` | 판매현황 | ~6,500 | 일자, 거래처코드, 품목코드, 수량, 중량, 합계 | Sales transactions (NORMALIZED) |
| `purchases` | 구매현황 | ~5,000 | 일자, 거래처코드, 품목코드, 수량, 중량, 합_계 | Purchase transactions (denormalized) |
| `ledger` | 계정별원장 | ~6,160 | 일자, 적요, 계정코드, 거래처코드, 차변금액, 대변금액, 잔액 | Unified accounting ledger (Source of Truth) |
| `bank_accounts` | 계좌리스트 | 56 | 계좌코드, 계좌명, 계정명_계정코드_ | Bank account metadata |
| `inventory` | 창고별재고 | ~54,000 | 품목코드, 창고코드, 재고수량 | Current inventory by warehouse |
| `inventory_transfers` | 창고이동현황 | ~138 | 일자, 출고창고명, 입고창고명, 품목명_규격, 수량 | Inter-warehouse transfers |

### Lookup Tables (NEW - for normalized schema)
| Table | Display Name | Row Count | Key Columns | Purpose |
|-------|-------------|-----------|-------------|---------|
| `items` | 품목 | 3,317 | 품목코드, 품목그룹1코드, 품목그룹2코드, 품목그룹3코드, 품목명 | Product master data |
| `clients` | 거래처리스트 | 10,755 | 거래처코드, 거래처명, 업종분류코드, 담당자코드, 지역코드 | Customer/vendor master |
| `warehouses` | 창고 | 25 | 창고코드, 창고명 | Warehouse master |
| `employees` | 사원 | 65 | 사원_담당_코드, 사원_담당_명 | Employee master |
| `employee_category` | 사원분류 | 47 | 담당자, b2b사업소, 전체사업소 | Employee branch assignments |
| `company_type_auto` | AUTO 업종분류기준 | 35 | 업종분류코드, 모빌_대시보드채널 | Customer industry classification |
| `company_type` | 업종분류 | 116 | 업종분류코드, 모빌분류, 산업분류 | Industry type definitions |

### Schema Changes (March 2026)
**IMPORTANT**: The `ledger` table was rebuilt on March 24, 2026, to include all collection data previously in `deposits`.

**NEW (March 24, 2026)**:
- `deposits` table is **DEPRECATED**. Use `ledger` instead.
- `ledger` table structure: `일자`, `적요`, `계정코드`, `거래처코드`, `차변금액`, `대변금액`, `잔액`.
- **Rule**: Customer collections (수금) are entries in `ledger` where `계정코드 = '1089'` (외상매출금) and `대변금액 > 0`.
- **Rule**: To identify **Card** vs **Cash** in ledger:
  - **Card**: `적요` contains `카드`, `이니시스`, `삼성`, `비씨`, `현대`, `롯데`, or bank names followed by numeric settlement IDs (e.g., `농협50389644`).
  - **Cash**: All other `1089` credits, excluding `적요 LIKE '%할인%'`.
- **Rule**: To get **Branch (사업소)**, JOIN with `clients` on `거래처코드` and use `거래처그룹1명`.
- **Rule**: Account codes:
  - `1039`: 보통예금 (Ordinary Deposit)
  - `1089`: 외상매출금 (Accounts Receivable)
  - `1109`: 받을어음 (Notes Receivable)
  - `1023/1024/1025`: 현금 시재금 (Cash on hand)

---

## 2. Branch Names (사업소)
**Standard**: MB, 화성, 창원, 남부, 중부, 서부, 동부, 제주, 부산

### Branch Mapping by Table

**`sales` (NORMALIZED - direct JOIN path)**:
```sql
-- Branch comes from employee_category.전체사업소 via direct JOIN:
-- sales → employees → employee_category
SELECT
  ec.전체사업소 as branch
FROM sales s
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**Other tables**:
- `purchases`: 거래처그룹1명 (still denormalized)
- `ledger` (Collections): `거래처그룹1명` (via JOIN with `clients`)
- `promissory_notes`: `부서명`
- `inventory_transfers`: `출고창고명`, `입고창고명`

### Branch Value Mapping
The `employee_category` (사원구분코드) table stores branch names in Korean, which need to be mapped to standardized short codes for display and analysis:

```sql
CASE
  WHEN ec.전체사업소 = '벤츠' THEN 'MB'  -- Mercedes-Benz division
  WHEN ec.전체사업소 = '경남사업소' OR ec.전체사업소 = '창원사업소' THEN '창원'
  WHEN ec.전체사업소 LIKE '%화성%' THEN '화성'
  WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
  WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
  WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
  WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
  WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
  WHEN ec.전체사업소 LIKE '%부산%' THEN '부산'
  ELSE REPLACE(REPLACE(ec.전체사업소, '사업소', ''), '지사', '')
END
```

---

## 3. Product Categories (품목그룹)

### Brand-Specific Codes
- **Mobil**: `품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'MB')`
- **Mobil-MB**: `품목그룹1코드='MB'` OR `판매처명 LIKE '메르세데스벤츠%'`
- **Blaser**: `품목그룹1코드='BL'`
- **Fuchs**: `품목그룹1코드='FU'`
- **Shell**: `품목그룹1코드='SH'`

---

## 4. Data Cleaning
Many numeric columns stored as TEXT with commas: `"1,234,567"`

**Always use**: `CAST(REPLACE(column,',','') AS NUMERIC)` (unless table is rebuilt with REAL type)

---

## 5. Dates
- **Standard Format**: `YYYY-MM-DD` (e.g., `2026-03-05`)
- **Ledger Format**: `YYYY-MM-DD`

---

## 6. Collections (수금)

### Ledger (Replaces Deposits)
- **Table**: `ledger`
- **Filter**: `계정코드='1089'` (외상매출금) and `대변금액 > 0`
- **Branch**: JOIN with `clients` on `거래처코드` to get `거래처그룹1명`.
- **Card**: `적요` LIKE '%카드%' or '%이니시스%' or issuer names (삼성, 현대, 비씨, 롯데, 농협, 하나)
- **Cash**: All other `1089` credits, excluding `적요 LIKE '%할인%'`

---

## 7. Sales terminology: 판매량 · 매출 (VAT)

### 판매량 = 중량
- In business language, reports, and dashboards, **판매량** means **중량** (weight, typically liters), **not** piece count.
- For aggregates labeled 판매량 / 판매량(L) / 용량, use the **`중량`** column (e.g. `SUM` of `sales.중량`, `purchases.중량`), not **`수량`**.

### 매출 = 공급가 (부가세 제외); 환산 규칙
- For analysis and cross-report consistency, **매출** is treated as **공급가 — excluding 10% VAT**.
- When the source amount is **VAT-inclusive** (공급가+부가세), convert to 공급가 매출 by **dividing by 1.1** and **rounding** to a whole currency unit (원):

```sql
ROUND(CAST(REPLACE(합계, ',', '') AS NUMERIC) / 1.1)
```

Use the same pattern for any other VAT-inclusive sales total column after comma cleaning. **Do not** divide if the column is already 공급가-only (e.g. some exports use separate `공급가액`).

---

## 8. Ledger (원장) - Funds Status

### Key Accounts (계정코드)
- `1023/1024/1025`: 현금 시재금 (창원/화성/서울)
- `1039`: 보통예금
- `3350`: 퇴직연금운용자산
- `1109`: 받을어음
- `1040`: 외화예금

---

## 11. Daily Inventory Calculation (일일재고파악시트)

### Formula
The daily inventory sheet uses a **backwards calculation** from current inventory:

```
Beginning Inventory = Ending Inventory - Purchases + Sales - Net Transfers
```

---

## Quick Reference Card

| What | Where | Filter Column | Format |
|------|-------|---------------|--------|
| Sales by branch | `sales` (JOIN via employees→employee_category) | `ec.전체사업소` | LIKE '%사업소%' OR = '벤츠' |
| Purchases by branch | `purchases` | `거래처그룹1명` | LIKE '%창원%' |
| Inventory by warehouse | `inventory` | `창고명` | LIKE '%창원%' |
| Collections by branch | `ledger` (JOIN via clients) | `c.거래처그룹1명` | LIKE '%창원%' |
| Product categories | `items` table | `품목코드` | Exact match |
| Daily transactions | All tables | `일자` | 'YYYY-MM-DD' |
| Ledger entries | `ledger` | `일자` | 'YYYY-MM-DD' |
| 판매량 (volume) | `sales`, `purchases`, division sales | **`중량`** | Sum `중량`, not `수량` |
| 매출 (ex-VAT) | `sales` etc. | `합계` (if VAT-inclusive) | `ROUND(clean/1.1)` → 공급가 |

---

**Last Updated**: 2026-04-03 (§7: 판매량=중량, 매출 공급가 환산)
