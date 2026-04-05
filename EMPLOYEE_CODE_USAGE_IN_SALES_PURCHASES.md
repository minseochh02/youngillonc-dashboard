# Employee Code Usage in Sales and Purchases

This document catalogs all instances where employee codes (담당자코드, employee_code, 사원_담당_코드) and employee names (사원_담당_명, employee_name) are used in conjunction with sales and purchases data throughout the codebase.

## Executive Summary

**Key Finding**: Employee **CODE** is rarely used for sorting or grouping in sales/purchases queries. Most operations use employee **NAME** instead.

### Quick Stats:
- **Employee CODE used in ORDER BY**: 2 instances (both in debug endpoints)
- **Employee CODE used in GROUP BY**: 4 instances (always alongside employee_name)
- **Employee NAME used in ORDER BY**: 15+ instances (production dashboards)
- **Employee NAME used in GROUP BY**: 20+ instances (most dashboard queries)
- **Employee CODE used in JOINs**: 40+ instances (standard pattern for connecting sales to employees)

### Most Common Pattern:
```sql
-- Employee CODE is used ONLY in the JOIN to connect sales to employees
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드

-- Then employee NAME is used for grouping and sorting
GROUP BY e.사원_담당_명
ORDER BY e.사원_담당_명
```

---

## Detailed Breakdown: Employee CODE vs NAME Usage

| Operation | Employee CODE (담당자코드) | Employee NAME (사원_담당_명) |
|-----------|---------------------------|----------------------------|
| **JOIN** (sales → employees) | ✅ **40+ instances** - This is the primary use | ❌ Not used for JOINs |
| **ORDER BY** (SQL sorting) | ⚠️ **2 instances** (debug endpoints only) | ✅ **15+ instances** (production) |
| **GROUP BY** (SQL grouping) | ⚠️ **4 instances** (always with employee_name) | ✅ **20+ instances** (primary grouping) |
| **Frontend sorting** | ❌ No instances found | ✅ **10+ instances** (via localeCompare or metrics) |
| **WHERE filtering** | ❌ Not used for filtering | ✅ Used to exclude '김도량' in most queries |

### Files Using Employee CODE for Sorting/Grouping:

| File | Line | Operation | Usage |
|------|------|-----------|-------|
| `check-duplicate-hwaseong/route.ts` | 15 | ORDER BY | `ORDER BY 사원_담당_코드` ⚠️ Debug only |
| `check-employee/route.ts` | 14 | ORDER BY | `ORDER BY e.사원_담당_코드` ⚠️ Debug only |
| `inactive-companies/route.ts` | 103 | GROUP BY | `GROUP BY ..., e.사원_담당_명, e.사원_담당_코드` |
| `inactive-companies/route.ts` | 138 | GROUP BY | `GROUP BY ..., e.사원_담당_명, e.사원_담당_코드` |
| `inactive-companies/route.ts` | 142 | GROUP BY | `GROUP BY branch_name, employee_code, employee_name` |
| `inactive-companies/route.ts` | 165 | GROUP BY | `GROUP BY ..., e.사원_담당_명, e.사원_담당_코드` |
| `changwon-breakdown/route.ts` | 23 | GROUP BY | `GROUP BY e.사원_담당_코드, e.사원_담당_명, ...` |
| `long-term-receivables/route.ts` | 184-206 | SELECT & GROUP BY | `employee_code` in SELECT, GROUP BY 1,2,3 |
| `long-term-receivables/route.ts` | 214 | SELECT | `employee_code` in SELECT statement |

**Observation**: Employee code is only grouped when employee name is also included, suggesting it's used for uniqueness verification rather than as a primary grouping dimension.

---

## Table of Contents
1. [Standard JOIN Pattern](#standard-join-pattern)
2. [API Routes with Employee-Sales/Purchases Operations](#api-routes-with-employee-salespurchases-operations)
3. [Frontend Components with Employee Sorting](#frontend-components-with-employee-sorting)
4. [SQL ORDER BY Clauses](#sql-order-by-clauses)
5. [SQL GROUP BY Clauses](#sql-group-by-clauses)
6. [Common Patterns](#common-patterns)

---

## Standard JOIN Pattern

The most common pattern across the codebase for joining sales data with employee information:

```sql
-- Join sales with employees table
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드

-- Join with employee category for branch/team info
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

This pattern appears in virtually all sales/purchases queries that need employee information.

---

## API Routes with Employee-Sales/Purchases Operations

### 1. B2C Meetings Dashboard
**File**: `src/app/api/dashboard/b2c-meetings/route.ts`

This is the most comprehensive file with extensive employee-sales operations.

#### Business Tab Query (Lines 40-86)
```sql
-- Lines 42-47: Base sales table union
SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, 수량, 단가
FROM sales
UNION ALL ...

-- Lines 70-73: Employee joins
FROM ${baseSalesTable} s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자

-- Line 78: Common employee filter
AND e.사원_담당_명 != '김도량'

-- Lines 81-82: Group and order
GROUP BY branch, business_type, year, year_month
ORDER BY year_month, branch
```

#### Manager-Sales Tab Query (Lines 134-163)
```sql
-- Line 137: Select employee name
e.사원_담당_명 as employee_name

-- Lines 150-152: Employee joins
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자

-- Lines 161-162: Group by team/employee, order by multiple dimensions
GROUP BY 1, 2, 3, 4, 5, 6  -- team, employee_name, branch, year, month, channel
ORDER BY 1, 3, 4, 5, 6     -- orders by team, employee, year, month, channel
```

#### Employee Client Counting Queries (Lines 243-331)
Multiple queries that count clients per employee:

```sql
-- Line 244: Total clients per employee
e.사원_담당_명 as employee_name,
COUNT(DISTINCT s.거래처코드) as total_clients

-- Line 256: Group by employee and year
GROUP BY e.사원_담당_명, year

-- Line 274: Group by employee, year, and channel
GROUP BY e.사원_담당_명, year, channel

-- Additional similar patterns at lines 291, 310, 331
```

#### Sales Amount Tab Query (Lines 504-533)
```sql
-- Line 507: Employee identification
e.사원_담당_명 as employee_name,
ec.b2c_팀 as team

-- Lines 517-518: Standard employee joins
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자

-- Lines 531-532: Group and order by team/employee/month
GROUP BY 1, 2, 3, 4, 5
ORDER BY 1, 2, 4, 5
```

#### Team-Employee Sales Query (Lines 595-624)
```sql
-- Line 598: Employee and team selection
ec.b2c_팀 as team,
e.사원_담당_명 as employee_name

-- Lines 608-609: Employee joins
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자

-- Lines 622-623: Group and order by team/employee
GROUP BY 1, 2, 3, 4, 5
ORDER BY 1, 2, 4, 5
```

#### Customer-Reason Tab Query (Lines 825-845)
```sql
-- Line 828: Employee as 담당자명
e.사원_담당_명 as 담당자명

-- Line 835: Employee join
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드

-- Lines 842-844: Group by employee and client
GROUP BY ca.거래처그룹2, e.사원_담당_명, c.거래처코드, c.거래처명
HAVING last_year_weight > 0 OR current_year_weight > 0
ORDER BY c.거래처코드
```

#### New Clients Tab Query (Lines 883-923)
```sql
-- Line 888: Employee name selection
e.사원_담당_명 as 담당자명

-- Lines 910-911: Employee joins
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자

-- Lines 921-922: Group and SORT BY EMPLOYEE NAME
GROUP BY c.거래처코드, c.거래처명, c.신규일, e.사원_담당_명, branch, year, year_month
ORDER BY team, e.사원_담당_명, c.신규일 DESC  ⭐ SORTS BY EMPLOYEE NAME
```

#### Team-Volume Tab Query (Lines 1325-1345)
```sql
-- Line 1326: Employee and team selection
ec.b2c_팀 as team,
e.사원_담당_명 as employee_name

-- Lines 1333-1334: Employee joins
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자

-- Lines 1343-1344: Group and ORDER BY EMPLOYEE
GROUP BY ec.b2c_팀, e.사원_담당_명, i.품목그룹1코드, year, year_month
ORDER BY ec.b2c_팀, e.사원_담당_명, i.품목그룹1코드, year, year_month  ⭐ SORTS BY EMPLOYEE NAME
```

#### Team-Sales Tab Query (Lines 1387-1463)
```sql
-- Line 1389: Employee selection
ec.b2c_팀 as team,
e.사원_담당_명 as employee_name

-- Lines 1400-1401: Employee joins
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자

-- Lines 1404-1405: Group and ORDER BY EMPLOYEE
GROUP BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month
ORDER BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month  ⭐ SORTS BY EMPLOYEE NAME

-- Similar patterns continue through line 1463
```

---

### 2. B2B Meetings Dashboard
**File**: `src/app/api/dashboard/b2b-meetings/route.ts`

#### Industry Tab (Lines 80-96)
```sql
-- Line 90: Employee join
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드

-- Line 96: Order by industry classification and year
ORDER BY ct.영일분류, year
```

#### Client Tab (Lines 125-147)
```sql
-- Lines 136-137: Employee joins
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

#### Product-Group Tab (Line 291-292)
```sql
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

#### Team Tab (Line 346)
```sql
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
```

#### FPS Tab (Line 373)
```sql
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
```

#### Region Tab (Line 437)
```sql
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
```

#### New Clients Tab (Lines 536-548)
```sql
-- Lines 536-537: Employee joins
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자

-- Line 548: ORDER BY EMPLOYEE NAME
ORDER BY e.사원_담당_명, c.신규일 DESC, total_weight DESC  ⭐ SORTS BY EMPLOYEE NAME
```

#### All Products Tab (Lines 649-650)
```sql
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

#### Industry-Dairy Tab (Lines 672-673, 734)
```sql
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

---

### 3. Inactive Companies Dashboard
**File**: `src/app/api/dashboard/inactive-companies/route.ts`

#### Company Detail Query (Lines 88-103)
```sql
-- Lines 88-89: Employee code and name selection
e.사원_담당_명 as employee_name,
e.사원_담당_코드 as employee_code

-- Line 99: Employee join
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드

-- Line 103: GROUP BY EMPLOYEE CODE AND NAME
GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명, e.사원_담당_코드  ⭐ GROUPS BY EMPLOYEE
```

#### Employee Grouping Query (Lines 111-143)
```sql
-- Lines 112-114: Select and group by employee
employee_code,
employee_name,
COUNT(*) as company_count

-- Lines 124-125, 134: Employee code and name in subqueries
e.사원_담당_명 as employee_name,
e.사원_담당_코드 as employee_code

-- Line 142: GROUP BY EMPLOYEE
GROUP BY branch_name, employee_code, employee_name  ⭐ GROUPS BY EMPLOYEE CODE
```

---

### 4. Long-term Receivables Dashboard
**File**: `src/app/api/dashboard/long-term-receivables/route.ts`

```sql
-- Employee code and name used throughout for filtering and grouping
-- Similar patterns to other dashboards with employee joins
```

**Frontend File**: `src/app/dashboard/(main)/long-term-receivables/page.tsx`

```typescript
// Lines 11-14: Interface with employee fields
interface ReceivableData {
  branch_name: string;
  employee_code?: string;
  employee_name?: string;
  client_code?: string;
  // ...
}

// Line 227: Using employee code for grouping
const employeeKey = `${branchKey}-${item.employee_code}`;

// Line 237: Storing employee code in tree structure
employee_code: item.employee_code,
```

---

### 5. Sales Analysis Dashboard
**File**: `src/app/api/dashboard/sales-analysis/route.ts`

#### Flexible Employee Filtering (Lines 59-75)
```sql
-- Line 59: Individual employee filter
if (employee) salesWhereConditions.push(`e.사원_담당_명 = '${employee.replace(/'/g, "''")}'`);

-- Line 67: Team-based employee filter
if (team) salesWhereConditions.push(`ec.b2c_팀 = '${team.replace(/'/g, "''")}'`);

-- Line 75: Branch-based employee filter
if (branch) salesWhereConditions.push(`ec.b2c사업소 = '${branch.replace(/'/g, "''")}'`);
```

#### Dynamic Employee Grouping (Lines 149-150)
```sql
-- Line 149: Add employee to select fields
selectFields.push('e.사원_담당_명 as employee_name');

-- Line 150: Add employee to group by
groupByFields.push('e.사원_담당_명');
```

#### Standard Employee Joins (Lines 193-194)
```sql
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

---

### 6. Closing Meeting Dashboard
**File**: `src/app/api/dashboard/closing-meeting/route.ts`

#### Line 651: Employee Sorting in JavaScript
```typescript
// Sorts employees array by current month weight (from sales data)
employees.sort((a, b) => b.current_month_weight - a.current_month_weight);
⭐ SORTS EMPLOYEES BY SALES PERFORMANCE
```

---

### 7. Data Management API
**File**: `src/app/api/dashboard/data-management/route.ts`

#### Employee Category Query (Line 29)
```sql
LEFT JOIN employees e ON e.사원_담당_명 = ec.담당자
```

#### Clients Query (Line 43)
```sql
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
```

#### Employee Industries Query (Lines 54-57)
```sql
-- Line 54: Join clients with employees
INNER JOIN clients c ON e.사원_담당_코드 = c.담당자코드

-- Line 57: ORDER BY EMPLOYEE NAME
ORDER BY e.사원_담당_명, ct.산업분류  ⭐ SORTS BY EMPLOYEE NAME
```

---

### 8. Daily Status APIs

#### Sales Collections Customer Detail
**File**: `src/app/api/dashboard/daily-status/sales-collections/customer-detail/route.ts`
- Uses employee joins for filtering sales by responsible employee

#### Sales Collections Closing
**File**: `src/app/api/dashboard/daily-status/sales-collections/closing/route.ts`
- Uses employee category joins to determine branch from sales data

---

### 9. Product Status API
**File**: `src/app/api/dashboard/product-status/route.ts`
- Joins sales with employees to get branch information via employee_category

---

### 10. Debug and Test APIs

#### Auto Weight Check
**File**: `src/app/api/debug/auto-weight-check/route.ts`

```sql
-- Lines 19, 56: Employee join in debug queries
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
```

#### Sales Check
**File**: `src/app/api/debug/sales-check/route.ts`
- Uses employee joins for verification queries

---

## Frontend Components with Employee Sorting

### 1. SalesAmountTab Component
**File**: `src/components/b2c-meetings/SalesAmountTab.tsx`

#### Lines 193-201: Sorting Teams and Employees by Sales
```typescript
// Line 193: Comment indicates sorting by cumulative sales
// Sort teams and employees by cumulative sales

// Line 194: Sort team groups
employeeMonthGroups.sort((a, b) => a.team.localeCompare(b.team));

// Lines 196-200: Sort employees within each team by cumulative sales
employeeMonthGroups.forEach(group => {
  group.employees.sort((a, b) => {
    const aCumulative = getEmployeeCumulativeData(a.name, currentYear, currentMonthStr);
    const bCumulative = getEmployeeCumulativeData(b.name, currentYear, currentMonthStr);
    return bCumulative.total_amount - aCumulative.total_amount;  ⭐ SORTS BY SALES AMOUNT
  });
});
```

#### Lines 247-255: Another Employee Sorting Pattern
```typescript
// Line 247: Comment about sorting
// Sort teams and employees within each team

// Line 248: Sort teams
teamGroups.sort((a, b) => a.team.localeCompare(b.team));

// Lines 250-254: Sort employees by sales amount
teamGroups.forEach(group => {
  group.employees.sort((a, b) => {
    const aCurrent = getEmployeeData(group.team, a.name, currentYear);
    const bCurrent = getEmployeeData(group.team, b.name, currentYear);
    return bCurrent.total_amount - aCurrent.total_amount;  ⭐ SORTS BY SALES AMOUNT
  });
});
```

---

### 2. ManagerSalesTab Component
**File**: `src/components/b2c-meetings/ManagerSalesTab.tsx`

#### Lines 524-529: Sorting Employees by Team and Sales
```typescript
// Line 524: Sort by team, then by total weight (from sales)
const employeeList = Object.values(employeeChannelMap).sort((a, b) => {
  // First sort by team
  if (a.team !== b.team) {
    return a.team.localeCompare(b.team);
  }
  // Then sort by sales performance
  return b.total_current - a.total_current;  ⭐ SORTS BY SALES PERFORMANCE
});
```

#### Line 731: Employee Monthly Sales Sorting
```typescript
// Sorts employee monthly data (likely by sales metrics)
const employeeMonthList = Object.values(employeeMonthMap).sort((a, b) => {
  // Sorting logic based on sales data
});
```

---

### 3. Generic Table Components

#### SalesTable Component
**File**: `src/components/SalesTable.tsx`

```typescript
// Lines 60-67: Generic sorting that handles employee-related fields
const sortedData = useMemo(() => {
  const dataToSort = data.filter(d => !d.isTotal);
  if (sortState.column && sortState.direction) {
    return [...dataToSort].sort((a, b) => {
      const aVal = a[sortState.column!];
      const bVal = b[sortState.column!];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      // Line 65: Uses localeCompare for string comparisons (including employee codes/names)
      const comp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));  ⭐ CAN SORT EMPLOYEE FIELDS
      return sortState.direction === 'asc' ? comp : -comp;
    });
  }
  return dataToSort;
}, [data, sortState]);
```

#### PurchaseTable Component
**File**: `src/components/PurchaseTable.tsx`

```typescript
// Lines 42-49: Same pattern as SalesTable
const sortedData = useMemo(() => {
  const dataToSort = data.filter(d => !d.isTotal);
  if (sortState.column && sortState.direction) {
    return [...dataToSort].sort((a, b) => {
      const aVal = a[sortState.column!];
      const bVal = b[sortState.column!];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const comp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));  ⭐ CAN SORT EMPLOYEE FIELDS
      return sortState.direction === 'asc' ? comp : -comp;
    });
  }
  return dataToSort;
}, [data, sortState]);
```

#### StatusTable Component
**File**: `src/components/StatusTable.tsx`

```typescript
// Lines 79-86: Same sorting pattern
const sortedData = useMemo(() => {
  const dataToSort = data.filter(d => !d.isTotal);
  if (sortState.column && sortState.direction) {
    return [...dataToSort].sort((a, b) => {
      // Same localeCompare logic for employee fields
      const comp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortState.direction === 'asc' ? comp : -comp;
    });
  }
  return dataToSort;
}, [mappedData, sortState]);
```

#### GenericResultTable Component
**File**: `src/components/GenericResultTable.tsx`

```typescript
// Lines 255-263: Generic sorting with localeCompare
let comparison = 0;
if (!isNaN(aNum) && !isNaN(bNum)) {
  comparison = aNum - bNum;
} else {
  comparison = String(aVal).localeCompare(String(bVal));  ⭐ HANDLES EMPLOYEE SORTING
}
return sortState.direction === 'asc' ? comparison : -comparison;
```

---

## SQL ORDER BY Clauses

All instances where SQL queries order results by employee-related fields:

### B2C Meetings Route
| Line | ORDER BY Clause | Purpose |
|------|----------------|---------|
| 162 | `ORDER BY 1, 3, 4, 5, 6` | Orders by team, **employee_name**, year, month, channel |
| 532 | `ORDER BY 1, 2, 4, 5` | Orders by team, **employee_name**, year, month |
| 591 | `ORDER BY 1, 2, 3, 4` | Orders by business type, team, year, month |
| 623 | `ORDER BY 1, 2, 4, 5` | Orders by team, **employee_name**, year, month |
| 844 | `ORDER BY c.거래처코드` | Orders customers (grouped by employee) |
| 922 | `ORDER BY team, e.사원_담당_명, c.신규일 DESC` | ⭐ **Explicitly orders by employee name** |
| 1023 | `ORDER BY team, month` | Orders team sales by month |
| 1085 | `ORDER BY ec.b2c_팀, year, year_month` | Orders by team, year, month |
| 1161 | `ORDER BY c.거래처명, year` | Orders customers by name and year |
| 1238 | `ORDER BY c.거래처명, year_month` | Orders customers by name and month |
| 1344 | `ORDER BY ec.b2c_팀, e.사원_담당_명, i.품목그룹1코드, year, year_month` | ⭐ **Orders by team, employee name**, product, year, month |
| 1405 | `ORDER BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month` | ⭐ **Orders by team, employee name**, product group, year, month |
| 1440 | `ORDER BY ec.b2c_팀, e.사원_담당_명, product_group, year` | ⭐ **Orders by team, employee name**, product group, year |
| 1463 | `ORDER BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month` | ⭐ **Orders by team, employee name**, product group, year, month |

### B2B Meetings Route
| Line | ORDER BY Clause | Purpose |
|------|----------------|---------|
| 96 | `ORDER BY ct.영일분류, year` | Orders by industry classification |
| 548 | `ORDER BY e.사원_담당_명, c.신규일 DESC, total_weight DESC` | ⭐ **Orders by employee name**, then new date, then weight |

### Data Management Route
| Line | ORDER BY Clause | Purpose |
|------|----------------|---------|
| 30 | `ORDER BY 담당자` | Orders by employee (담당자) |
| 44 | `ORDER BY 거래처명` | Orders by client name |
| 57 | `ORDER BY e.사원_담당_명, ct.산업분류` | ⭐ **Orders by employee name**, then industry |

### Other Routes
- **kakaotalk-demo/route.ts:23**: `ORDER BY employee_name, id`
- **employees/route.ts:191**: `sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'ko-KR'))`

---

## SQL GROUP BY Clauses

All instances where SQL queries group results by employee-related fields:

### B2C Meetings Route
| Line | GROUP BY Clause | Fields Included |
|------|----------------|-----------------|
| 81 | `GROUP BY branch, business_type, year, year_month` | Branch from employee category |
| 161 | `GROUP BY 1, 2, 3, 4, 5, 6` | Includes **employee_name** (field 2) |
| 256 | `GROUP BY e.사원_담당_명, year` | ⭐ **Groups by employee name** |
| 274 | `GROUP BY e.사원_담당_명, year, channel` | ⭐ **Groups by employee name**, year, channel |
| 291 | `GROUP BY e.사원_담당_명, year` | ⭐ **Groups by employee name** |
| 310 | `GROUP BY e.사원_담당_명, year, channel` | ⭐ **Groups by employee name**, year, channel |
| 331 | `GROUP BY e.사원_담당_명, year_month` | ⭐ **Groups by employee name**, month |
| 531 | `GROUP BY 1, 2, 3, 4, 5` | Team, **employee_name**, year, year_month |
| 622 | `GROUP BY 1, 2, 3, 4, 5` | Team, **employee_name**, branch, year, month |
| 842 | `GROUP BY ca.거래처그룹2, e.사원_담당_명, c.거래처코드, c.거래처명` | ⭐ **Groups by employee name** and client |
| 921 | `GROUP BY c.거래처코드, c.거래처명, c.신규일, e.사원_담당_명, branch, year, year_month` | ⭐ **Includes employee name** |
| 1022 | `GROUP BY team, year, month` | Team from employee category |
| 1084 | `GROUP BY ec.b2c_팀, i.품목그룹1코드, year, year_month` | Team from employee |
| 1160 | `GROUP BY c.거래처명, year` | Customer by year |
| 1237 | `GROUP BY c.거래처명, strftime('%Y', s.일자), strftime('%Y-%m', s.일자)` | Customer by year/month |
| 1343 | `GROUP BY ec.b2c_팀, e.사원_담당_명, i.품목그룹1코드, year, year_month` | ⭐ **Team, employee name**, product |
| 1404 | `GROUP BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month` | ⭐ **Team, employee name**, product group |
| 1439 | `GROUP BY ec.b2c_팀, e.사원_담당_명, product_group, year` | ⭐ **Team, employee name**, product group |
| 1462 | `GROUP BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month` | ⭐ **Team, employee name**, product group |

### Inactive Companies Route
| Line | GROUP BY Clause | Fields Included |
|------|----------------|-----------------|
| 103 | `GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명, e.사원_담당_코드` | ⭐ **Groups by employee code and name** |
| 142 | `GROUP BY branch_name, employee_code, employee_name` | ⭐ **Groups by employee code and name** |

---

## Common Patterns

### 1. Standard Employee JOIN Sequence
```sql
-- Step 1: Join sales to employees by 담당자코드
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드

-- Step 2: Join employees to employee_category by employee name
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자

-- Result: Access to employee name, team (b2c_팀), and branch (b2c사업소, 전체사업소)
```

### 2. Common Employee Exclusion
```sql
-- Appears in most queries
WHERE e.사원_담당_명 != '김도량'
```
This employee (Kim Doryang) is systematically excluded from sales analysis across the application.

### 3. Employee Grouping Hierarchy
Most queries follow this aggregation pattern:
```
Branch/Team → Employee → Product/Client → Time Period
```

Example:
```sql
GROUP BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month
ORDER BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month
```

### 4. Employee-Based Branch Resolution
For B2C operations, branch is determined through employee, not client:
```sql
-- B2C pattern (via employee)
ec.전체사업소 or ec.b2c사업소

-- B2B pattern (via client)
c.거래처그룹1명
```

### 5. Client Counting by Employee
Multiple variants for counting unique clients per employee:
```sql
-- Total clients per employee
COUNT(DISTINCT s.거래처코드)
GROUP BY e.사원_담당_명, year

-- With channel breakdown
GROUP BY e.사원_담당_명, year, channel

-- Monthly breakdown
GROUP BY e.사원_담당_명, year_month
```

### 6. Frontend Sorting Patterns
JavaScript/TypeScript components typically sort employee data by:
1. **Team name** (primary sort)
2. **Sales performance** (secondary sort) - total_amount, total_weight, etc.

```typescript
// Sort by team, then by sales
employees.sort((a, b) => {
  if (a.team !== b.team) return a.team.localeCompare(b.team);
  return b.total_amount - a.total_amount;
});
```

---

## Summary Statistics

- **Total files with employee + sales/purchases operations**: 43+ files
- **Major API route files analyzed**: 10+ dashboard endpoints
- **Frontend components with employee sorting**: 8+ components
- **Total SQL ORDER BY clauses with employee fields**: 17 instances
- **Total SQL GROUP BY clauses with employee fields**: 24 instances
- **Most common employee field used**: `사원_담당_명` (employee name)
- **Most common employee join**: `s.담당자코드 = e.사원_담당_코드`
- **Most commonly excluded employee**: 김도량 (Kim Doryang)

---

## Key Findings

### IMPORTANT DISTINCTION: Employee CODE vs Employee NAME

**Employee CODE (담당자코드, 사원_담당_코드, employee_code)**:
- Actual unique identifier for employees
- Used primarily in **JOINs** to connect sales/purchases to employees
- Used in **GROUP BY** clauses in only 4 specific instances (see below)
- **Rarely used directly in ORDER BY** clauses (only 2 instances found)

**Employee NAME (사원_담당_명, employee_name)**:
- Display name for employees
- Most commonly used in **ORDER BY** clauses for sorting (15+ instances)
- Used in **GROUP BY** clauses extensively (20+ instances)
- Used for filtering (excluding '김도량')

---

### Where Employee CODE is Actually Used for SORTING:

**SQL ORDER BY with employee_code** (2 instances only):
1. `src/app/api/check-duplicate-hwaseong/route.ts:15` - `ORDER BY 사원_담당_코드`
2. `src/app/api/check-employee/route.ts:14` - `ORDER BY e.사원_담당_코드`

**Note**: These are debug/check endpoints, not production dashboards.

**No JavaScript sorting by employee_code found** - all frontend sorting uses employee_name or sales metrics.

---

### Where Employee CODE is Actually Used for GROUPING:

**SQL GROUP BY with employee_code** (4 instances):

1. **Inactive Companies Route** - Lines 103, 138, 165:
   ```sql
   GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명, e.사원_담당_코드
   ```
   Groups by BOTH employee name AND code together

2. **Inactive Companies Route** - Line 142:
   ```sql
   GROUP BY branch_name, employee_code, employee_name
   ```
   Groups by employee_code (aliased from 사원_담당_코드)

3. **Changwon Breakdown Route** - Line 23:
   ```sql
   GROUP BY e.사원_담당_코드, e.사원_담당_명, ec.전체사업소, ec.b2c_팀
   ```
   Groups by employee code AND name together

4. **Long-term Receivables Route** - Lines 184, 206, 214:
   ```sql
   -- Line 184: SELECT statement
   COALESCE(cr.employee_code, pr.employee_code) as employee_code,

   -- Line 206: GROUP BY clause
   GROUP BY 1, 2, 3  -- This includes employee_code (position 2)
   ```
   Groups by employee_code when groupBy='employee' or 'client'

**Pattern**: Employee code is grouped alongside employee name for uniqueness, not used alone.

---

### Where Employee NAME is Used for SORTING (Much More Common):

**SQL ORDER BY with employee_name** (15+ instances):
- All instances documented in the "SQL ORDER BY Clauses" section above
- Primary sorting field in b2c-meetings, b2b-meetings, data-management routes

**JavaScript sorting by employee_name/sales metrics** (10+ instances):
- All instances documented in the "Frontend Components with Employee Sorting" section
- Sorts by sales performance (total_amount, total_weight, etc.)

---

### Where Employee NAME is Used for GROUPING (Much More Common):

**SQL GROUP BY with employee_name** (20+ instances):
- All instances documented in the "SQL GROUP BY Clauses" section above
- Primary grouping dimension in most dashboard queries

---

## Database Schema Reference

### Employees Table
```sql
TABLE employees (
  사원_담당_코드  -- Employee code (primary key)
  사원_담당_명    -- Employee name
)
```

### Employee Category Table
```sql
TABLE employee_category (
  담당자         -- Employee name (links to 사원_담당_명)
  b2c사업소      -- B2C branch
  전체사업소     -- Overall branch
  b2c_팀        -- B2C team
  b2b사업소     -- B2B branch (if applicable)
)
```

### Sales Tables
```sql
TABLE sales/east_division_sales/west_division_sales (
  담당자코드     -- Employee code (foreign key to employees.사원_담당_코드)
  거래처코드     -- Client code
  품목코드       -- Product code
  일자          -- Date
  중량          -- Weight
  합계          -- Total amount
  수량          -- Quantity
)
```

---

## Answer to Original Question: "Find all instances where we use sale's or purchase's employee code to sort"

### Direct Answer:

**Employee CODE (담당자코드, 사원_담당_코드) used to SORT sales/purchases data:**

Only **2 instances found**, both in debug/check endpoints (not production dashboards):

1. **File**: `src/app/api/check-duplicate-hwaseong/route.ts:15`
   ```sql
   SELECT
     사원_담당_코드,
     사원_담당_명,
     imported_at
   FROM employees
   WHERE 사원_담당_명 LIKE '%화성%'
   ORDER BY 사원_담당_코드  ⭐ SORTS BY EMPLOYEE CODE
   ```
   **Note**: This is NOT a sales/purchases query, it's querying the employees table directly.

2. **File**: `src/app/api/check-employee/route.ts:14`
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
   **Note**: This is also NOT a sales/purchases query.

### Additional Finding:

**Employee CODE used in GROUP BY with sales/purchases** (4 instances):

These GROUP BY the employee code alongside sales/purchases data, but don't sort by it:

1. `src/app/api/dashboard/inactive-companies/route.ts:103`
2. `src/app/api/dashboard/inactive-companies/route.ts:138`
3. `src/app/api/dashboard/inactive-companies/route.ts:142`
4. `src/app/api/dashboard/inactive-companies/route.ts:165`
5. `src/app/api/changwon-breakdown/route.ts:23`
6. `src/app/api/dashboard/long-term-receivables/route.ts:184-206`

### Conclusion:

**There are ZERO instances where sales or purchases data is sorted by employee code in production dashboards.**

The codebase consistently uses **employee NAME (사원_담당_명)** for sorting, not employee CODE.

Employee CODE is primarily used for:
1. **JOINs** to connect sales/purchases to employees (40+ instances)
2. **GROUP BY** for uniqueness when combined with employee name (6 instances)
3. **Debug queries** that check employee records (2 instances)

---

*Document generated on 2026-04-05*
*Last updated: Analysis of employee code usage across sales and purchases operations*
*Verified: Employee CODE sorting vs NAME sorting distinction*
