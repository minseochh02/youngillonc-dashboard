# Database Knowledge - Youngil ONC

## Overview
This document contains essential knowledge about the Youngil ONC database structure, business rules, and calculation methods. Use this as a reference when building queries or implementing new features.

---

## 1. Database Tables

### Core Operational Tables
| Table | Display Name | Row Count | Key Columns | Purpose |
|-------|-------------|-----------|-------------|---------|
| `sales` | 판매현황 | 14,496 | 일자, 품목코드, 거래처그룹1코드명, 수량, 중량 | Sales transactions |
| `purchases` | 구매현황 | 4,918 | 일자, 품목코드, 거래처그룹1명, 수량, 중량 | Purchase transactions |
| `inventory` | 창고별재고 | 54,026 | 품목코드, 창고명, 재고수량 | Current inventory by warehouse |
| `inventory_transfers` | 창고이동현황 | 122 | 일자, 출고창고명, 입고창고명, 품목명_규격, 수량 | Inter-warehouse transfers |
| `ledger` | 계정별원장 | 20,209 | 일자, 계정명, 거래처명, 차변금액, 대변금액, 잔액 | General ledger entries |

### Supporting Tables
| Table | Display Name | Row Count | Purpose |
|-------|-------------|-----------|---------|
| `product_mapping` | 품목코드매핑 | 709 | Product categorization lookup (품목그룹1코드, 품목그룹3코드) |
| `purchase_orders` | 발주서현황 | 1,122 | Purchase orders (발주서) |
| `deposits` | 입금보고서집계 | 1,410 | Customer deposits and payments |
| `promissory_notes` | 받을어음거래내역 | 157 | Promissory notes receivable |
| `pending_purchases` | 미구매현황 | 221 | Unfulfilled purchase orders |
| `pending_sales` | 미판매현황 | 12 | Unfulfilled sales orders |
| `internal_uses` | 자가사용현황 | 51 | Internal usage/consumption |
| `kakaotalk_egdesk_pm` | 카카오톡 메시지 | 905 | Imported chat history |
| `sync_activity_log` | 동기화 로그 | - | Activity logs for data sync operations |
| `import_operations` | 임포트 작업 | 12 | Track status of data import tasks |
| `user_data_embeddings` | 벡터 임베딩 | - | Vector representations for AI semantic search |

### Important Notes
- **`inventory` table lacks 품목그룹1코드 and 품목그룹3코드**: Use `product_mapping` table to get category information
- **`inventory_transfers` has 품목그룹 codes**: Unlike `inventory`, this table now contains categorization codes directly.
- **Numeric values stored as TEXT**: Many columns contain comma-formatted numbers (e.g., "1,234,567")
- **Date format standardized**: Most tables use `YYYY-MM-DD`, including `inventory_transfers`. `ledger` uses `YYYY/MM/DD`.
- **`inventory_transfers` no longer has 품목코드**: Use `품목명_규격` for reference if needed, but categorization is built-in.

---

## 2. Branch Names (사업소)
**Standard**: MB, 화성, 창원, 남부, 중부, 서부, 동부, 제주, 부산

**Column by Table**:
- `sales`: 거래처그룹1코드명
- `purchases`: 거래처그룹1명
- `deposits`, `promissory_notes`, `ledger`: 부서명
- `inventory_transfers`: `출고창고명`, `입고창고명`

**SQL Pattern**:
```sql
CASE
  WHEN column LIKE '%창원%' THEN '창원'
  WHEN column LIKE '%화성%' THEN '화성'
  WHEN column LIKE '%MB%' THEN 'MB'
  WHEN column LIKE '%남부%' THEN '남부'
  WHEN column LIKE '%중부%' THEN '중부'
  WHEN column LIKE '%서부%' THEN '서부'
  WHEN column LIKE '%동부%' THEN '동부'
  WHEN column LIKE '%제주%' THEN '제주'
  WHEN column LIKE '%부산%' THEN '부산'
  ELSE column
END
```

## 3. Product Categories (품목그룹)

### Category Hierarchy (품목그룹1코드)
Products are categorized into three main industry groups:

| Category | 품목그룹1코드 | Product Count | Description |
|----------|---------------|---------------|-------------|
| **Auto** | `PVL`, `CVL` | 145 | Automotive oils (Passenger Vehicle Lubricants + Commercial Vehicle Lubricants) |
| **IL** | `IL` | 295 | Industrial oils |
| **MB** | `MB`, `AVI` | 19 | Mercedes-Benz + Aviation oils |
| **Others** | All other codes | 250 | Other brands (Fuchs, Shell, Blaser, GS, etc.) |

### SQL Pattern for Categorization
```sql
CASE
  WHEN 품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
  WHEN 품목그룹1코드 = 'IL' THEN 'IL'
  WHEN 품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
  ELSE 'Others'
END as category
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
- **Mobil**: `품목그룹1코드 IN ('IL','PVL','MB','CVL','AVI','MAR')`
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
- **Date Column**: `전표번호` (NOT `일자`)
- **Filter**: `계정명='외상매출금'` only
- **Branch Column**: `부서명`
- **Card**: `계좌 LIKE '%카드%' OR 계좌 LIKE '%이니시스%'`
- **Cash**: All other accounts

### Promissory Notes (어음)
- **Table**: `promissory_notes`
- **Filter**: `증감구분='증가'`

## 7. Mobil Purchases (모빌결제)
- **Table**: `purchase_orders` only
- **Filter**: `거래처명 LIKE '%모빌%'`
- **Industry Groups**:
  - IL (Industrial): `품목그룹1코드='IL'`
  - AUTO: `품목그룹1코드 IN ('PVL','CVL')`
  - MBK: `품목그룹1코드 IN ('MB','AVI')`

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
- **Weight to D/M**: Divide by 200 (`중량/200.0`)
- **Flagship**: Track in Liters (L), not D/M
- **Currency**: KRW (₩)
- **Default Unit**: Liters (L) for oil products

## 10. Product Mapping Table

### Overview
The `product_mapping` table is a **critical reference table** that provides product categorization for the `inventory` table, which lacks 품목그룹 codes.

### Schema
```sql
CREATE TABLE product_mapping (
  id INTEGER PRIMARY KEY,
  품목코드 TEXT UNIQUE,
  품목명 TEXT,
  품목그룹1코드 TEXT,
  품목그룹1명 TEXT,
  품목그룹2명 TEXT,
  품목그룹3코드 TEXT,
  last_seen_date TEXT
)
```

### Statistics
- **Total Products**: 709
- **Unique Group1 Codes**: 21 (IL, PVL, CVL, MB, AVI, FU, BL, SH, GS, etc.)
- **Unique Group3 Codes**: 4 (FLA, STA, PRE, etc.)
- **Top Category**: IL (Industrial) with 295 products
- **Data Source**: Aggregated from `sales` and `purchases` tables

### Rebuild Instructions
When new products are added to sales/purchases:
```bash
npx tsx scripts/build-product-mapping.ts
```

This script:
1. Drops existing `product_mapping` table
2. Creates new table with proper schema
3. Aggregates products from `sales` and `purchases`
4. De-duplicates by 품목코드 (prefers non-null values)
5. Inserts 700+ product mappings

### Usage Examples

**Join with inventory for categorization:**
```sql
SELECT
  i.창고명,
  i.품목코드,
  i.재고수량,
  p.품목그룹1코드,
  p.품목그룹3코드,
  CASE
    WHEN p.품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
    WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
    WHEN p.품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
    ELSE 'Others'
  END as category
FROM inventory i
LEFT JOIN product_mapping p ON i.품목코드 = p.품목코드
```

**Check for unmapped products:**
```sql
SELECT i.*
FROM inventory i
LEFT JOIN product_mapping p ON i.품목코드 = p.품목코드
WHERE p.품목코드 IS NULL
```

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
2. JOINs with `product_mapping` for categorization
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

### Get Sales by Branch and Date
```sql
SELECT
  CASE
    WHEN 거래처그룹1코드명 LIKE '%창원%' THEN '창원'
    WHEN 거래처그룹1코드명 LIKE '%화성%' THEN '화성'
    -- ... other branches
  END as branch,
  SUM(CAST(REPLACE(중량, ',', '') AS NUMERIC)) as total_weight
FROM sales
WHERE 일자 = '2026-02-03'
GROUP BY branch
```

### Get Current Inventory by Category
```sql
SELECT
  CASE
    WHEN p.품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
    WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
    WHEN p.품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
    ELSE 'Others'
  END as category,
  SUM(CAST(REPLACE(i.재고수량, ',', '') AS NUMERIC)) as total_inventory
FROM inventory i
LEFT JOIN product_mapping p ON i.품목코드 = p.품목코드
GROUP BY category
```

### Get Daily Collections (Card vs Cash)
```sql
SELECT
  부서명 as branch,
  CASE
    WHEN 계좌 LIKE '%카드%' OR 계좌 LIKE '%이니시스%' THEN 'Card'
    ELSE 'Cash'
  END as payment_type,
  SUM(CAST(REPLACE(금액, ',', '') AS NUMERIC)) as total_amount
FROM deposits
WHERE 계정명 = '외상매출금'
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

### Use product_mapping Table
- Always JOIN with `product_mapping` instead of scanning `sales`/`purchases` for categories
- Much faster for inventory categorization

### Batch Operations
- When inserting to `product_mapping`, use batches of 100 rows
- See `scripts/build-product-mapping.ts` for reference

## 15. Troubleshooting

### Inventory Categorization Not Working
- **Check**: Does `product_mapping` table exist?
- **Fix**: Run `npx tsx scripts/build-product-mapping.ts`

### Daily Inventory Shows Zero
- **Check**: Date format correct? (`YYYY-MM-DD`)
- **Check**: Transfer date formats in `inventory_transfers` table (now uses standard `YYYY-MM-DD`)
- **Check**: Branch filtering - are you filtering the right column per table?

### Missing Products in Mapping
- **Cause**: New products added to `sales` or `purchases` after mapping table built
- **Fix**: Rebuild product_mapping table
- **Check**: Query for unmapped products:
  ```sql
  SELECT DISTINCT i.품목코드, i.품목명_규격_
  FROM inventory i
  LEFT JOIN product_mapping p ON i.품목코드 = p.품목코드
  WHERE p.품목코드 IS NULL
  ```

### Numeric Values Incorrect
- **Cause**: Forgot to strip commas before CAST
- **Fix**: Always use `CAST(REPLACE(column, ',', '') AS NUMERIC)`

---

## Quick Reference Card

| What | Where | Filter Column | Format |
|------|-------|---------------|--------|
| Sales by branch | `sales` | `거래처그룹1코드명` | LIKE '%창원%' |
| Purchases by branch | `purchases` | `거래처그룹1명` | LIKE '%창원%' |
| Inventory by warehouse | `inventory` | `창고명` | LIKE '%창원%' |
| Collections by branch | `deposits`, `promissory_notes` | `부서명` | LIKE '%창원%' |
| Product categories | `product_mapping` | `품목코드` | Exact match |
| Daily transactions | All tables | `일자` | 'YYYY-MM-DD' |
| Ledger entries | `ledger` | `일자` | LIKE 'YYYY/MM/DD%' |

---

**Last Updated**: 2026-03-11
**Maintainer**: See `scripts/` directory for maintenance scripts
