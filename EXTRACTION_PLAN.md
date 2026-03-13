# Employee Commitment Tracking - Extraction Plan

## Objective

Extract from KakaoTalk messages to create a dataset that tracks:
1. **What each employee did** (completed activities)
2. **What they committed to do** (planned tasks)
3. **Issues encountered** and **actions taken** (blockers)

## Data Flow

```
kakaotalk_raw_messages
         ↓
    (filter by date range)
         ↓
    (group by employee + date)
         ↓
    AI extraction (Gemini 2.5 Flash)
         ↓
    daily_standup_log table
         ↓
    SQL queries for commitment tracking
```

## Source Table: kakaotalk_raw_messages

Already populated with parsed EML data.

**Schema:**
- `id` - message ID
- `chat_room` - chat room name
- `chat_date` - ISO timestamp (e.g., "2024-02-13T17:30:00")
- `user_name` - employee name
- `message` - message content

## Target Table: daily_standup_log

Already exists from previous migrations.

**Schema:**
```sql
{
  id: SERIAL PRIMARY KEY,
  employee_name: VARCHAR(100),
  report_date: DATE,

  -- What they did today
  completed_today: JSONB DEFAULT '[]',
  -- Format: [{"activity": "...", "customer": "...", "products": [...], "outcome": "..."}]

  -- What they plan to do
  planned_tasks: JSONB DEFAULT '[]',
  -- Format: [{"task": "...", "date": "...", "customer": "...", "location": "..."}]

  -- Issues and blockers
  blockers: JSONB DEFAULT '[]',
  -- Format: [{"issue": "...", "severity": "low|medium|high", "action_taken": "...", "status": "open|resolved"}]

  -- Metadata
  customers_visited: STRING[],
  products_discussed: STRING[],
  checkout_location: TEXT,
  work_region: TEXT,
  notes: TEXT,
  source_messages: STRING,
  confidence_score: DECIMAL(3,2)
}
```

## Extraction Process

### Step 1: Fetch Messages by Date Range

```typescript
const messages = await executeSQL(`
  SELECT id, chat_date, user_name, message, chat_room
  FROM kakaotalk_raw_messages
  WHERE DATE(chat_date) >= '2024-02-13'
    AND DATE(chat_date) <= '2024-02-16'
    AND user_name != 'SYSTEM'
  ORDER BY chat_date ASC
`);
```

### Step 2: Group by Employee and Date

Example:
```
정현우 - 2024-02-13 - [3 messages]
정현우 - 2024-02-14 - [2 messages]
이승복 - 2024-02-13 - [1 message]
...
```

### Step 3: AI Extraction per Employee per Day

Send to Gemini 2.5 Flash with **tool calling enabled**:

**Input:** All messages from one employee for one day

**Available Tool:** `fetch_employee_history(days_back)` - AI can request previous days' reports

**Workflow:**
1. AI receives today's messages
2. AI decides if it needs historical context (e.g., "visited the customer from yesterday")
3. If needed, AI calls `fetch_employee_history` tool
4. AI receives previous reports and uses them to better understand today's messages
5. AI extracts structured data

**Output:** JSON with completed_today, planned_tasks, blockers, etc.

### Step 4: Store in Database

Batch insert into `daily_standup_log` table using `insertRows()`.

### Step 5: Track Commitments Over Time

Use SQL queries to answer:

#### Q1: Did they do what they said they would?

```sql
-- Find planned tasks and check if employee reported next day
SELECT
  employee_name,
  planned_on_date,
  planned_task,
  next_day_report_exists,
  CASE
    WHEN next_day_report_exists THEN 'completed'
    ELSE 'missing'
  END as status
FROM ...
```

#### Q2: What issues were reported?

```sql
-- Extract all blockers
SELECT
  employee_name,
  report_date,
  blocker->>'issue',
  blocker->>'severity',
  blocker->>'action_taken'
FROM daily_standup_log,
  jsonb_array_elements(blockers) as blocker
```

#### Q3: Employee activity summary

```sql
SELECT
  employee_name,
  COUNT(*) as total_days,
  SUM(jsonb_array_length(completed_today)) as tasks_completed,
  SUM(jsonb_array_length(planned_tasks)) as tasks_planned,
  SUM(jsonb_array_length(blockers)) as blockers_reported
FROM daily_standup_log
GROUP BY employee_name
```

## Context Management Strategy

**Problem:** Large message history would overwhelm AI context

**Solution:** Incremental processing
- Process in small date ranges (e.g., 1 week at a time)
- Each extraction is independent (no cross-references needed during extraction)
- Commitment tracking happens AFTER extraction via SQL queries
- Database serves as the "memory" across time periods

**Example workflow:**
```bash
# Extract week 1
npx tsx scripts/extract-commitments-by-date.ts 2024-02-05 2024-02-11

# Extract week 2
npx tsx scripts/extract-commitments-by-date.ts 2024-02-12 2024-02-18

# Extract week 3
npx tsx scripts/extract-commitments-by-date.ts 2024-02-19 2024-02-25

# Then analyze all at once with SQL
npx tsx scripts/track-commitments.ts
```

## Expected Output Format

### Example daily_standup_log entry:

```json
{
  "employee_name": "정현우",
  "report_date": "2024-02-13",
  "completed_today": [
    {
      "activity": "서남바이오 방문 - 타업체 공급가격 오픈으로 가격수준 협의",
      "customer": "서남바이오",
      "products": ["Pegasus 1107"],
      "outcome": "테스트 협의, 가격제안 예정"
    }
  ],
  "planned_tasks": [
    {
      "task": "통영에코파워 터빈유 공급건으로 창원 출장",
      "date": "2024-02-14",
      "customer": "통영에코파워",
      "location": "창원"
    }
  ],
  "blockers": [
    {
      "issue": "타업체 공급가격 오픈",
      "severity": "medium",
      "action_taken": "오픈업체에 주의요청",
      "status": "open"
    }
  ],
  "customers_visited": ["서남바이오"],
  "products_discussed": ["Pegasus 1107", "터빈유"],
  "checkout_location": "서남바이오",
  "work_region": null,
  "notes": null,
  "source_messages": "33,34,35,36,37",
  "confidence_score": 0.85
}
```

## Testing Plan

### Phase 1: Single Day Test
```bash
npx tsx scripts/extract-commitments-by-date.ts 2024-02-13 2024-02-13
```

**Expected:**
- Extract ~10-15 employees who reported on Feb 13
- Each should have completed_today and planned_tasks
- Verify extraction quality manually

### Phase 2: Multi-Day Test
```bash
npx tsx scripts/extract-commitments-by-date.ts 2024-02-13 2024-02-16
```

**Expected:**
- Extract 4 days of data
- Should see planned tasks from Feb 13 appear as completed on Feb 14

### Phase 3: Full Dataset
- Process entire date range in weekly batches
- Analyze commitment completion rates
- Identify patterns in blockers

## Success Metrics

1. **Extraction Quality:** >80% of daily reports correctly parsed
2. **Commitment Tracking:** Can identify when employee planned vs completed
3. **Issue Tracking:** All blockers captured with actions taken
4. **Context Efficiency:** Process without overwhelming AI context limits

## Next Steps

1. ✅ Create extraction script (`extract-commitments-by-date.ts`)
2. ⏳ Test extraction on single day (2024-02-13)
3. ⏳ Validate extracted data quality
4. ⏳ Test multi-day extraction
5. ⏳ Create commitment tracking queries
6. ⏳ Process full dataset
7. ⏳ Generate insights and reports
