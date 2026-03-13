# Phase 2 Complete: Employee Activity Tables ✅

## Summary

Successfully deployed **3 employee activity tracking tables** and seeded them with **21 employees** extracted from KakaoTalk messages.

---

## 📊 Tables Created

### 1. `employee_activity_log` (직원활동로그)
**Purpose:** Track individual employee activities extracted from KakaoTalk messages

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| `source_message_id` | INTEGER | Reference to original message |
| `extracted_at` | TEXT | Extraction timestamp |
| `employee_name` | TEXT | Employee name (NOT NULL) |
| `activity_date` | DATE | Date of activity (NOT NULL) |
| `activity_type` | TEXT | Type: customer_visit, product_discussion, work_completed, sales_activity, issue_reported, planning, other |
| `activity_summary` | TEXT | Brief description (NOT NULL) |
| `activity_details` | TEXT | JSON object with detailed data |
| `customer_name` | TEXT | Customer/company visited |
| `location` | TEXT | Location/region of activity |
| `products_mentioned` | TEXT | JSON array of products discussed |
| `task_status` | TEXT | completed, in_progress, planned, blocked |
| `task_priority` | TEXT | high, medium, low |
| `time_spent_hours` | REAL | Hours spent on activity |
| `planned_completion_date` | DATE | When task is planned to complete |
| `related_project` | TEXT | Project name if applicable |
| `related_department` | TEXT | Department if applicable |
| `mentioned_employees` | TEXT | JSON array of other employees mentioned |
| `requires_followup` | INTEGER | Boolean flag (0/1) |
| `is_blocker` | INTEGER | Boolean flag (0/1) |
| `sentiment` | TEXT | positive, neutral, negative, urgent |
| `next_action` | TEXT | Description of next step |
| `next_action_date` | DATE | When next action should happen |
| `confidence_score` | REAL | AI extraction confidence (0.0-1.0) |
| `extraction_model` | TEXT | AI model used for extraction |

**Unique Constraint:** `(employee_name, activity_date, activity_summary)`

**Current Status:** 0 rows (ready for Phase 3 extraction)

---

### 2. `daily_standup_log` (일일업무요약)
**Purpose:** Daily summary of employee work activities (standup-style)

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| `employee_name` | TEXT | Employee name (NOT NULL) |
| `report_date` | DATE | Date of report (NOT NULL) |
| `completed_today` | TEXT | JSON array: [{task, details, customer, time_spent}] |
| `planned_tasks` | TEXT | JSON array: [{task, customer, deadline, priority}] |
| `blockers` | TEXT | JSON array: [{issue, needs_help_from, severity}] |
| `customers_visited` | TEXT | JSON array of customer names |
| `products_discussed` | TEXT | JSON array of product names |
| `availability_status` | TEXT | available, partial, unavailable, vacation |
| `absence_reason` | TEXT | Reason if unavailable |
| `checkout_location` | TEXT | Where employee checked out from |
| `work_region` | TEXT | Region worked (대산, 화성, etc.) |
| `notes` | TEXT | Additional notes |
| `source_messages` | TEXT | JSON array of message IDs |
| `extracted_at` | TEXT | Extraction timestamp |
| `confidence_score` | REAL | AI extraction confidence (0.0-1.0) |

**Unique Constraint:** `(employee_name, report_date)`

**Duplicate Action:** UPDATE (re-processing same date updates the record)

**Current Status:** 0 rows (ready for Phase 3 extraction)

---

### 3. `employee_master` (직원마스터)
**Purpose:** Master reference table for all employees

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| `employee_name` | TEXT | Employee name (NOT NULL, UNIQUE) |
| `employee_name_variants` | TEXT | JSON array of alternative spellings |
| `phone_number` | TEXT | Phone number |
| `email` | TEXT | Email address |
| `department` | TEXT | Department name |
| `position` | TEXT | Job title |
| `team` | TEXT | Team name |
| `region` | TEXT | Work region (경남&부산, B2B, etc.) |
| `chat_rooms` | TEXT | JSON array of chat room memberships |
| `total_messages` | INTEGER | Total messages sent |
| `first_message_date` | DATE | First message date |
| `last_message_date` | DATE | Most recent message date |
| `employment_status` | TEXT | active, inactive, on_leave |
| `start_date` | DATE | Employment start date |
| `created_at` | TEXT | Record creation timestamp |
| `updated_at` | TEXT | Last update timestamp |

**Unique Constraint:** `(employee_name)`

**Duplicate Action:** UPDATE (re-seeding updates existing records)

**Current Status:** 21 rows (seeded from KakaoTalk messages)

---

## 👥 Employee Master Data

### Total: 21 Employees

### By Region:

**B2B영업팀 (16 employees)**
- 4,681 total messages
- Active: Feb 5, 2024 - Mar 11, 2026
- Top performers:
  1. 조종복 (497 messages)
  2. 김철주 (478 messages)
  3. 조성호 (432 messages)
  4. 김기진 (426 messages)
  5. 이승복 (424 messages)

**경남&부산사업소 (5 employees)**
- 1,422 total messages
- Active: Feb 19, 2024 - Mar 11, 2026
- Top performers:
  1. 조봉건 (444 messages)
  2. 이성욱 (427 messages)
  3. 박준수(박경묵) (422 messages)

### Cross-Region Employees
Some employees appear in both chat rooms:
- 조종복, 김철주, 조성호, 조성래, 신형철, 석이, 감우균

---

## 🛠️ Scripts Created

### 1. `scripts/deploy-activity-tables.ts`
**Purpose:** Deploy all 3 employee activity tables and seed employee_master

**Usage:**
```bash
npx tsx scripts/deploy-activity-tables.ts
```

**Features:**
- ✅ Creates employee_activity_log table
- ✅ Creates daily_standup_log table
- ✅ Creates employee_master table
- ✅ Seeds employee_master from KakaoTalk messages
- ✅ Auto-detects regions from chat rooms
- ✅ Calculates employee statistics
- ✅ Verifies all tables created successfully

### 2. `scripts/view-employee-master.ts`
**Purpose:** View employee master data and statistics

**Usage:**
```bash
npx tsx scripts/view-employee-master.ts
```

**Shows:**
- Total employee count
- Employees grouped by region
- Individual employee details
- Activity statistics
- Chat room membership

---

## 📈 What We Can Track (Phase 3 Preview)

Once we extract activities in Phase 3, we'll be able to track:

### Customer Relationship Management
- Which customers each employee visits
- Visit frequency per customer
- Last contact date
- Relationship strength (message frequency)

### Sales Activity Tracking
- Customer visits per day/week/month
- Products discussed with customers
- Sales pipeline progression
- Quote submissions

### Work Completion Tracking
- Oil changes completed (product, quantity, location)
- Equipment maintenance work
- Deliveries made
- Service calls handled

### Performance Metrics
- Activities per employee
- Customer coverage by region
- Response time to customer issues
- Task completion rates

### Team Coordination
- Who works with whom
- Regional coverage
- Workload distribution
- Collaboration patterns

---

## 🔍 Sample Use Cases

### Use Case 1: Daily Activity Dashboard
```sql
SELECT
  employee_name,
  report_date,
  customers_visited,
  products_discussed,
  checkout_location
FROM daily_standup_log
WHERE report_date >= DATE('now', '-7 days')
ORDER BY report_date DESC, employee_name
```

### Use Case 2: Customer Visit History
```sql
SELECT
  customer_name,
  employee_name,
  activity_date,
  activity_summary,
  products_mentioned
FROM employee_activity_log
WHERE activity_type = 'customer_visit'
  AND customer_name = '삼표'
ORDER BY activity_date DESC
```

### Use Case 3: Employee Performance
```sql
SELECT
  e.employee_name,
  e.region,
  COUNT(a.id) as total_activities,
  COUNT(DISTINCT a.customer_name) as unique_customers,
  COUNT(DISTINCT DATE(a.activity_date)) as active_days
FROM employee_master e
LEFT JOIN employee_activity_log a ON a.employee_name = e.employee_name
GROUP BY e.employee_name
ORDER BY total_activities DESC
```

### Use Case 4: Blockers & Follow-ups
```sql
SELECT
  employee_name,
  activity_date,
  activity_summary,
  next_action,
  next_action_date
FROM employee_activity_log
WHERE (requires_followup = 1 OR is_blocker = 1)
  AND activity_date >= DATE('now', '-7 days')
ORDER BY activity_date DESC
```

---

## 🎯 Next Steps: Phase 3

### AI Activity Extraction Using Gemini 3.5 Flash Preview

**Goal:** Extract structured activities from raw KakaoTalk messages

**Script to create:** `scripts/extract-activities-gemini.ts`

**What it will do:**
1. Read messages from `kakaotalk_raw_messages` by date
2. Group messages by employee and day
3. Use Gemini AI to extract:
   - Customer visits (company names)
   - Products discussed (Mobil products, competitors)
   - Work completed (oil changes, deliveries)
   - Tomorrow's plans
   - Issues/blockers
   - Sentiment/urgency
4. Store structured data in `employee_activity_log`
5. Create daily summaries in `daily_standup_log`

**Example Input (Raw Message):**
```
[2024-02-13T17:30:00] 정현우:
서남바이오에서 퇴근합니다.
타업체 공급가격 오픈으로 가격수준 협의.
Pegasus 1107 테스트 협의(가격제안예정)
내일 통영에코파워 터빈유 공급건으로 창원 출장입니다
```

**Example Output (Extracted Activities):**
```json
[
  {
    "employee_name": "정현우",
    "activity_date": "2024-02-13",
    "activity_type": "customer_visit",
    "customer_name": "서남바이오",
    "activity_summary": "가격수준 협의 및 제품 테스트 협의",
    "products_mentioned": ["Pegasus 1107"],
    "activity_details": {
      "discussions": ["타업체 공급가격 오픈으로 가격수준 협의", "Pegasus 1107 테스트 협의"],
      "quotation_planned": true
    },
    "next_action": "통영에코파워 터빈유 공급건 출장",
    "next_action_date": "2024-02-14",
    "confidence_score": 0.95
  }
]
```

**Daily Standup Summary:**
```json
{
  "employee_name": "정현우",
  "report_date": "2024-02-13",
  "completed_today": [
    {
      "task": "서남바이오 가격 협의",
      "customer": "서남바이오",
      "details": "타업체 공급가격 오픈 대응"
    },
    {
      "task": "Pegasus 1107 테스트 협의",
      "customer": "서남바이오",
      "details": "가격제안 예정"
    }
  ],
  "planned_tasks": [
    {
      "task": "터빈유 공급",
      "customer": "통영에코파워",
      "deadline": "2024-02-14",
      "location": "창원"
    }
  ],
  "customers_visited": ["서남바이오"],
  "products_discussed": ["Pegasus 1107", "터빈유"],
  "checkout_location": "서남바이오",
  "confidence_score": 0.95
}
```

---

## 📝 Database Schema Diagram

```
┌─────────────────────────┐
│ kakaotalk_raw_messages  │
│ (6,127 rows)            │
│                         │
│ - chat_room             │
│ - chat_date             │
│ - user_name             │
│ - message               │
└────────┬────────────────┘
         │
         │ Phase 3: AI Extraction
         │ (Gemini 3.5 Flash)
         ▼
┌─────────────────────────┐     ┌──────────────────────┐
│ employee_activity_log   │     │ daily_standup_log    │
│ (0 rows - ready)        │     │ (0 rows - ready)     │
│                         │     │                      │
│ - employee_name ────────┼─────┤ - employee_name      │
│ - activity_date         │     │ - report_date        │
│ - activity_type         │     │ - completed_today    │
│ - customer_name         │     │ - planned_tasks      │
│ - products_mentioned    │     │ - blockers           │
│ - activity_summary      │     │ - customers_visited  │
│ - next_action           │     │ - products_discussed │
└────────┬────────────────┘     └──────────────────────┘
         │
         │
         ▼
┌─────────────────────────┐
│ employee_master         │
│ (21 rows - seeded)      │
│                         │
│ - employee_name (PK)    │
│ - region                │
│ - chat_rooms            │
│ - total_messages        │
│ - first_message_date    │
│ - last_message_date     │
└─────────────────────────┘
```

---

## ✅ Phase 2 Completed

**What we built:**
- ✅ 3 employee activity tracking tables
- ✅ 21 employees seeded in employee_master
- ✅ Region detection (B2B영업팀 vs 경남&부산사업소)
- ✅ Employee statistics from messages
- ✅ Deployment and verification scripts

**Database ready for Phase 3:** AI-powered activity extraction! 🚀

**Total Tables in Database:** 16
- 12 existing business tables (sales, purchases, inventory, etc.)
- 1 raw messages table (kakaotalk_raw_messages)
- 3 new activity tracking tables

---

## 🔗 Files Created in Phase 2

```
scripts/
├── deploy-activity-tables.ts        # Deploy all 3 tables + seed employees
└── view-employee-master.ts           # View employee master data

PHASE_2_SUMMARY.md                    # This file
```

**Ready for Phase 3!** 🎉
