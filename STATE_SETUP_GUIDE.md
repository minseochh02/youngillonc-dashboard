# State-Based Extraction Setup Guide

## Overview

This guide walks you through setting up the state-based extraction system.

---

## Step 1: Create `employee_knowledge` table

```bash
npx tsx scripts/create-employee-knowledge-table.ts
```

This creates a new table to store AI's persistent memory about each employee's work patterns.

---

## Step 2: Rebuild `employee_activity_log` with new fields

**⚠️ WARNING: This will DELETE all existing activities!**

```bash
npx tsx scripts/add-state-tracking-fields.ts
```

This adds three new fields:
- `is_followup_to`: Links to previous activity ID
- `context_notes`: AI-generated historical context
- `is_repeat_visit`: Boolean flag for repeat visits

---

## Step 3: Run state-based extraction

```bash
npx tsx scripts/extract-with-state.ts 2024-03-08 2024-03-11
```

### What happens:

**For each thread:**
1. ✅ Loads employee knowledge from database
2. ✅ AI sees: open tasks, recent visits, ongoing issues
3. ✅ Extracts activities with full context
4. ✅ Updates employee knowledge in database

**Example output:**
```
📅 Processing 2024-03-11...
   📨 Found 19 messages
   🧵 Detected 3 conversation threads

   Thread 1/3 (1 msgs):
      Loading knowledge for 1 employees... ✅
      Extracting activities... ✅ 1 activities

   Thread 3/3 (17 msgs):
      Loading knowledge for 9 employees... ✅
      Extracting activities... ✅ 16 activities

   💾 Updating employee knowledge...
   ✅ Updated knowledge for 9 employees
   📊 Total: 18 activities for 2024-03-11
```

---

## What You Get

### Better Extraction

**Before (no state):**
```json
{
  "employee_name": "김건우",
  "activity_summary": "삼성디스플레이 방문",
  "customer_name": "삼성디스플레이"
}
```

**After (with state):**
```json
{
  "employee_name": "김건우",
  "activity_summary": "삼성디스플레이 방문",
  "customer_name": "삼성디스플레이",
  "is_repeat_visit": 1,
  "is_followup_to": 45,
  "context_notes": "5일 전 방문 (2024-03-06). 쿨링타워 HI POP 승인 건 진행 중"
}
```

### Smart Follow-up Tracking

**March 11:** "내일 한국지엠 부평 방문 예정"
- Creates planning activity
- Saves to `employee_knowledge.open_tasks`

**March 12:** "한국지엠 부평 방문 완료"
- AI sees open task in knowledge
- Links completion to plan: `is_followup_to = <plan_id>`
- Clears task from `open_tasks`

### Multi-Customer Split

**Input:** "삼성디스플레이, 우신엔지어링, 정일제지 방문"

**Output:** 3 separate activities
1. 삼성디스플레이 방문 (is_repeat_visit: 1, context_notes: "...")
2. 우신엔지어링 방문 (is_repeat_visit: 1, context_notes: "...")
3. 정일제지 방문 (is_repeat_visit: 0, context_notes: "첫 방문")

---

## Querying Employee Knowledge

### See current state for an employee
```sql
SELECT
  employee_name,
  open_tasks,
  recent_visits,
  ongoing_issues
FROM employee_knowledge
WHERE employee_name = '김건우';
```

### Find overdue tasks
```sql
SELECT
  employee_name,
  open_tasks
FROM employee_knowledge
WHERE open_tasks LIKE '%planned_date%';
```

### See all repeat visits
```sql
SELECT *
FROM employee_activity_log
WHERE is_repeat_visit = 1
ORDER BY activity_date DESC;
```

### See all follow-up completions
```sql
SELECT
  a.employee_name,
  a.activity_date,
  a.activity_summary,
  prev.activity_summary as original_plan
FROM employee_activity_log a
JOIN employee_activity_log prev ON a.is_followup_to = prev.id
WHERE a.is_followup_to IS NOT NULL;
```

---

## Files Created

- `scripts/create-employee-knowledge-table.ts` - Creates employee_knowledge table
- `scripts/add-state-tracking-fields.ts` - Rebuilds activity log with new fields
- `scripts/extract-with-state.ts` - Main extraction script
- `STATE_BASED_EXTRACTION.md` - Complete design document

---

## Next Steps

After extraction completes:
1. Check the backup JSON file: `extraction-state-2024-03-08-to-2024-03-11.json`
2. View the dashboard: http://localhost:3000/employees
3. Query employee_knowledge to see AI's maintained state
4. Run extraction on new dates - state persists across runs!
