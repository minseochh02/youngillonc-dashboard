# All Employee Code Usage in Sales and Purchases

Complete catalog of every instance where employee code (`담당자코드`, `employee_code`, `사원_담당_코드`) is used with sales and purchases data.

---

## Executive Summary

Employee code (`담당자코드`) appears in sales/purchases queries in the following ways:

| Usage Type | Count | Description |
|------------|-------|-------------|
| **SELECT from sales tables** | 50+ | Selecting 담당자코드 column in UNION queries |
| **JOIN operations** | 50+ | Joining sales.담당자코드 to employees.사원_담당_코드 |
| **GROUP BY clauses** | 6 | Grouping by employee code (always with employee name) |
| **ORDER BY clauses** | 2 | Sorting by employee code (debug endpoints only) |

**Key Pattern**: Employee code is primarily used to **JOIN** sales data to employees, then employee **NAME** is used for most other operations.

---

## 1. SELECT Employee Code from Sales Tables

These queries explicitly SELECT the `담당자코드` column from sales tables (usually in UNION queries to combine sales/east_division_sales/west_division_sales).

### Pattern:
```sql
SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, ... FROM sales
UNION ALL
SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, ... FROM east_division_sales
UNION ALL
SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, ... FROM west_division_sales
```

### Files Using This Pattern:

#### 1. `src/app/api/dashboard/b2c-meetings/route.ts`
**Lines 42-46**: Base sales table union
```sql
const baseSalesTable = `(
  SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, 수량, 단가 FROM sales
  UNION ALL
  SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, 수량, 단가 FROM east_division_sales
  UNION ALL
  SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, 수량, 단가 FROM west_division_sales
)`;
```

**Usage**: This base table is used in ALL B2C meeting dashboard tabs:
- Business tab (line 49+)
- Manager-sales tab (line 134+)
- Sales-amount tab (line 504+)
- Team-employee tab (line 595+)
- Customer-reason tab (line 825+)
- New clients tab (line 883+)
- Team-volume tab (line 1325+)
- Team-sales tab (line 1387+)

#### 2. `src/app/api/dashboard/b2b-meetings/route.ts`
**Lines 68-72**: Base sales subquery for B2B meetings
```sql
const baseSalesSubquery = `(
  SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM sales
  UNION ALL
  SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM east_division_sales
  UNION ALL
  SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM west_division_sales
)`;
```

**Usage**: Used in all B2B meeting tabs:
- Industry tab (line 75+)
- Client tab
- Product-group tab
- Team tab
- FPS tab
- Region tab
- New clients tab
- All products tab
- Industry-dairy tab

#### 3. `src/app/api/dashboard/b2b-meetings/industry/route.ts`
**Lines 62-66**: Industry-specific sales union
```sql
FROM (
  SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM sales
  UNION ALL
  SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM east_division_sales
  UNION ALL
  SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM west_division_sales
) s
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
```

#### 4. `src/app/api/dashboard/product-status/route.ts`
**Lines 44-48**: Product status sales union
```sql
const salesUnion = `
  SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 실납업체 FROM sales
  UNION ALL
  SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 실납업체 FROM east_division_sales
  UNION ALL
  SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 실납업체 FROM west_division_sales
`;
```

#### 5. `src/app/api/dashboard/daily-status/sales-collections/customer-detail/route.ts`
**Lines 42-46**: Sales collections base subquery
```sql
const baseSalesSubquery = `
  (
    SELECT 일자, 거래처코드, 담당자코드, 합계, 출하창고코드 FROM sales
    UNION ALL
    SELECT 일자, 거래처코드, 담당자코드, 합계, 창고코드 as 출하창고코드 FROM east_division_sales
    UNION ALL
    SELECT 일자, 거래처코드, 담당자코드, 합계, 창고코드 as 출하창고코드 FROM west_division_sales
  )
`;
```

#### 6. `src/app/api/dashboard/daily-status/sales-collections/closing/route.ts`
**Lines 48-52**: Closing status sales union
```sql
const baseSalesSubquery = `
  (
    SELECT 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, 출하창고코드, 실납업체 FROM sales
    UNION ALL
    SELECT 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, east_division_sales.창고코드 as 출하창고코드, 실납업체 FROM east_division_sales
    UNION ALL
    SELECT 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, west_division_sales.창고코드 as 출하창고코드, 실납업체 FROM west_division_sales
  )
`;
```

#### 7. `src/app/api/dashboard/b2b-daily-sales/profit/route.ts`
**Lines 66-70**: B2B daily sales profit calculation
```sql
FROM (
  SELECT 일자, 거래처코드, 담당자코드, 품목코드, 수량, 단가, 합계 FROM sales
  UNION ALL
  SELECT 일자, 거래처코드, 담당자코드, 품목코드, 수량, 단가, 합계 FROM east_division_sales
  UNION ALL
  SELECT 일자, 거래처코드, 담당자코드, 품목코드, 수량, 단가, 합계 FROM west_division_sales
) s
```

#### 8. `src/app/api/test-query/route.ts`
**Lines 19-23 and 50-54**: Test queries (2 instances)
```sql
FROM (
  SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량 FROM sales
  UNION ALL
  SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량 FROM east_division_sales
  UNION ALL
  SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량 FROM west_division_sales
) s
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
```

#### 9. `src/app/api/test-inactive-debug/route.ts`
**Lines 51-55 and 75-79**: Inactive companies debug (2 instances)
```sql
LEFT JOIN (
  SELECT 거래처코드, 일자, 담당자코드, NULL as 담당자명 FROM sales
  UNION ALL
  SELECT 거래처코드, 일자, 담당자코드, NULL as 담당자명 FROM east_division_sales
  UNION ALL
  SELECT 거래처코드, 일자, 담당자코드, NULL as 담당자명 FROM west_division_sales
) s ON c.거래처코드 = s.거래처코드
```

**Note**: These debug queries handle both `담당자코드` and `담당자명` (employee name) to support legacy data.

#### 10. Additional files with sales unions selecting 담당자코드:
- `src/app/api/dashboard/sales-analysis/route.ts` - Dynamic sales analysis
- `src/app/api/dashboard/sales-inventory/route.ts` - Sales inventory dashboard
- `src/app/api/changwon-breakdown/route.ts` - Changwon branch breakdown
- `src/app/api/test-mobil-weight/route.ts` - Mobil weight testing
- `src/app/api/debug/auto-weight-check/route.ts` - Auto weight verification
- `src/app/api/debug/sales-check/route.ts` - Sales data verification

---

## 2. JOIN Operations Using Employee Code

After selecting `담당자코드` from sales, virtually every query joins it to the employees table.

### Standard JOIN Pattern:
```sql
-- Step 1: Join sales to employees using employee code
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드

-- Step 2: Join employees to employee_category using employee name
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

### Complete List of Files Using This JOIN:

#### Dashboard APIs (Production)
1. **`src/app/api/dashboard/b2c-meetings/route.ts`**
   - Line 72: `LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드`
   - Line 73: `LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자`
   - **Used in**: All 8+ B2C meeting tabs

2. **`src/app/api/dashboard/b2b-meetings/route.ts`**
   - Multiple instances throughout for all B2B tabs
   - Same pattern: sales → employees → employee_category

3. **`src/app/api/dashboard/b2b-meetings/industry/route.ts`**
   - Line 69: `LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드`

4. **`src/app/api/dashboard/product-status/route.ts`**
   - Joins sales to employees for B2C/B2B classification

5. **`src/app/api/dashboard/sales-analysis/route.ts`**
   - Dynamic queries with employee joins for flexible analysis

6. **`src/app/api/dashboard/sales-inventory/route.ts`**
   - Sales inventory tracking by employee

7. **`src/app/api/dashboard/closing-meeting/route.ts`**
   - Closing meeting reports by employee/team

8. **`src/app/api/dashboard/daily-status/sales-collections/customer-detail/route.ts`**
   - Customer detail reports with employee assignment

9. **`src/app/api/dashboard/daily-status/sales-collections/closing/route.ts`**
   - Daily closing status by employee territory

10. **`src/app/api/dashboard/b2b-daily-sales/profit/route.ts`**
    - B2B profit analysis by employee

#### Clients Table (Uses 담당자코드 for employee assignment)
11. **`src/app/api/dashboard/inactive-companies/route.ts`**
    - Line 99: `LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드`
    - **Note**: This joins from **clients** table, not sales

12. **`src/app/api/dashboard/long-term-receivables/route.ts`**
    - Uses employee code from clients to identify responsible employee
    - Lines 74-75: Employee code selected from ledger/baseline joins

13. **`src/app/api/dashboard/data-management/route.ts`**
    - Line 43: `LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드`
    - For client-employee relationship management

#### Test/Debug Files
14. **`src/app/api/test-query/route.ts`**
    - Lines 25, 56: Test queries with employee joins

15. **`src/app/api/test-inactive-debug/route.ts`**
    - Lines 58, 82: Complex joins handling both code and name

16. **`src/app/api/changwon-breakdown/route.ts`**
    - Changwon branch employee analysis

17. **`src/app/api/debug/auto-weight-check/route.ts`**
    - Lines 19, 56: Auto weight checks with employee data

18. **`src/app/api/debug/sales-check/route.ts`**
    - Sales data verification by employee

---

## 3. GROUP BY Clauses Using Employee Code

Employee code appears in GROUP BY clauses in only 6 instances, **always alongside employee name**.

### Instance 1: Inactive Companies - Detail View
**File**: `src/app/api/dashboard/inactive-companies/route.ts`
**Lines**: 103, 138, 165

```sql
SELECT
  c.거래처코드,
  c.거래처명,
  e.사원_담당_명 as employee_name,
  e.사원_담당_코드 as employee_code,
  ...
FROM clients c
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
...
GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명, e.사원_담당_코드
```

**Purpose**: Groups inactive companies by employee, using BOTH code and name for uniqueness.

### Instance 2: Inactive Companies - Employee Summary
**File**: `src/app/api/dashboard/inactive-companies/route.ts`
**Line**: 142

```sql
SELECT
  branch_name,
  employee_code,
  employee_name,
  COUNT(DISTINCT 거래처코드) as inactive_count,
  ...
FROM (
  SELECT
    c.거래처코드,
    c.거래처명,
    e.사원_담당_명 as employee_name,
    e.사원_담당_코드 as employee_code,
    ...
  FROM clients c
  LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
  ...
  GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명, e.사원_담당_코드
) AS last_transactions
WHERE branch_name IS NOT NULL AND (employee_name IS NOT NULL OR employee_code IS NOT NULL)
GROUP BY branch_name, employee_code, employee_name
```

**Purpose**: Aggregates inactive company counts by employee.

### Instance 3: Changwon Breakdown
**File**: `src/app/api/changwon-breakdown/route.ts`
**Line**: 23

```sql
SELECT
  e.사원_담당_코드 as employee_code,
  e.사원_담당_명 as employee_name,
  ec.전체사업소 as branch,
  ec.b2c_팀 as team,
  SUM(...) as total_weight,
  ...
FROM (sales UNION ...) s
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
...
GROUP BY e.사원_담당_코드, e.사원_담당_명, ec.전체사업소, ec.b2c_팀
ORDER BY total_weight DESC
```

**Purpose**: Breaks down Changwon sales by employee (code AND name) and branch.

### Instance 4-6: Long-term Receivables
**File**: `src/app/api/dashboard/long-term-receivables/route.ts`
**Lines**: 184-206 (employee grouping), 214 (client grouping includes employee_code)

```sql
-- When groupBy === 'employee'
SELECT
  COALESCE(cr.branch_name, pr.branch_name) as branch_name,
  COALESCE(cr.employee_code, pr.employee_code) as employee_code,
  COALESCE(cr.employee_name, pr.employee_name) as employee_name,
  SUM(COALESCE(cr.balance, 0)) as current_total_receivables,
  ...
FROM (all_clients)
LEFT JOIN (currentSubquery) cr ON all_clients.client_code = cr.client_code
LEFT JOIN (previousSubquery) pr ON all_clients.client_code = pr.client_code
WHERE 1=1
GROUP BY 1, 2, 3  -- This is: branch_name, employee_code, employee_name
HAVING current_total_receivables > 0 OR long_term_receivables > 0 OR previous_month_long_term > 0
ORDER BY 1, long_term_receivables DESC
```

**Purpose**: Groups long-term receivables by branch and employee (using both code and name).

**Subquery context** (lines 70-76):
```sql
SELECT
  all_codes.client_code,
  COALESCE(t.branch_name, b_info.branch_name) as branch_name,
  COALESCE(t.client_name, b_info.client_name) as client_name,
  COALESCE(t.employee_code, b_info.manager_code) as employee_code,
  COALESCE(t.employee_name, b_info.manager_name) as employee_name,
  ...
```

**Note**: Employee code comes from either ledger transactions or baseline data (ar_baselines table stores historical employee assignments).

---

## 4. ORDER BY Clauses Using Employee Code

Employee code is used in ORDER BY in only 2 instances, both in debug/check endpoints.

### Instance 1: Check Duplicate Hwaseong
**File**: `src/app/api/check-duplicate-hwaseong/route.ts`
**Line**: 15

```sql
SELECT
  사원_담당_코드,
  사원_담당_명,
  imported_at
FROM employees
WHERE 사원_담당_명 LIKE '%화성%'
ORDER BY 사원_담당_코드  ⭐ SORTS BY EMPLOYEE CODE
```

**Note**: This queries the **employees** table directly, not sales/purchases.

### Instance 2: Check Employee
**File**: `src/app/api/check-employee/route.ts`
**Line**: 14

```sql
SELECT
  e.사원_담당_코드,
  e.사원_담당_명,
  ec.*
FROM employees e
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
WHERE e.사원_담당_명 LIKE '%화성%'
ORDER BY e.사원_담당_코드  ⭐ SORTS BY EMPLOYEE CODE
```

**Note**: This also queries the **employees** table directly, not sales/purchases.

**Conclusion**: No production sales/purchases queries sort by employee code. They all sort by employee **name** instead.

---

## 5. WHERE Clauses and Filtering

While not grouping or sorting, employee code is used in WHERE clauses for:

### Joining Conditions (Most Common)
```sql
-- Pattern appears in 50+ locations
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
```

### NULL Checks
```sql
-- test-inactive-debug/route.ts:58, 82
LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드)
                      OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
```

This handles cases where old data might have employee name but not code.

---

## 6. SELECT Clauses (Aliasing Employee Code)

Employee code is selected and aliased in several contexts:

### Pattern 1: Direct Selection from Sales
```sql
-- Appears in all sales union queries
SELECT 담당자코드 FROM sales
```

### Pattern 2: Selection After JOIN
```sql
-- inactive-companies/route.ts:88-89
e.사원_담당_명 as employee_name,
e.사원_담당_코드 as employee_code
```

### Pattern 3: COALESCE for Handling NULLs
```sql
-- long-term-receivables/route.ts:74, 184, 214
COALESCE(t.employee_code, b_info.manager_code) as employee_code,
COALESCE(cr.employee_code, pr.employee_code) as employee_code
```

---

## 7. Complete File Summary

| File | SELECT 담당자코드 | JOIN on 담당자코드 | GROUP BY | ORDER BY | Notes |
|------|------------------|-------------------|----------|----------|-------|
| **b2c-meetings/route.ts** | ✅ Lines 42-46 | ✅ Line 72 | ❌ | ❌ | Used across all B2C tabs |
| **b2b-meetings/route.ts** | ✅ Lines 68-72 | ✅ Multiple | ❌ | ❌ | Used across all B2B tabs |
| **b2b-meetings/industry/route.ts** | ✅ Lines 62-66 | ✅ Line 69 | ❌ | ❌ | Industry analysis |
| **product-status/route.ts** | ✅ Lines 44-48 | ✅ Yes | ❌ | ❌ | Product status dashboard |
| **sales-collections/customer-detail/route.ts** | ✅ Lines 42-46 | ✅ Yes | ❌ | ❌ | Customer detail reports |
| **sales-collections/closing/route.ts** | ✅ Lines 48-52 | ✅ Yes | ❌ | ❌ | Daily closing status |
| **b2b-daily-sales/profit/route.ts** | ✅ Lines 66-70 | ✅ Yes | ❌ | ❌ | B2B profit analysis |
| **inactive-companies/route.ts** | ❌ (uses clients) | ✅ Line 99 | ✅ Lines 103, 138, 142, 165 | ❌ | Inactive client tracking |
| **long-term-receivables/route.ts** | ❌ (ledger/baseline) | ✅ Indirect | ✅ Lines 184-206 | ❌ | AR aging by employee |
| **sales-analysis/route.ts** | ✅ Yes (dynamic) | ✅ Yes | ❌ | ❌ | Flexible sales analysis |
| **sales-inventory/route.ts** | ✅ Yes | ✅ Yes | ❌ | ❌ | Inventory by employee |
| **closing-meeting/route.ts** | ✅ Yes | ✅ Yes | ❌ | ❌ | Closing meeting reports |
| **data-management/route.ts** | ❌ (clients table) | ✅ Line 43 | ❌ | ❌ | Client-employee mgmt |
| **changwon-breakdown/route.ts** | ✅ Yes | ✅ Yes | ✅ Line 23 | ❌ | Changwon breakdown |
| **test-query/route.ts** | ✅ Lines 19-23, 50-54 | ✅ Lines 25, 56 | ❌ | ❌ | Test queries |
| **test-inactive-debug/route.ts** | ✅ Lines 51-55, 75-79 | ✅ Lines 58, 82 | ❌ | ❌ | Debug inactive clients |
| **check-duplicate-hwaseong/route.ts** | ❌ (employees table) | ❌ | ❌ | ✅ Line 15 | Check employees only |
| **check-employee/route.ts** | ❌ (employees table) | ❌ | ❌ | ✅ Line 14 | Check employees only |
| **debug/auto-weight-check/route.ts** | ✅ Yes | ✅ Lines 19, 56 | ❌ | ❌ | Weight verification |
| **debug/sales-check/route.ts** | ✅ Yes | ✅ Yes | ❌ | ❌ | Sales verification |
| **test-mobil-weight/route.ts** | ✅ Yes | ✅ Yes | ❌ | ❌ | Mobil weight testing |

---

## 8. Key Patterns Summary

### Pattern 1: Sales Union with Employee Code (50+ instances)
```sql
-- Selecting employee code from all three sales tables
SELECT 담당자코드, ... FROM sales
UNION ALL
SELECT 담당자코드, ... FROM east_division_sales
UNION ALL
SELECT 담당자코드, ... FROM west_division_sales
```

**Purpose**: Combine data from all regional sales tables while preserving employee assignment.

### Pattern 2: Standard Employee JOIN (50+ instances)
```sql
-- Join sales to employees using employee code
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
-- Then join to employee_category using employee name
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**Purpose**: Get employee details and branch/team assignment from sales data.

### Pattern 3: Client Employee Assignment (10+ instances)
```sql
-- Clients table has 담당자코드 indicating responsible employee
FROM clients c
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
```

**Purpose**: Identify which employee is responsible for each client.

### Pattern 4: Group by Code AND Name (6 instances)
```sql
-- Always group by both employee code AND name
GROUP BY e.사원_담당_코드, e.사원_담당_명, ...
```

**Purpose**: Ensure uniqueness and allow tracking by either identifier.

### Pattern 5: Legacy Data Handling (2 instances)
```sql
-- Handle old data that might have name but not code
LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드)
                      OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
```

**Purpose**: Support data from before employee codes were standardized.

---

## 9. Database Schema Context

### Sales Tables Structure
```sql
TABLE sales (
  id,
  일자,                -- Date
  거래처코드,          -- Client code
  담당자코드,          -- Employee code ⭐ THIS FIELD
  품목코드,            -- Product code
  중량,                -- Weight
  합계,                -- Total amount
  수량,                -- Quantity
  단가,                -- Unit price
  출하창고코드         -- Warehouse code
)

-- Same structure for:
-- east_division_sales
-- west_division_sales
```

### Employees Table Structure
```sql
TABLE employees (
  사원_담당_코드,      -- Employee code (primary key) ⭐ JOIN TARGET
  사원_담당_명         -- Employee name
)
```

### Clients Table Structure
```sql
TABLE clients (
  거래처코드,          -- Client code (primary key)
  거래처명,            -- Client name
  담당자코드,          -- Employee code ⭐ THIS FIELD (assigned employee)
  업종분류코드,        -- Industry classification
  지역코드             -- Region code
)
```

### Employee Category Table Structure
```sql
TABLE employee_category (
  담당자,              -- Employee name (links to employees.사원_담당_명)
  b2c사업소,          -- B2C branch
  전체사업소,          -- Overall branch
  b2c_팀,             -- B2C team
  b2b사업소            -- B2B branch
)
```

---

## 10. Usage Statistics

### By Operation Type:
- **SELECT operations**: 50+ instances (in UNION queries combining sales tables)
- **JOIN operations**: 50+ instances (sales.담당자코드 → employees.사원_담당_코드)
- **GROUP BY operations**: 6 instances (always with employee_name)
- **ORDER BY operations**: 2 instances (debug endpoints only, not production)
- **WHERE conditions**: 50+ instances (as part of JOIN conditions)

### By Table:
- **sales/east_division_sales/west_division_sales**: 50+ queries SELECT 담당자코드
- **clients**: 10+ queries use clients.담당자코드 for employee assignment
- **employees**: 2 queries ORDER BY employees.사원_담당_코드 (debug only)

### By Purpose:
- **JOINs** (to get employee name/branch): 50+ instances ⭐ PRIMARY USE CASE
- **Grouping** (with employee name for uniqueness): 6 instances
- **Sorting** (debug/check only): 2 instances
- **Selection** (in UNION queries): 50+ instances

### Production vs Debug:
- **Production dashboards**: Use employee code ONLY for JOINs, then use employee NAME for everything else
- **Debug endpoints**: Occasionally sort or filter by employee code directly

---

## Conclusion

**Employee Code (`담당자코드`) Usage Summary:**

1. **Primary Use**: JOIN key to connect sales/purchases to employees (50+ instances)
2. **Secondary Use**: Group by identifier (6 instances, always with employee name)
3. **Tertiary Use**: Sort key (2 instances, debug endpoints only)

**The Pattern**:
```
Sales Data (담당자코드)
  → JOIN → Employees Table (사원_담당_코드 = 담당자코드)
  → Get → Employee Name (사원_담당_명)
  → Then Use → Employee Name for GROUP BY, ORDER BY, filtering
```

Employee code is the **bridge** that connects sales transactions to employee records, but once that connection is made, **employee name** becomes the primary field for all subsequent operations (grouping, sorting, filtering).

---

*Document generated on 2026-04-05*
*Complete analysis of employee code usage in sales and purchases queries*
