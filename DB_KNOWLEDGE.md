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
| `east_division_sales` | 동부판매 | ~1,340 | 일자, 거래처코드, 품목코드, 중량, 합계 | East division supplemental sales |
| `west_division_sales` | 서부판매 | ~1,660 | 일자, 거래처코드, 품목코드, 중량, 합계 | West division supplemental sales |
| `south_division_sales` | 남부판매 | ~990 | 일자, 거래처코드, 품목코드, 중량, 합계 | South division supplemental sales |
| `east_division_purchases` | 동부구매 | ~140 | 일자, 거래처코드, 품목코드, 중량 | East division supplemental purchases |
| `west_division_purchases` | 서부구매 | ~160 | 일자, 거래처코드, 품목코드, 중량 | West division supplemental purchases |
| `south_division_purchases` | 남부구매 | ~90 | 일자, 거래처코드, 품목코드, 중량 | South division supplemental purchases |
| `inventory` | 창고별재고 | ~54,000 | 품목코드, 창고코드, 재고수량 | Current inventory by warehouse |
| `inventory_transfers` | 창고이동현황 | ~138 | 일자, 출고창고명, 입고창고명, 품목명_규격, 수량 | Inter-warehouse transfers |
| `ledger` | 계정별원장 | ~20,600 | 일자, 계정명, 거래처명, 차변금액, 대변금액, 잔액 | General ledger entries |

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
**IMPORTANT**: The `sales` table was **normalized** from 27 denormalized columns to 17 columns:

**NEW (March 22, 2026)**: The `deposits` table schema was updated:
- `전표번호` column renamed to `일자`.
- `부서명` and `거래처명` columns removed.
- **Rule**: To get `부서명`, JOIN with `ledger` on `일자`, `적요`, `계정명`, and `금액` (matching `대변금액`).
- **Rule**: To get `거래처명`, JOIN with `clients` on `거래처코드`.

**OLD (deprecated)**: Sales had inline data like `거래처그룹1코드명`, `판매처명`, `품목그룹1코드`, `창고명`
**NEW (current)**: Sales has foreign keys: `거래처코드`, `품목코드`, `출하창고코드`

**Foreign Key Relationships**:
- `sales.거래처코드` → `clients.거래처코드`
- `sales.품목코드` → `items.품목코드`
- `sales.출하창고코드` → `warehouses.창고코드`
- `clients.담당자코드` → `employees.사원_담당_코드`
- `employees.사원_담당_명` → `employee_category.담당자`

**NOTE**: The `purchases` table is still denormalized (has inline `거래처그룹1명`, `품목그룹1코드`, etc.)

### Supporting Tables
| Table | Display Name | Row Count | Purpose |
|-------|-------------|-----------|---------|
| `purchase_orders` | 발주서현황 | 1,122 | Purchase orders (발주서) |
| `deposits` | 입금보고서집계 | ~1,650 | 일자, 계좌, 계정명, 거래처코드, 금액 | Customer deposits (Updated Mar 22) |
| `promissory_notes` | 받을어음거래내역 | 157 | Promissory notes receivable |
| `pending_purchases` | 미구매현황 | 221 | Unfulfilled purchase orders |
| `pending_sales` | 미판매현황 | 12 | Unfulfilled sales orders |
| `internal_uses` | 자가사용현황 | 51 | Internal usage/consumption |
| `kakaotalk_egdesk_pm` | 카카오톡 메시지 | 905 | Imported chat history |
| `sync_activity_log` | 동기화 로그 | - | Activity logs for data sync operations |
| `import_operations` | 임포트 작업 | 12 | Track status of data import tasks |
| `user_data_embeddings` | 벡터 임베딩 | - | Vector representations for AI semantic search |

### Important Notes
- **`inventory` table lacks 품목그룹1코드 and 품목그룹3코드**: Use `items` table to get category information via JOIN on `품목코드`.
- **`inventory_transfers` has 품목그룹 codes**: Unlike `inventory`, this table now contains categorization codes directly.
- **Numeric values stored as TEXT**: Many columns contain comma-formatted numbers (e.g., "1,234,567")
- **Date format standardized**: Most tables use `YYYY-MM-DD`, including `inventory_transfers`. `ledger` uses `YYYY/MM/DD`.
- **`inventory_transfers` no longer has 품목코드**: Use `품목명_규격` for reference if needed, but categorization is built-in.

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

**NOTE**: Some supplemental tables (like `south_division_sales`) may require joining on `담당자명` instead of `담당자코드`.

**Other tables**:
- `purchases`: 거래처그룹1명 (still denormalized)
- `east_division_sales`, `west_division_sales`, `south_division_sales`: Used for supplemental branch-specific sales.
- `east_division_purchases`, `west_division_purchases`, `south_division_purchases`: Used for supplemental branch-specific purchases.
- `deposits`, `promissory_notes`, `ledger`: 부서명
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

**Note**: The `employee_category` table is also referred to as `사원구분코드` (employee classification code) table in business documentation.

### Employee Segments (B2B / B2C)
The `employee_category` table is used to filter employees into **B2B** or **B2C** segments.

- **B2B**: Employees where `b2c_팀 = 'B2B'`
- **B2C**: Employees where `b2c_팀 != 'B2B'` (includes teams like '1맥심팀', '2솔개팀', '3아리안팀', etc.)

**Actual branch values in employee_category**:
- `벤츠` → Maps to "MB"
- `경남사업소` or `창원사업소` → Maps to "창원"
- `화성사업소`, `중부사업소`, `동부사업소`, `서부사업소`, `부산사업소`, `남부지사`, `제주사업소`
- `별도` → Special category for internal transfer employees (like 김도량)

### Special Employees & Exclusions

**Employees to EXCLUDE:**
- **김도량 (사원코드: 31)**: Used for internal transfers between branches. This employee is assigned to TWO branches simultaneously:
  - **동부 (East)**: Transactions with customer code `거래처코드 = 'YI90000'`
  - **서부 (West)**: Transactions with customer code `거래처코드 = 'YI90001'`
  - These transactions represent internal transfers where **Young-il (영일)** head office is purchasing from or distributing to branch offices.
  - These should NOT be counted in general business metrics.
  - **IMPORTANT**: This exclusion applies ONLY when using the three-table join structure (Sales/Purchases + Employees + Employee Category) for branch-based analysis.

**Query Pattern for Exclusion**:
```sql
-- Simple exclusion (general metrics)
WHERE e.사원_담당_명 != '김도량'

-- Branch-specific handling (when needed)
WHERE e.사원_담당_명 = '김도량'
  AND s.거래처코드 = 'YI90000'  -- 동부 transactions
  -- OR
WHERE e.사원_담당_명 = '김도량'
  AND s.거래처코드 = 'YI90001'  -- 서부 transactions
```

**Special Cases (INCLUDE in metrics):**
- **이미숙**: Employee who is neither B2B nor B2C (not assigned to either category in employee_category table), but her transactions SHOULD be counted in general business metrics.

### Data Quality Issues

**Case Sensitivity Mismatch (화성auto vs 화성AUTO):**
- **Issue**: The `employees` table contains `사원_담당_명 = '화성auto'` (lowercase "auto"), but the `employee_category` table has `담당자 = '화성AUTO'` (uppercase "AUTO").
- **Impact**: The JOIN between `employees` and `employee_category` fails for this employee because SQL string comparison is case-sensitive, resulting in null branch assignment (전체사업소 = NULL).
- **Data Source**: The Excel file `2602 판매실적 영일.xlsx` contains 13 transactions with employee name "화성auto" (lowercase), which were imported into the `employees` table as-is.
- **Affected Records**: 13 sales transactions (216 L total) in February 2026 fall into "기타 (null)" category when categorizing by branch.
- **Resolution**: Either:
  1. Update `employees` table: `UPDATE employees SET 사원_담당_명 = '화성AUTO' WHERE 사원_담당_명 = '화성auto'`
  2. Update `employee_category` table: `UPDATE employee_category SET 담당자 = '화성auto' WHERE 담당자 = '화성AUTO'`
  3. Use case-insensitive collation in JOIN queries (SQLite default is case-sensitive for non-ASCII characters)
- **Note**: There are 21 total employees in the `employees` table with no matching entry in `employee_category`, causing similar null branch issues.

## 3. Product Categories (품목그룹)

### Category Hierarchy (품목그룹1코드)
The `품목그룹1코드` represents the main category or brand.

| Code | Name (KOR) | Description |
|------|------------|-------------|
| **PVL** | Mobil-자동차 | Passenger Vehicle Lubricants |
| **CVL** | Mobil-대형차 | Commercial Vehicle Lubricants |
| **IL** | Mobil-산업유 | Industrial Lubricants |
| **MB** | Mobil-MB | Mercedes-Benz specific oils |
| **AVI** | Mobil-항공기유 | Aviation oils |
| **FU** | Fuchs | Brand: Fuchs |
| **BL** | Blaser | Brand: Blaser |
| **SH** | Shell | Brand: Shell |
| **GS** | GS Caltex | Brand: GS Caltex |
| **CA** | Castrol | Brand: Castrol |
| **AA** | 기타제품 | Others (Washer fluid, etc.) |
| **XT** | H-Oilbank | Brand: Hyundai Oilbank |
| **ST** | S-Total | Brand: S-Oil Total |
| **SK** | SK Lub. | Brand: SK Lubricants (ZIC) |

### Sub-Categories (품목그룹2명)
Common values for `품목그룹2명` include:
- **Engine Oil**: `PVL-Engine Oil`, `CVL-Engine Oil`
- **Gear Oil**: `PVL-Gear Oil`, `CVL-Gear Oil`, `기어오일`
- **Industrial**: `유압유` (Hydraulic), `절삭유` (Cutting oil), `습동면유` (Slideway), `터빈오일`, `컴프레샤유`
- **Maintenance**: `Grease`, `ATF`, `부동액` (Antifreeze), `워셔액`, `브레이크액`

### Tier Classification (품목그룹3코드)
Products are classified by tier/grade:
- **FLA**: **Flagship** (Premium/Top-tier)
- **PRE**: **Premium**
- **STA**: **Standard**
- **ALL**: General/All

### Business Classification (AUTO Channels)
The term **"AUTO"** refers to specific business types/channels, not just the product type. These are defined in the `company_type_auto` table based on the customer's `업종분류코드`.

**Key Channels (`모빌_대시보드채널`):**
1. **Mobil 1 CCO** (`28110`)
2. **Mobil Brand Shop** (`28120`)
3. **IWS (Anycar/Bosch/etc.)** (`28230-28330`)
4. **Fleet** (`28600-28710`)
5. **Reseller** (`28500-28510`)

### SQL Pattern for Business Classification
```sql
-- Identify "Auto" channel transactions
SELECT
  s.*,
  ca.모빌_대시보드채널 as auto_channel
FROM sales s
JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
WHERE ca.업종분류코드 IS NOT NULL
```

### Tier Classification (품목그룹3코드)
Products are also classified by tier:
- **Flagship**: `품목그룹3코드='FLA'` (Premium products)
- **Others**: All other tier codes (Standard/Premium/etc.)

```sql
CASE
  WHEN 품목그룹3코드 = 'FLA' THEN 'Flagship'
  ELSE 'Others'
END as tier
```

### Brand-Specific Codes
- **Mobil**: `품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'MB')`
- **Mobil-MB**: `품목그룹1코드='MB'` OR `판매처명 LIKE '메르세데스벤츠%'`
- **Blaser**: `품목그룹1코드='BL'`
- **Fuchs**: `품목그룹1코드='FU'`
- **Shell**: `품목그룹1코드='SH'`
- **GS Caltex**: `품목그룹1코드='GS'`
- **Castrol**: `품목그룹1코드='CA'`

## 4. Data Cleaning
Many numeric columns stored as TEXT with commas: `"1,234,567"`

**Always use**: `CAST(REPLACE(column,',','') AS NUMERIC)`

**Apply to**: 합_계, 공급가액, 중량, 금액, 수량, 재고수량, 차변금액, 대변금액, 잔액

## 5. Dates
- **Standard Format**: `YYYY-MM-DD` (e.g., `2026-03-05`)
- **Ledger Format**: `YYYY/MM/DD` (filter with `LIKE '2026/03/05%'`)
- **Transfer Format**: `일자` column uses standard `YYYY-MM-DD` format.

## 6. Collections (수금)

### Deposits (입금)
- **Table**: `deposits`
- **Date Column**: `일자` (Updated Mar 22 from `전표번호`)
- **Filter**: `계정명='외상매출금'` only
- **Branch**: JOIN with `ledger` on `일자`, `적요`, `계정명`, `금액` (matching `대변금액`) to get `부서명`.
- **Card**: `계좌 LIKE '%카드%' OR 계좌 LIKE '%이니시스%'`
- **Cash**: All other accounts

### Promissory Notes (어음)
- **Table**: `promissory_notes`
- **Filter**: `증감구분='증가'`

## 7. Mobil Purchases (모빌결제)
- **Table**: `purchase_orders` only
- **Key Columns**: `일자`, `창고코드`, `품목그룹1코드`, `합계`
- **Filter**: `품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'MB')`
- **Industry Groups**:
  - IL (Industrial): `품목그룹1코드='IL'`
  - AUTO: `품목그룹1코드 IN ('PVL','CVL')`
  - MBK: `품목그룹1코드='MB'`
- **Notes**: JOIN with `warehouses` on `창고코드` to get the branch name. Use `일자` for date filtering (not `월_일`).

## 8. Ledger (원장) - Funds Status

### Key Accounts (계정명)
**KRW Assets**:
- `현금 시재금%` (시재금-서울/창원/화성)
- `보통예금`
- `퇴직연금운용자산`
- `받을어음`

**Foreign**:
- `외화예금`

**Liabilities**:
- `단기차입금`
- `장기차입금`

### Balance Calculation
- `일자_no_`: Date format `YYYY/MM/DD -n`
- `차변금액`: Debit (increase)
- `대변금액`: Credit (decrease)
- `잔액`: Running balance (use latest `id` per account per date)

### Daily Flow (입출금현황)
**Only from** `ledger` where `계정명='보통예금'`:
- **Deposits**: `차변금액 > 0`
- **Withdrawals**: `대변금액 > 0`

## 9. Units
- **중량 (Weight)**: Values in the `중량` column across all tables (sales, purchases, inventory, etc.) are in **Liters (L)**.
- **Weight to D/M**: Divide by 200 (`중량/200.0`) to convert to Drum equivalents (1 Drum = 200L).
- **Flagship**: Track in Liters (L), not D/M
- **Currency**: KRW (₩)
- **Default Unit**: Liters (L) for oil products

## 11. Daily Inventory Calculation (일일재고파악시트)

### Formula
The daily inventory sheet uses a **backwards calculation** from current inventory:

```
Beginning Inventory = Ending Inventory - Purchases + Sales - Net Transfers
```

Where:
- **Ending Inventory**: Current stock from `inventory` table (재고수량)
- **Purchases**: Today's purchases from `purchases` table (수량)
- **Sales**: Today's sales from `sales` table (수량)
- **Net Transfers**: Transfer In - Transfer Out from `inventory_transfers` table (수량)

### Data Sources
The calculation consolidates data from 4 tables:
1. **`inventory`**: Current ending inventory by warehouse and product
2. **`sales`**: Daily sales transactions (outflow)
3. **`purchases`**: Daily purchase transactions (inflow)
4. **`inventory_transfers`**: Inter-warehouse movements (using `일자` for date filtering)

### Implementation
Location: `src/app/api/dashboard/daily-inventory/route.ts`

The query:
1. UNIONs data from all 4 tables with product codes
2. JOINs with `items` for categorization
3. Groups by branch, category, and tier
4. Calculates beginning inventory using the formula above
5. Returns stats for 8 category/tier combinations × N branches

### Output Structure
For each branch and category/tier combination:
- **기초재고** (beginning): Calculated opening balance
- **매입** (purchase): Today's purchases
- **매출** (sales): Today's sales
- **이동** (transfer): Net transfers (in - out)
- **재고** (inventory): Current ending balance
- **재고 D/M계**: Ending inventory ÷ 200

## 12. Special Rules
- **Changwon Division**: Includes `창고명='창원'` + sales to '테크젠 주식회사' from any warehouse
- **Mobil-MB**: Sales amount often `0`, but weight tracked (quantity tracking more important than revenue)
- **Ledger**: All values already in KRW (foreign accounts pre-converted)
- **Branch Filtering**: Always filter using LIKE patterns (e.g., `LIKE '%창원%'`) to catch variations

## 13. Common Query Patterns

### Important: Query Restrictions
**Only `SELECT` queries are allowed** when using `executeSQL` or the `user_data_sql_query` tool. 
- ❌ `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER` will fail.
- ✅ Use `SELECT` for all data retrieval and analysis.

### Get Sales by Branch and Date (NORMALIZED - requires JOINs)
```sql
SELECT
  CASE
    WHEN ec.전체사업소 = '벤츠' THEN 'MB'
    WHEN ec.전체사업소 = '경남사업소' THEN '창원'
    WHEN ec.전체사업소 LIKE '%화성%' THEN '화성'
    -- ... other branches
  END as branch,
  SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
FROM sales s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
WHERE s.일자 = '2026-02-03'
  AND (ec.전체사업소 LIKE '%사업소%' OR ec.전체사업소 LIKE '%지사%' OR ec.전체사업소 = '벤츠')
GROUP BY branch
```

### Get Current Inventory by Category
```sql
SELECT
  CASE
    WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
    WHEN p.품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
    WHEN p.품목그룹1코드 = 'PVL' THEN 'PVL'
    WHEN p.품목그룹1코드 = 'CVL' THEN 'CVL'
    ELSE 'Others'
  END as category,
  SUM(CAST(REPLACE(i.재고_수량, ',', '') AS NUMERIC)) as total_inventory
FROM inventory i
LEFT JOIN items p ON i.품목코드 = p.품목코드
GROUP BY category
```

### Get Daily Collections (Card vs Cash)
```sql
SELECT
  l.부서명 as branch,
  CASE
    WHEN d.계좌 LIKE '%카드%' OR d.계좌 LIKE '%이니시스%' THEN 'Card'
    ELSE 'Cash'
  END as payment_type,
  SUM(CAST(REPLACE(d.금액, ',', '') AS NUMERIC)) as total_amount
FROM deposits d
JOIN ledger l ON 
  d.일자 = l.일자 AND 
  d.적요 = l.적요 AND 
  d.계정명 = l.계정명 AND 
  REPLACE(d.금액, ',', '') = REPLACE(l.대변금액, ',', '')
WHERE d.계정명 = '외상매출금'
GROUP BY branch, payment_type
```

## 14. Performance Tips

### Always Use Indexes
- Join on `품목코드` (product code) is heavily used - ensure indexed
- Filter by `일자` (date) frequently - consider index
- Branch name filtering uses LIKE - less efficient, but necessary

### Numeric Conversion
- Pre-convert numeric columns at query time: `CAST(REPLACE(column, ',', '') AS NUMERIC)`
- Do NOT convert in application layer - let database handle it

### Use items Table
- Always JOIN with `items` instead of scanning `sales`/`purchases` for categories
- Much faster for inventory categorization

## 15. Troubleshooting

### Inventory Categorization Not Working
- **Check**: Does `items` table have the product code?

### Daily Inventory Shows Zero
- **Check**: Date format correct? (`YYYY-MM-DD`)
- **Check**: Transfer date formats in `inventory_transfers` table (now uses standard `YYYY-MM-DD`)
- **Check**: Branch filtering - are you filtering the right column per table?

### Missing Products in Mapping
- **Check**: Query for unmapped products:
  ```sql
  SELECT DISTINCT i.품목코드, i.품목명_규격_
  FROM inventory i
  LEFT JOIN items p ON i.품목코드 = p.품목코드
  WHERE p.품목코드 IS NULL
  ```

### Numeric Values Incorrect
- **Cause**: Forgot to strip commas before CAST
- **Fix**: Always use `CAST(REPLACE(column, ',', '') AS NUMERIC)`

---

## Quick Reference Card

| What | Where | Filter Column | Format |
|------|-------|---------------|--------|
| Sales by branch | `sales` (JOIN via employees→employee_category) | `ec.전체사업소` | LIKE '%사업소%' OR = '벤츠' |
| Purchases by branch | `purchases` | `거래처그룹1명` | LIKE '%창원%' |
| Inventory by warehouse | `inventory` | `창고명` | LIKE '%창원%' |
| Collections by branch | `deposits`, `promissory_notes` | `부서명` | LIKE '%창원%' |
| Product categories | `items` table | `품목코드` | Exact match |
| Daily transactions | All tables | `일자` | 'YYYY-MM-DD' |
| Ledger entries | `ledger` | `일자` | LIKE 'YYYY/MM/DD%' |

---

**Last Updated**: 2026-03-20 (Added employee 김도량 exclusion note regarding three-table joins)
**Maintainer**: See `scripts/` directory for maintenance scripts
