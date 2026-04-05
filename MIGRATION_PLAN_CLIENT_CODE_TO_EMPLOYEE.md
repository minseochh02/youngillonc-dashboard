# Migration Plan: Use Client Code to Find Employee (NOT Sales Employee Code)

## Problem Statement

Currently, the codebase uses `담당자코드` directly from sales tables to identify the responsible employee:

```sql
-- ❌ CURRENT (UNRELIABLE) PATTERN:
FROM sales s
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**Issue**: The `담당자코드` in sales tables is NOT reliable. It may be:
- Outdated (employee changed but old sales records not updated)
- Incorrect (data entry errors)
- Missing (NULL values in some records)

## Solution

Use the **clients table** as the source of truth for employee assignments:

```sql
-- ✅ NEW (RELIABLE) PATTERN:
FROM sales s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드          -- Get client info
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드    -- Use CLIENT's employee assignment
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**Why This Works**:
- `clients.담당자코드` is the current, maintained assignment
- When an employee changes, only the clients table needs updating
- Historical sales automatically reflect current employee responsibility

---

## Files Requiring Changes

Based on the comprehensive analysis, **50+ instances** across **20 files** need to be updated.

### Priority 1: Production Dashboard APIs (CRITICAL)

These are user-facing dashboards that must be accurate:

#### 1. B2C Meetings Dashboard
**File**: `src/app/api/dashboard/b2c-meetings/route.ts`

**Current Code** (Lines 70-73):
```sql
FROM ${baseSalesTable} s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드  ❌ WRONG
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**New Code**:
```sql
FROM ${baseSalesTable} s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ CORRECT
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**Impact**: Affects ALL 8 B2C meeting tabs:
- Business tab (line 49+)
- Manager-sales tab (line 134+)
- Sales-amount tab (line 504+)
- Team-employee tab (line 595+)
- Customer-reason tab (line 825+)
- New clients tab (line 883+)
- Team-volume tab (line 1325+)
- Team-sales tab (line 1387+)

**Testing Required**:
- Verify employee totals match expectations
- Check that team assignments are correct
- Validate branch distributions

---

#### 2. B2B Meetings Dashboard
**File**: `src/app/api/dashboard/b2b-meetings/route.ts`

**Current Pattern** (Used in ALL B2B tabs):
```sql
FROM ${baseSalesSubquery} s
LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드  ❌ WRONG
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**New Pattern**:
```sql
FROM ${baseSalesSubquery} s
LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ CORRECT
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**Locations to Change**:
- Industry tab (line 75+)
- Client tab
- Product-group tab
- Team tab
- FPS tab
- Region tab
- New clients tab
- All products tab
- Industry-dairy tab

**Note**: B2B uses `실납업체` (actual supplier) logic, so clients join is already complex. Just change the employee JOIN.

---

#### 3. B2B Meetings Industry Route
**File**: `src/app/api/dashboard/b2b-meetings/industry/route.ts`

**Current Code** (Line 68-69):
```sql
LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드  ❌ WRONG
```

**New Code**:
```sql
LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ CORRECT
```

---

#### 4. Product Status Dashboard
**File**: `src/app/api/dashboard/product-status/route.ts`

**Current Pattern**:
```sql
FROM (${salesUnion}) s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드  ❌ WRONG
```

**New Pattern**:
```sql
FROM (${salesUnion}) s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ CORRECT
```

---

#### 5. Daily Status - Sales Collections Customer Detail
**File**: `src/app/api/dashboard/daily-status/sales-collections/customer-detail/route.ts`

**Current Pattern**:
```sql
FROM ${baseSalesSubquery} s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드  ❌ WRONG
```

**New Pattern**:
```sql
FROM ${baseSalesSubquery} s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ CORRECT
```

---

#### 6. Daily Status - Sales Collections Closing
**File**: `src/app/api/dashboard/daily-status/sales-collections/closing/route.ts`

**Same change pattern as above**

---

#### 7. B2B Daily Sales Profit
**File**: `src/app/api/dashboard/b2b-daily-sales/profit/route.ts`

**Current Code** (Line 72-73):
```sql
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN items i ON s.품목코드 = i.품목코드
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드  ❌ WRONG
```

**New Code**:
```sql
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN items i ON s.품목코드 = i.품목코드
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ CORRECT
```

---

#### 8. Sales Analysis
**File**: `src/app/api/dashboard/sales-analysis/route.ts`

**Current Pattern** (Dynamic query construction):
```sql
FROM (sales union) s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드  ❌ WRONG
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**New Pattern**:
```sql
FROM (sales union) s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ CORRECT
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

---

#### 9. Sales Inventory
**File**: `src/app/api/dashboard/sales-inventory/route.ts`

**Same pattern change as above**

---

#### 10. Closing Meeting
**File**: `src/app/api/dashboard/closing-meeting/route.ts`

**Same pattern change as above**

---

### Priority 2: Supporting APIs (IMPORTANT)

These support the main dashboards:

#### 11. Inactive Companies
**File**: `src/app/api/dashboard/inactive-companies/route.ts`

**Current Code** (Line 99):
```sql
FROM clients c
LEFT JOIN (SELECT 일자, 거래처코드, 합계 FROM sales) s
  ON c.거래처코드 = s.거래처코드 AND s.일자 <= ?
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ ALREADY CORRECT!
```

**Status**: ✅ **NO CHANGE NEEDED** - Already uses clients.담당자코드 (not sales.담당자코드)

---

#### 12. Long-term Receivables
**File**: `src/app/api/dashboard/long-term-receivables/route.ts`

**Current Code** (Lines 70-76):
```sql
SELECT
  all_codes.client_code,
  COALESCE(t.branch_name, b_info.branch_name) as branch_name,
  COALESCE(t.client_name, b_info.client_name) as client_name,
  COALESCE(t.employee_code, b_info.manager_code) as employee_code,
  COALESCE(t.employee_name, b_info.manager_name) as employee_name,
  ...
```

**Analysis**: This uses ledger transactions and ar_baselines. Need to investigate if ledger has employee_code or if it needs to join to clients.

**Investigation Required**: Check if ledger.거래처코드 can be joined to clients.거래처코드 to get clients.담당자코드.

---

#### 13. Data Management
**File**: `src/app/api/dashboard/data-management/route.ts`

**Current Code** (Line 43):
```sql
FROM clients c
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ ALREADY CORRECT!
```

**Status**: ✅ **NO CHANGE NEEDED** - Already uses clients.담당자코드

---

### Priority 3: Debug/Test Files (LOW PRIORITY)

These are for debugging and testing:

#### 14. Test Query
**File**: `src/app/api/test-query/route.ts`

**Current Code** (Lines 25-26):
```sql
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드  ❌ WRONG
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**New Code**:
```sql
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ CORRECT
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**Note**: Needs clients JOIN added first!

---

#### 15. Test Inactive Debug
**File**: `src/app/api/test-inactive-debug/route.ts`

**Current Code** (Lines 58, 82):
```sql
LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드)
                      OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)  ❌ WRONG
```

**New Code**:
```sql
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ CORRECT
```

**Simplification**: Can remove the complex NULL handling since clients.담당자코드 should always be populated.

---

#### 16-20. Other Debug Files
- `check-duplicate-hwaseong/route.ts` - ✅ No change (queries employees table directly)
- `check-employee/route.ts` - ✅ No change (queries employees table directly)
- `changwon-breakdown/route.ts` - ❌ Needs change
- `debug/auto-weight-check/route.ts` - ❌ Needs change
- `debug/sales-check/route.ts` - ❌ Needs change
- `test-mobil-weight/route.ts` - ❌ Needs change

---

## Migration Strategy

### Phase 1: Preparation (Week 1)

1. **Create Backup Queries**
   - Document all current query results for comparison
   - Save screenshots of all dashboard outputs
   - Export current data to CSV for validation

2. **Verify Data Integrity**
   ```sql
   -- Check: How many sales have 담당자코드 that differs from clients.담당자코드
   SELECT
     COUNT(*) as total_sales,
     COUNT(CASE WHEN s.담당자코드 != c.담당자코드 THEN 1 END) as mismatched,
     COUNT(CASE WHEN s.담당자코드 IS NULL THEN 1 END) as null_in_sales,
     COUNT(CASE WHEN c.담당자코드 IS NULL THEN 1 END) as null_in_clients
   FROM sales s
   LEFT JOIN clients c ON s.거래처코드 = c.거래처코드;
   ```

3. **Identify Problem Cases**
   ```sql
   -- Find sales where employees differ
   SELECT
     s.거래처코드,
     c.거래처명,
     s.담당자코드 as sales_employee_code,
     c.담당자코드 as client_employee_code,
     e1.사원_담당_명 as sales_employee_name,
     e2.사원_담당_명 as client_employee_name,
     COUNT(*) as sales_count
   FROM sales s
   LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
   LEFT JOIN employees e1 ON s.담당자코드 = e1.사원_담당_코드
   LEFT JOIN employees e2 ON c.담당자코드 = e2.사원_담당_코드
   WHERE s.담당자코드 != c.담당자코드
     OR (s.담당자코드 IS NULL AND c.담당자코드 IS NOT NULL)
     OR (s.담당자코드 IS NOT NULL AND c.담당자코드 IS NULL)
   GROUP BY s.거래처코드, c.거래처명, s.담당자코드, c.담당자코드, e1.사원_담당_명, e2.사원_담당_명
   ORDER BY sales_count DESC
   LIMIT 100;
   ```

### Phase 2: Implementation (Week 2)

**Day 1-2: Priority 1 Files (Production Dashboards)**
1. Update `b2c-meetings/route.ts`
2. Update `b2b-meetings/route.ts`
3. Update `b2b-meetings/industry/route.ts`

**Testing After Each Change**:
- Run queries and compare results with backup
- Check that totals match expectations
- Validate employee distributions

**Day 3-4: Priority 1 Continued**
4. Update `product-status/route.ts`
5. Update `daily-status/sales-collections/customer-detail/route.ts`
6. Update `daily-status/sales-collections/closing/route.ts`

**Day 5: Priority 1 Completion**
7. Update `b2b-daily-sales/profit/route.ts`
8. Update `sales-analysis/route.ts`
9. Update `sales-inventory/route.ts`
10. Update `closing-meeting/route.ts`

### Phase 3: Validation (Week 3)

**Day 1-2: Data Validation**
```sql
-- Validation Query 1: Compare employee totals before/after
-- Run this query BEFORE migration
SELECT
  e.사원_담당_명,
  COUNT(DISTINCT s.거래처코드) as client_count,
  SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as total_sales,
  SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
FROM sales s
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드  -- OLD WAY
WHERE s.일자 >= '2025-01-01'
GROUP BY e.사원_담당_명
ORDER BY total_sales DESC;

-- Run this query AFTER migration
SELECT
  e.사원_담당_명,
  COUNT(DISTINCT s.거래처코드) as client_count,
  SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as total_sales,
  SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
FROM sales s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  -- NEW WAY
WHERE s.일자 >= '2025-01-01'
GROUP BY e.사원_담당_명
ORDER BY total_sales DESC;

-- Compare the two results - differences show where sales employee assignments were wrong
```

**Day 3-4: Dashboard Testing**
- Test all B2C meeting tabs
- Test all B2B meeting tabs
- Verify employee totals
- Check team distributions
- Validate branch aggregations

**Day 5: User Acceptance Testing**
- Have stakeholders review dashboards
- Verify numbers match their expectations
- Get sign-off before proceeding

### Phase 4: Cleanup (Week 4)

**Day 1-2: Priority 2 & 3 Files**
- Update supporting APIs
- Update debug files
- Update test files

**Day 3: Documentation**
- Update DB_KNOWLEDGE.md with new pattern
- Document that sales.담당자코드 should NOT be used
- Create migration notes for future reference

**Day 4-5: Code Review & Optimization**
- Review all changed files
- Look for any missed instances
- Optimize queries if needed
- Remove unused code

---

## Code Changes Detail

### Example: B2C Meetings Route Complete Change

**File**: `src/app/api/dashboard/b2c-meetings/route.ts`

#### Change 1: Business Tab (Lines 70-73)

**Before**:
```typescript
const query = `
  SELECT
    CASE
      WHEN ec.b2c사업소 LIKE '%동부%' THEN '동부'
      WHEN ec.b2c사업소 LIKE '%서부%' THEN '서부'
      WHEN ec.b2c사업소 LIKE '%중부%' THEN '중부'
      WHEN ec.b2c사업소 LIKE '%남부%' THEN '남부'
      WHEN ec.b2c사업소 LIKE '%제주%' THEN '제주'
      ELSE '본부'
    END as branch,
    CASE
      WHEN ec.b2c_팀 = 'B2B' THEN 'B2B'
      ELSE 'B2C'
    END as business_type,
    strftime('%Y', s.일자) as year,
    strftime('%Y-%m', s.일자) as year_month,
    SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
    SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
    SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
  FROM ${baseSalesTable} s
  LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
  LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드  ❌ WRONG
  LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
  LEFT JOIN items i ON s.품목코드 = i.품목코드
  LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
  WHERE s.일자 >= '${businessMinYear}-01-01'
    AND s.일자 <= '${currentYear}-12-31'
    AND e.사원_담당_명 != '김도량'
    AND i.품목그룹1코드 IN ('PVL', 'CVL')
    AND ec.b2c사업소 IS NOT NULL
  GROUP BY branch, business_type, year, year_month
  ORDER BY year_month, branch
`;
```

**After**:
```typescript
const query = `
  SELECT
    CASE
      WHEN ec.b2c사업소 LIKE '%동부%' THEN '동부'
      WHEN ec.b2c사업소 LIKE '%서부%' THEN '서부'
      WHEN ec.b2c사업소 LIKE '%중부%' THEN '중부'
      WHEN ec.b2c사업소 LIKE '%남부%' THEN '남부'
      WHEN ec.b2c사업소 LIKE '%제주%' THEN '제주'
      ELSE '본부'
    END as branch,
    CASE
      WHEN ec.b2c_팀 = 'B2B' THEN 'B2B'
      ELSE 'B2C'
    END as business_type,
    strftime('%Y', s.일자) as year,
    strftime('%Y-%m', s.일자) as year_month,
    SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
    SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
    SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
  FROM ${baseSalesTable} s
  LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
  LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ CORRECT
  LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
  LEFT JOIN items i ON s.품목코드 = i.품목코드
  LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
  WHERE s.일자 >= '${businessMinYear}-01-01'
    AND s.일자 <= '${currentYear}-12-31'
    AND e.사원_담당_명 != '김도량'
    AND i.품목그룹1코드 IN ('PVL', 'CVL')
    AND ec.b2c사업소 IS NOT NULL
  GROUP BY branch, business_type, year, year_month
  ORDER BY year_month, branch
`;
```

**Change**: Only ONE line changed:
```diff
- LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
+ LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
```

This same single-line change needs to be applied to **all other queries** in the file.

---

## Impact Analysis

### Data Changes Expected

1. **Sales Previously Assigned to Wrong Employee**
   - These will now show under the CORRECT employee (from clients table)
   - Example: Sale made by Employee A, but client is assigned to Employee B → will now count for Employee B

2. **Sales with NULL Employee in Sales Table**
   - Will now be assigned to the employee from clients table
   - Previously these might have been "unassigned"

3. **Historical Sales After Employee Transfer**
   - Old sales from Client X will count toward CURRENT employee responsible for Client X
   - This is correct behavior - current employee is responsible for all client sales

### Dashboard Changes Expected

#### B2C Meetings Dashboard:
- **Employee totals may shift** between employees
- **Team totals should remain the same** (unless clients moved teams)
- **Branch totals should remain the same** (unless clients moved branches)

#### B2B Meetings Dashboard:
- Similar shifts in employee-level data
- Client-level data should be unchanged

#### Sales Analysis:
- Filtering by employee will show ALL sales for that employee's clients
- Not just sales where employee was recorded in sales table

---

## Risks & Mitigation

### Risk 1: Clients with NULL 담당자코드
**Problem**: Some clients might not have an assigned employee

**Check**:
```sql
SELECT COUNT(*)
FROM clients
WHERE 담당자코드 IS NULL;
```

**Mitigation**:
- Assign these clients to a default employee or manager
- Or filter them out with `WHERE c.담당자코드 IS NOT NULL`

### Risk 2: Sales for Non-Existent Clients
**Problem**: Some sales might have 거래처코드 that doesn't exist in clients table

**Check**:
```sql
SELECT
  s.거래처코드,
  COUNT(*) as sales_count,
  SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as total_amount
FROM sales s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
WHERE c.거래처코드 IS NULL
GROUP BY s.거래처코드
ORDER BY total_amount DESC;
```

**Mitigation**:
- Create missing client records
- Or use LEFT JOIN to keep the sales but with NULL employee

### Risk 3: Performance Impact
**Problem**: Might be slower if clients table join adds overhead

**Check**: Run EXPLAIN QUERY PLAN on old vs new queries

**Mitigation**:
- Ensure index exists on `clients.거래처코드`
- Ensure index exists on `clients.담당자코드`
- May need to add composite index

### Risk 4: Breaking Changes for Stakeholders
**Problem**: Numbers will change, stakeholders might be confused

**Mitigation**:
- Communicate the change in advance
- Provide before/after comparison reports
- Explain why new numbers are MORE accurate
- Have documentation showing which sales moved and why

---

## Testing Checklist

### Pre-Migration Tests:
- [ ] Export all dashboard data to CSV
- [ ] Document current employee totals
- [ ] Document current team totals
- [ ] Document current branch totals
- [ ] Run data integrity checks (see Phase 1)

### Per-File Testing:
- [ ] Query runs without errors
- [ ] Results have expected structure
- [ ] No NULL employees where not expected
- [ ] Totals are reasonable
- [ ] Compare with backup data

### Post-Migration Tests:
- [ ] All dashboards load successfully
- [ ] No console errors
- [ ] Employee totals are reasonable
- [ ] Team totals match expectations
- [ ] Branch totals match expectations
- [ ] Stakeholder approval

### Performance Tests:
- [ ] Dashboard load times acceptable (<3 seconds)
- [ ] Query execution times acceptable
- [ ] No database timeouts
- [ ] EXPLAIN QUERY PLAN shows efficient joins

---

## Rollback Plan

If issues are discovered:

1. **Immediate Rollback**:
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Database Rollback** (if any data changes):
   ```sql
   -- Restore from backup if needed
   ```

3. **Communication**:
   - Notify stakeholders of rollback
   - Explain what went wrong
   - Provide timeline for fix

---

## Success Criteria

Migration is successful when:

1. ✅ All dashboards load without errors
2. ✅ Employee totals reflect current client assignments
3. ✅ Data integrity checks pass
4. ✅ Performance is acceptable
5. ✅ Stakeholders approve the new numbers
6. ✅ Documentation is updated
7. ✅ No critical bugs reported for 1 week

---

## Post-Migration Actions

1. **Update Documentation**:
   - Update DB_KNOWLEDGE.md
   - Add note that sales.담당자코드 should NOT be used
   - Document the new pattern

2. **Add Code Comments**:
   ```typescript
   // IMPORTANT: Always use c.담당자코드 (from clients table) not s.담당자코드 (from sales)
   // The sales table employee code is unreliable and may be outdated
   LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
   ```

3. **Create Linting Rule** (Future):
   - Detect `s.담당자코드` in queries
   - Warn developers not to use it

4. **Training**:
   - Inform team of new pattern
   - Update onboarding documentation
   - Code review guidelines

---

## Appendix A: Quick Reference

### Old Pattern (DO NOT USE):
```sql
FROM sales s
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드  ❌ UNRELIABLE
```

### New Pattern (ALWAYS USE):
```sql
FROM sales s
LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ RELIABLE
```

### Exception:
When querying clients table directly (not sales), use clients.담당자코드 directly:
```sql
FROM clients c
LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드  ✅ CORRECT
```

---

*Migration Plan created on 2026-04-05*
*Ready for implementation - estimated 4 weeks*
