# Goals Table Integration Checklist

This document tracks which dashboard tabs require integration with the new `sales_goals` table structure.

**New Table Schema:**
```sql
sales_goals (
  id, year, month, employee_name, category_type, category,
  industry, sector, target_weight, target_amount
)
```

---

## ✅ Completed Integrations

### Closing Meeting Tabs

- [x] **BulkGoalSettingTab.tsx**
  - Status: ✅ **FULLY IMPLEMENTED**
  - Uses new schema with employee_name, category_type, category, industry, sector
  - Supports all 5 category types: tier, division, family, business_type, industry_sector
  - Individual and bulk save functionality working
  - File: `src/components/closing-meeting/BulkGoalSettingTab.tsx`

---

## 🔄 Needs Migration/Update

### Closing Meeting Tabs

- [ ] **GoalSettingTab.tsx**
  - Status: ⚠️ **NEEDS UPDATE**
  - Current: Uses old schema with `goal_type` and `target_name`
  - Uses goal types: 'category', 'b2c-auto', 'b2b-il'
  - Target names: Teams/Categories (MB, AVI + MAR, AUTO, IL, team names)
  - **Required Changes:**
    1. Update to use new schema fields
    2. Map old goal_type logic to category_type system
    3. Update API calls to match BulkGoalSettingTab pattern
  - File: `src/components/closing-meeting/GoalSettingTab.tsx`

- [ ] **MonthlySummaryTab.tsx**
  - Status: ⚠️ **NEEDS UPDATE**
  - Current: Uses `target_weight` field (likely from old API)
  - Shows monthly data with achievement rates
  - **Required Changes:**
    1. Update API to fetch from new sales_goals table
    2. Aggregate goals by month for summary view
    3. Calculate achievement rates using new goal data
  - File: `src/components/closing-meeting/MonthlySummaryTab.tsx`

- [ ] **TargetAchievementTab.tsx**
  - Status: ⚠️ **NEEDS UPDATE**
  - Current: Uses `target_weight` in BranchTargetData interface
  - Shows branch-level target achievement
  - **Required Changes:**
    1. Aggregate goals from sales_goals by branch
    2. Update API endpoint to sum employee goals per branch
    3. Maintain achievement rate calculations
  - File: `src/components/closing-meeting/TargetAchievementTab.tsx`

- [ ] **B2BILAnalysisTab.tsx**
  - Status: ⚠️ **NEEDS UPDATE**
  - Current: Uses `target_weight` in CategoryData and TeamData interfaces
  - Shows IL category analysis with achievement rates
  - **Required Changes:**
    1. Filter goals where category_type = 'division' AND category = 'IL'
    2. Aggregate by team and category
    3. Update achievement rate calculations
  - File: `src/components/closing-meeting/B2BILAnalysisTab.tsx`

- [ ] **B2CAutoAnalysisTab.tsx**
  - Status: ⚠️ **NEEDS UPDATE**
  - Current: Uses `target_weight` in CategoryData and TeamData interfaces
  - Shows AUTO category analysis with achievement rates
  - **Required Changes:**
    1. Filter goals where category_type = 'division' AND category IN ('AUTO', 'PVL', 'CVL')
    2. Aggregate by team and category
    3. Update achievement rate calculations
  - File: `src/components/closing-meeting/B2CAutoAnalysisTab.tsx`

### B2C Meeting Tabs

- [ ] **ManagerSalesTab.tsx**
  - Status: ⚠️ **NEEDS UPDATE**
  - Current: Uses GoalDataRow interface with employee_name, fleet_goal, lcc_goal
  - Shows manager sales by Fleet/LCC channels
  - **Required Changes:**
    1. Query goals where category_type = 'business_type'
    2. Filter by category IN ('Fleet', 'LCC')
    3. Aggregate by employee_name
  - File: `src/components/b2c-meetings/ManagerSalesTab.tsx`

- [ ] **BusinessTab.tsx**
  - Status: ⚠️ **NEEDS UPDATE**
  - Current: Uses `goal_weight` and `goal_amount` in BusinessDataRow
  - Shows business type (Fleet/LCC) analysis with 10-year trends
  - **Required Changes:**
    1. Query goals where category_type = 'business_type'
    2. Aggregate by branch and business_type (category)
    3. Update charts: MonthlyComparisonChart, TenYearTrendChart, AchievementRateChart
  - File: `src/components/b2c-meetings/BusinessTab.tsx`

### B2C Meeting Charts (used by BusinessTab)

- [ ] **MonthlyComparisonChart.tsx**
  - Status: ⚠️ **NEEDS UPDATE**
  - Current: Uses `goal_weight`, `goal_amount` from BusinessDataRow
  - Shows monthly comparison with goal line (optional)
  - **Required Changes:**
    1. Accept aggregated goal data from parent
    2. Display goal line when showGoals=true
  - File: `src/components/b2c-meetings/charts/MonthlyComparisonChart.tsx`

- [ ] **TenYearTrendChart.tsx**
  - Status: ⚠️ **NEEDS UPDATE**
  - Current: Uses aggregateGoalByYear function prop
  - Shows 10-year trend with goal lines (optional)
  - **Required Changes:**
    1. Accept aggregated goal data from parent
    2. Display goal lines when showGoals=true
  - File: `src/components/b2c-meetings/charts/TenYearTrendChart.tsx`

- [ ] **AchievementRateChart.tsx**
  - Status: ⚠️ **NEEDS UPDATE**
  - Current: Uses goalData Map with goal_weight, goal_amount
  - Shows achievement rate by business type and branch
  - **Required Changes:**
    1. Accept aggregated goal data from parent
    2. Calculate achievement percentage from goals
  - File: `src/components/b2c-meetings/charts/AchievementRateChart.tsx`

---

## ❌ No Goals Integration Needed

These tabs are purely analytical and don't require goal data:

### B2C Meeting Tabs
- TeamSalesTab.tsx - Team sales amount analysis only
- TeamVolumeTab.tsx - Team volume analysis only
- SalesAmountTab.tsx - Employee monthly sales tracking
- TeamStrategyTab.tsx - Strategic analysis
- CustomerReasonTab.tsx - Customer analysis
- ShoppingMallTab.tsx - Shopping mall analysis
- SalesAnalysisTab.tsx - General sales analysis
- NewTab.tsx - New customer/product tracking
- ComingSoonTab.tsx - Placeholder

### B2B Meeting Tabs
- B2BTeamTab.tsx - Team performance by industry
- IndustryTab.tsx - Industry sector analysis
- ClientTab.tsx - Client product analysis
- RegionTab.tsx - Regional analysis
- ProductGroupTab.tsx - Product group analysis
- IndustryDairyTab.tsx - Dairy industry specific
- NewClientTab.tsx - New client tracking
- FPSTab.tsx - FPS analysis
- AllProductsTab.tsx - All products overview

### Closing Meeting Tabs
- BranchPerformanceTab.tsx - Branch performance comparison (no goals shown)
- YearOverYearTab.tsx - YoY growth analysis (no goals shown)
- ComingSoonTab.tsx - Placeholder

---

## Migration Priority

### High Priority (User-facing goal features)
1. **GoalSettingTab.tsx** - Primary goal input interface alongside BulkGoalSettingTab
2. **MonthlySummaryTab.tsx** - Dashboard overview with achievement tracking
3. **TargetAchievementTab.tsx** - Branch-level achievement monitoring

### Medium Priority (Analysis tabs)
4. **B2BILAnalysisTab.tsx** - IL-specific analysis with goals
5. **B2CAutoAnalysisTab.tsx** - AUTO-specific analysis with goals
6. **ManagerSalesTab.tsx** - Manager-level Fleet/LCC goal tracking

### Lower Priority (Chart enhancements)
7. **BusinessTab.tsx + Charts** - Business type analysis with optional goal visualization
   - MonthlyComparisonChart.tsx
   - TenYearTrendChart.tsx
   - AchievementRateChart.tsx

---

## Migration Notes

### Key Mapping Patterns

**Old → New Schema Mapping:**

| Old System | New System |
|------------|------------|
| `goal_type: 'category'` | `category_type: 'division'` + category: 'MB', 'AUTO', 'IL', etc. |
| `goal_type: 'b2c-auto'` | `category_type: 'division'` + category IN ('AUTO', 'PVL', 'CVL') |
| `goal_type: 'b2b-il'` | `category_type: 'division'` + category: 'IL' |
| `target_name: team_name` | Aggregate by `employee_name` where employee.team = team_name |
| `target_name: category` | `category` field directly |

### Common Query Patterns

**Get goals for a specific category type:**
```sql
SELECT * FROM sales_goals
WHERE year = '2025'
  AND month = '01'
  AND category_type = 'division'
  AND category = 'IL'
```

**Aggregate goals by team:**
```sql
SELECT
  ec.b2b팀 as team,
  SUM(sg.target_weight) as team_target_weight,
  SUM(sg.target_amount) as team_target_amount
FROM sales_goals sg
LEFT JOIN employee_category ec ON sg.employee_name = ec.담당자
WHERE sg.year = '2025' AND sg.category_type = 'division'
GROUP BY ec.b2b팀
```

**Aggregate goals by branch:**
```sql
SELECT
  ec.전체사업소 as branch,
  SUM(sg.target_weight) as branch_target_weight,
  SUM(sg.target_amount) as branch_target_amount
FROM sales_goals sg
LEFT JOIN employee_category ec ON sg.employee_name = ec.담당자
WHERE sg.year = '2025' AND sg.month = '01'
GROUP BY ec.전체사업소
```

---

## Testing Checklist

After migrating each component, verify:
- [ ] Goals fetch correctly from sales_goals table
- [ ] Proper filtering by year, month, category_type, category
- [ ] Achievement rates calculate correctly (actual / target * 100)
- [ ] Employee-level goals aggregate correctly to team/branch level
- [ ] Industry/sector fields display correctly where applicable
- [ ] UI displays "0" or "목표 미설정" when no goals exist
- [ ] Save functionality uses insertRows with unique constraint (upsert behavior)

---

## Related Files

- API Route: `/src/app/api/dashboard/closing-meeting/route.ts`
- Helper Functions: `/egdesk-helpers.ts`
- Table Schema: Created via `user_data_create_table` tool
- Example Implementation: `BulkGoalSettingTab.tsx`
