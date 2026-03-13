# State-Based Extraction System Design

## Overview

Three-table system where AI maintains persistent state about employee work patterns, enabling context-aware extraction without embeddings.

---

## Table Schemas

### 1. `kakaotalk_raw_messages` (Source Data)

**Purpose**: Raw conversation data from KakaoTalk exports

```sql
CREATE TABLE kakaotalk_raw_messages (
  id INTEGER PRIMARY KEY,
  chat_room TEXT NOT NULL,
  chat_date TEXT NOT NULL,  -- ISO timestamp
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  UNIQUE(chat_room, chat_date, user_name)
);
```

**Example Data:**
| id  | chat_date           | user_name | message                                                      |
|-----|---------------------|-----------|--------------------------------------------------------------|
| 151 | 2024-03-06T17:20:00 | 김건우    | 삼성디스플레이, 우신엔지니어링, 동화기업 아산, 티피에스 방문 후 퇴근합니다. 내일 apk 부천 오일교체작업 예정입니다. |
| 180 | 2024-03-11T17:32:00 | 김건우    | 우신엔지어링, 삼성디스플레이, 정일제지 방문 후 퇴근합니다. 내일 한국지엠 부평 방문 건으로 서울 출근 예정입니다. |

---

### 2. `employee_knowledge` (AI Persistent State)

**Purpose**: AI-maintained state of each employee's current work context

```sql
CREATE TABLE employee_knowledge (
  employee_name TEXT PRIMARY KEY,

  -- Open/pending tasks
  open_tasks TEXT,          -- JSON: [{task, customer, planned_date, created_date}]

  -- Recent customer visits (last 30 days, max 10)
  recent_visits TEXT,       -- JSON: [{customer, date, activity_id}]

  -- Ongoing issues/blockers
  ongoing_issues TEXT,      -- JSON: [{issue, customer, reported_date, activity_id}]

  -- Metadata
  last_updated TEXT,        -- ISO timestamp
  last_activity_date TEXT   -- Last date we saw activity from this employee
);
```

**Example Data (김건우 on March 6):**
```json
{
  "employee_name": "김건우",
  "open_tasks": [
    {
      "task": "apk 부천 오일교체작업",
      "customer": "apk",
      "planned_date": "2024-03-07",
      "created_date": "2024-03-06"
    }
  ],
  "recent_visits": [
    {
      "customer": "삼성디스플레이",
      "date": "2024-03-06",
      "activity_id": 45
    },
    {
      "customer": "우신엔지니어링",
      "date": "2024-03-06",
      "activity_id": 46
    },
    {
      "customer": "동화기업",
      "date": "2024-03-06",
      "activity_id": 47
    },
    {
      "customer": "티피에스",
      "date": "2024-03-06",
      "activity_id": 48
    }
  ],
  "ongoing_issues": [],
  "last_updated": "2024-03-06T18:00:00",
  "last_activity_date": "2024-03-06"
}
```

**Example Data (김건우 on March 11):**
```json
{
  "employee_name": "김건우",
  "open_tasks": [
    {
      "task": "한국지엠 부평 방문",
      "customer": "한국지엠",
      "location": "부평",
      "planned_date": "2024-03-12",
      "created_date": "2024-03-11"
    }
  ],
  "recent_visits": [
    {
      "customer": "우신엔지어링",
      "date": "2024-03-11",
      "activity_id": 78
    },
    {
      "customer": "삼성디스플레이",
      "date": "2024-03-11",
      "activity_id": 79
    },
    {
      "customer": "정일제지",
      "date": "2024-03-11",
      "activity_id": 80
    },
    {
      "customer": "삼성디스플레이",
      "date": "2024-03-06",
      "activity_id": 45
    },
    {
      "customer": "우신엔지니어링",
      "date": "2024-03-06",
      "activity_id": 46
    }
  ],
  "ongoing_issues": [
    {
      "issue": "티케이엘리베이터 기어 파손 안전문제 - Shell 제품 부적절 투입",
      "customer": "티케이엘리베이터",
      "reported_date": "2024-03-11",
      "activity_id": 77
    }
  ],
  "last_updated": "2024-03-11T18:00:00",
  "last_activity_date": "2024-03-11"
}
```

---

### 3. `employee_activity_log` (Extracted Activities)

**Purpose**: Final extracted activities with context

```sql
CREATE TABLE employee_activity_log (
  id INTEGER PRIMARY KEY,
  employee_name TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  activity_type TEXT,  -- customer_visit, planning, issue_reported, etc.
  activity_summary TEXT,

  -- Customer/location info
  customer_name TEXT,
  location TEXT,

  -- Products
  products_mentioned TEXT,  -- JSON array

  -- Task status
  task_status TEXT,  -- completed, planned, in_progress

  -- Follow-up tracking
  next_action TEXT,
  next_action_date TEXT,
  requires_followup INTEGER DEFAULT 0,
  is_blocker INTEGER DEFAULT 0,

  -- Context from employee_knowledge
  is_followup_to INTEGER,     -- References another activity_id
  context_notes TEXT,          -- AI-generated context from employee_knowledge
  is_repeat_visit INTEGER DEFAULT 0,  -- Detected from recent_visits

  -- Source tracking
  source_message_ids TEXT,  -- JSON array of message IDs
  chat_room TEXT,

  -- Metadata
  confidence_score REAL,
  sentiment TEXT,
  extraction_model TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Example Data:**

| id  | employee_name | activity_date | activity_type | activity_summary | customer_name | is_repeat_visit | context_notes | source_message_ids |
|-----|---------------|---------------|---------------|------------------|---------------|-----------------|---------------|--------------------|
| 78  | 김건우        | 2024-03-11    | customer_visit | 우신엔지어링 방문 | 우신엔지어링   | 1               | 5일 전 방문 기록 있음 (2024-03-06) | [180] |
| 79  | 김건우        | 2024-03-11    | customer_visit | 삼성디스플레이 방문 | 삼성디스플레이 | 1               | 5일 전 방문 (2024-03-06), 2주 전에도 방문 (2024-02-19). 쿨링타워 HI POP 승인 대기 중 | [180] |
| 80  | 김건우        | 2024-03-11    | customer_visit | 정일제지 방문 | 정일제지 | 0               | 첫 방문 기록 | [180] |
| 81  | 김건우        | 2024-03-11    | planning | 한국지엠 부평 방문 예정 (서울 출근) | 한국지엠 | 0 | 부평 지역 방문 계획 | [180] |

---

## Extraction Flow

### Day 1: March 6 Processing

**Input Message (id: 151):**
```
김건우: 삼성디스플레이, 우신엔지니어링, 동화기업 아산, 티피에스 방문 후 퇴근합니다.
내일 apk 부천 오일교체작업 예정입니다.
```

**AI Process:**

1. **Query employee_knowledge:**
   ```sql
   SELECT * FROM employee_knowledge WHERE employee_name = '김건우'
   ```
   → Returns: NULL (first time seeing 김건우)

2. **Extract activities:**
   - Split multi-customer visits into 4 separate activities
   - Create planning activity for tomorrow

3. **Insert activities:**
   ```sql
   INSERT INTO employee_activity_log (...)
   VALUES
     ('김건우', '2024-03-06', 'customer_visit', '삼성디스플레이 방문', '삼성디스플레이', ...),
     ('김건우', '2024-03-06', 'customer_visit', '우신엔지니어링 방문', '우신엔지니어링', ...),
     ('김건우', '2024-03-06', 'customer_visit', '동화기업 방문', '동화기업', ...),
     ('김건우', '2024-03-06', 'customer_visit', '티피에스 방문', '티피에스', ...),
     ('김건우', '2024-03-06', 'planning', 'apk 부천 오일교체작업 예정', 'apk', ...);
   ```

4. **Update employee_knowledge:**
   ```sql
   INSERT OR REPLACE INTO employee_knowledge (employee_name, open_tasks, recent_visits, ...)
   VALUES (
     '김건우',
     '[{"task": "apk 부천 오일교체작업", "planned_date": "2024-03-07"}]',
     '[{"customer": "삼성디스플레이", "date": "2024-03-06", "activity_id": 45}, ...]',
     ...
   );
   ```

---

### Day 2: March 11 Processing

**Input Message (id: 180):**
```
김건우: 우신엔지어링, 삼성디스플레이, 정일제지 방문 후 퇴근합니다.
내일 한국지엠 부평 방문 건으로 서울 출근 예정입니다.
```

**AI Process:**

1. **Query employee_knowledge:**
   ```sql
   SELECT * FROM employee_knowledge WHERE employee_name = '김건우'
   ```
   → Returns: State with recent_visits, open_tasks, etc.

2. **AI analyzes with context:**
   - Sees: 우신엔지어링 was visited on 2024-03-06 (5 days ago)
   - Sees: 삼성디스플레이 was visited on 2024-03-06 AND 2024-02-19
   - Sees: 정일제지 is NEW (not in recent_visits)
   - Sees: open_tasks has "apk 부천" planned for March 7 (but no completion report)

3. **Extract activities with context:**
   ```sql
   INSERT INTO employee_activity_log (...)
   VALUES
     (
       '김건우', '2024-03-11', 'customer_visit',
       '우신엔지어링 방문', '우신엔지어링',
       is_repeat_visit = 1,
       context_notes = '5일 전 방문 기록 있음 (2024-03-06)',
       is_followup_to = 46,  -- References March 6 visit
       ...
     ),
     (
       '김건우', '2024-03-11', 'customer_visit',
       '삼성디스플레이 방문', '삼성디스플레이',
       is_repeat_visit = 1,
       context_notes = '5일 전 방문 (2024-03-06), 2주 전에도 방문 (2024-02-19). 쿨링타워 HI POP 승인 건 진행 중',
       is_followup_to = 45,
       ...
     ),
     (
       '김건우', '2024-03-11', 'customer_visit',
       '정일제지 방문', '정일제지',
       is_repeat_visit = 0,
       context_notes = '첫 방문 기록',
       ...
     ),
     (
       '김건우', '2024-03-11', 'planning',
       '한국지엠 부평 방문 예정 (서울 출근)', '한국지엠',
       task_status = 'planned',
       next_action_date = '2024-03-12',
       requires_followup = 1,
       ...
     );
   ```

4. **Update employee_knowledge:**
   ```sql
   UPDATE employee_knowledge
   SET
     open_tasks = '[{"task": "한국지엠 부평 방문", "planned_date": "2024-03-12", ...}]',
     recent_visits = '[
       {"customer": "우신엔지어링", "date": "2024-03-11", "activity_id": 78},
       {"customer": "삼성디스플레이", "date": "2024-03-11", "activity_id": 79},
       {"customer": "정일제지", "date": "2024-03-11", "activity_id": 80},
       {"customer": "삼성디스플레이", "date": "2024-03-06", "activity_id": 45},
       {"customer": "우신엔지니어링", "date": "2024-03-06", "activity_id": 46}
     ]',
     ongoing_issues = '[
       {"issue": "티케이엘리베이터 기어 파손 안전문제", "customer": "티케이엘리베이터", "reported_date": "2024-03-11", "activity_id": 77}
     ]',
     last_updated = '2024-03-11T18:00:00',
     last_activity_date = '2024-03-11'
   WHERE employee_name = '김건우';
   ```

---

### Day 3: March 12 Processing

**Input Message (hypothetical):**
```
김건우: 한국지엠 부평 방문 완료했습니다.
```

**AI Process:**

1. **Query employee_knowledge:**
   ```sql
   SELECT * FROM employee_knowledge WHERE employee_name = '김건우'
   ```
   → Returns: open_tasks has "한국지엠 부평 방문" planned for today

2. **AI recognizes task completion:**
   - Sees: This matches open_task "한국지엠 부평 방문"
   - Creates activity with is_followup_to pointing to the planning activity

3. **Extract activity:**
   ```sql
   INSERT INTO employee_activity_log (...)
   VALUES (
     '김건우', '2024-03-12', 'customer_visit',
     '한국지엠 부평 방문 완료', '한국지엠',
     is_followup_to = 81,  -- References the planning activity from March 11
     context_notes = '계획된 작업 완료 (2024-03-11에 계획됨)',
     task_status = 'completed',
     ...
   );
   ```

4. **Update employee_knowledge (clear completed task):**
   ```sql
   UPDATE employee_knowledge
   SET
     open_tasks = '[]',  -- Task completed, clear it
     recent_visits = '[
       {"customer": "한국지엠", "date": "2024-03-12", "activity_id": 95},
       {"customer": "우신엔지어링", "date": "2024-03-11", "activity_id": 78},
       ...
     ]',
     ...
   WHERE employee_name = '김건우';
   ```

---

## AI Tool Functions

The AI will have access to these functions during extraction:

### 1. Query Employee Knowledge
```typescript
async function getEmployeeKnowledge(employee_name: string) {
  const result = await executeSQL(`
    SELECT
      open_tasks,
      recent_visits,
      ongoing_issues
    FROM employee_knowledge
    WHERE employee_name = '${employee_name}'
  `);

  if (result.rows.length === 0) {
    return null;  // First time seeing this employee
  }

  return {
    open_tasks: JSON.parse(result.rows[0].open_tasks || '[]'),
    recent_visits: JSON.parse(result.rows[0].recent_visits || '[]'),
    ongoing_issues: JSON.parse(result.rows[0].ongoing_issues || '[]')
  };
}
```

### 2. Update Employee Knowledge
```typescript
async function updateEmployeeKnowledge(
  employee_name: string,
  knowledge: {
    open_tasks: any[],
    recent_visits: any[],
    ongoing_issues: any[]
  }
) {
  await insertRows('employee_knowledge', [{
    employee_name,
    open_tasks: JSON.stringify(knowledge.open_tasks),
    recent_visits: JSON.stringify(knowledge.recent_visits),
    ongoing_issues: JSON.stringify(knowledge.ongoing_issues),
    last_updated: new Date().toISOString()
  }]);
}
```

### 3. Query Recent Activities (for additional context)
```typescript
async function getRecentActivities(customer_name: string, days: number = 30) {
  const result = await executeSQL(`
    SELECT
      id, employee_name, activity_date, activity_summary, activity_type
    FROM employee_activity_log
    WHERE customer_name LIKE '%${customer_name}%'
      AND activity_date >= date('now', '-${days} days')
    ORDER BY activity_date DESC
    LIMIT 10
  `);

  return result.rows;
}
```

---

## State Management Rules

### Open Tasks
- **Add**: When employee mentions "내일 X 예정" or "계획"
- **Keep**: Until completion message or 7 days pass
- **Remove**: When employee reports completion OR when stale (>7 days)

### Recent Visits
- **Add**: Every customer_visit activity
- **Keep**: Last 30 days
- **Limit**: Max 10 most recent
- **Remove**: Visits older than 30 days

### Ongoing Issues
- **Add**: When activity_type = "issue_reported" OR is_blocker = 1
- **Keep**: Until resolution mentioned or 60 days
- **Remove**: When resolved or stale (>60 days)

### Frequent Customers
- **Not stored in employee_knowledge** - Query from employee_activity_log when needed
- This data naturally emerges from the activity log with GROUP BY queries

---

## Benefits of This Approach

1. **No Embeddings Needed**: Direct SQL queries, zero vector search cost
2. **Stateful Tracking**: Knows what's open/closed for each employee
3. **Context-Aware**: AI sees previous visits, planned tasks, ongoing issues
4. **Self-Maintaining**: State updates automatically with each extraction
5. **Auditable**: Can query employee_knowledge to see current state
6. **Scalable**: SQLite handles thousands of employees easily
7. **Simple**: Pure SQL, no external dependencies

---

## Example Queries

### "What tasks does 김건우 have open?"
```sql
SELECT open_tasks
FROM employee_knowledge
WHERE employee_name = '김건우';
```

### "Who visited 삼성디스플레이 recently?"
```sql
SELECT DISTINCT employee_name, activity_date
FROM employee_activity_log
WHERE customer_name LIKE '%삼성디스플레이%'
  AND activity_type = 'customer_visit'
  AND activity_date >= date('now', '-30 days')
ORDER BY activity_date DESC;
```

### "Which customers does 김건우 visit most frequently?"
```sql
SELECT customer_name, COUNT(*) as visit_count, MAX(activity_date) as last_visit
FROM employee_activity_log
WHERE employee_name = '김건우'
  AND activity_type = 'customer_visit'
  AND activity_date >= date('now', '-90 days')
GROUP BY customer_name
ORDER BY visit_count DESC
LIMIT 10;
```

### "Show all activities with follow-up context"
```sql
SELECT
  a.*,
  prev.activity_summary as previous_activity
FROM employee_activity_log a
LEFT JOIN employee_activity_log prev ON a.is_followup_to = prev.id
WHERE a.is_followup_to IS NOT NULL;
```

### "Which employees have overdue tasks?"
```sql
SELECT
  employee_name,
  open_tasks
FROM employee_knowledge
WHERE open_tasks LIKE '%planned_date%'
  AND json_extract(open_tasks, '$[0].planned_date') < date('now');
```

---

## Next Steps

1. Create `employee_knowledge` table schema
2. Implement AI tool functions for querying/updating state
3. Update extraction script to use employee knowledge
4. Add state cleanup logic (remove stale tasks/visits)
5. Build dashboard to visualize employee states
