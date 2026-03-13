# KakaoTalk Follow-up Tracker: Extraction Strategy

## Overview

This document defines how we extract, match, and track employee follow-up commitments from KakaoTalk chat data.

### System Architecture

**Data Flow:**
1. **Import:** KakaoTalk .eml files → `kakaotalk_raw_messages` table (6,127 messages)
2. **Extraction:** Raw messages → AI processing (Gemini 2.5 Flash) → `employee_activity_log` + `daily_standup_log`
3. **Matching:** Planned tasks (next_action_date) matched with actual activities
4. **Presentation:** Employee dashboard shows follow-up performance, visit calendar, companies, and products

**Key Tables:**
- `kakaotalk_raw_messages`: Raw chat imports (6,127 rows, 2 chat rooms)
- `employee_activity_log`: Extracted activities with next_action tracking (80 rows currently)
- `daily_standup_log`: Daily summaries per employee (78 rows currently)
- `employee_master`: Employee profiles (21 employees)
- `product_mapping`: Product categorization for category badges (709 products)

**UI Entry Point:** `/employees` (default home page)

---

## 1. Batching Strategy: Rolling Window Approach

### Problem
If we extract the entire date range at once, we might miss follow-ups that span across different time periods. For example:
- Employee says on March 1: "다음 달에 삼성 방문 예정" (planning to visit Samsung next month)
- We need to check if they actually visited in April

### Solution: Incremental Extraction with Carryover

#### Phase 1: Bootstrap (Initial Week)
- Extract the very first week of chat history (earliest messages)
- No matching needed yet (no prior commitments to check)
- Output:
  - Activities for that week
  - Planned tasks with future `next_action_date`

#### Phase 2+: Rolling Extraction & Matching

For each subsequent week:

1. **Extract** new week's activities from messages
2. **Match** against previous weeks' planned tasks
   - Check if planned tasks from Week N-1, N-2, etc. were completed in Week N
   - Mark as completed/missed based on matching logic
3. **Carry forward** unresolved planned tasks
   - If `next_action_date` hasn't arrived yet, keep it in pending list
   - Only mark as "missed" when the date has passed and no match found

#### Example Flow

```
Week 1 (Mar 1-7):
  Extract → 5 planned tasks
    - Task A: next_action_date = Mar 10
    - Task B: next_action_date = Mar 15
    - Task C: next_action_date = Apr 1

Week 2 (Mar 8-14):
  Extract new activities + Match previous plans
    - Task A (Mar 10): ✅ Found matching activity on Mar 10
    - Task B (Mar 15): ⏰ Carry forward (date not reached yet)
    - Task C (Apr 1): ⏰ Carry forward (date not reached yet)

Week 3 (Mar 15-21):
  Extract new activities + Match carried forward plans
    - Task B (Mar 15): ✅ Found activity on Mar 17
    - Task C (Apr 1): ⏰ Carry forward (still future)

Week 5 (Apr 1-7):
  Extract new activities + Match carried forward plans
    - Task C (Apr 1): ❌ No matching activity found → MISSED
```

### Benefits
- Handles long-term commitments (weeks/months in advance)
- No follow-ups lost due to temporal gaps
- Can process incrementally without re-extracting everything
- Maintains state: pending commitments that need verification

---

## 2. Chat Room Handling

### Current State

We have **2 separate group chats**:

| Chat Room | Messages | Employees | Description |
|-----------|----------|-----------|-------------|
| Youngil OnC 최강 B2B 14 | 3,691 | 16 | Main B2B team |
| 영일오엔씨 경남&부산사업소^^* 화이팅~~!! 12 | 2,412 | 12 | Gyeongnam & Busan regional office |

### Current Behavior (Unified)

The extraction script **merges both chat rooms**:
- All messages from both rooms are processed together
- Activities grouped by employee name only
- No distinction between B2B vs Regional office

**Potential Issues:**
- If same employee appears in both rooms, we might extract duplicate activities
- Can't track team-specific metrics (B2B vs Regional performance)
- No way to filter/compare between teams

### Options

#### Option A: Separate Tracking ⭐ (Recommended if teams are independent)

**Approach:**
- Extract and track each chat room separately
- Store `chat_room` field on every activity
- Separate follow-up metrics per team

**Pros:**
- Clean separation of team metrics
- Prevents duplicate counting
- Can compare team performance: "B2B Team: 85% follow-up rate vs Busan Office: 78%"

**Cons:**
- More complex extraction logic
- Need to run extraction separately for each room (or filter in query)

**Implementation:**
```typescript
// Add chat_room filter to extraction
WHERE DATE(chat_date) = '${date}'
  AND chat_room = '${chatRoomName}'
  AND user_name != 'SYSTEM'
```

#### Option B: Unified Tracking (Current)

**Approach:**
- Merge all messages regardless of room
- Track by employee across all rooms
- One set of follow-up metrics

**Pros:**
- Simpler logic
- Good if rooms are just organizational (same team, different purposes)

**Cons:**
- Risk of duplicate activities if someone reports same work in both rooms
- Can't segment by team/region

#### Option C: Hybrid

**Approach:**
- Extract all rooms but store `chat_room` on each activity
- Store in same tables but allow filtering
- UI can segment/filter by room

**Pros:**
- Flexible querying
- Can view unified or segmented data

**Cons:**
- More complex queries
- Need to handle cross-room deduplication

### Analysis Results & Decision ✅

**Employee Overlap Analysis:**
- 7 employees appear in both rooms: 감우균, 김철주, 석이, 신형철, 조성래, 조성호, 조종복
- 9 employees only in B2B room
- 5 employees only in 경남&부산 room

**Message Distribution (for overlapping employees):**
| Employee | B2B Messages | Regional Messages | Primary Room |
|----------|--------------|-------------------|--------------|
| 조성호 | 429 (99%) | 3 (1%) | B2B |
| 조종복 | 19 (4%) | 478 (96%) | Regional |
| 김철주 | 6 (1%) | 472 (99%) | Regional |
| 조성래 | 14 (47%) | 16 (53%) | Regional |
| 신형철 | 16 (53%) | 14 (47%) | B2B |
| 석이 | 13 (68%) | 6 (32%) | B2B |
| 감우균 | 1 (50%) | 1 (50%) | Minimal activity |

**Dual-Posting Analysis (same day, both rooms):**
- 조종복: 5 days (out of hundreds)
- 신형철: 3 days
- 김철주, 조성래, 조성호: 2 days each
- 석이: 1 day
- 감우균: 0 days
- **Conclusion:** Dual-posting is extremely rare, and when it happens, content is different (e.g., emoticon in one room, work report in another)

**Decision: Option C (Hybrid) ✅**

**Rationale:**
1. **No duplicate risk:** Dual-posting is extremely rare (<1% of days), and content is different when it occurs
2. **Clear primary assignments:** Each employee has a clear "home" room (>95% of activity in one room for most)
3. **Flexibility:** Can segment by room in UI if needed, but no risk of overcounting
4. **Simplicity:** Can use current unified extraction logic without complex deduplication

**Implementation:**
- Continue extracting all rooms together (current behavior)
- Add `chat_room` field to `employee_activity_log` table
- Store chat_room name on each activity
- UI can optionally filter/segment by room (not required, but available)

**Next Steps:**
- [x] Analyze employee overlap
- [ ] Add `chat_room` column to extraction script
- [ ] Update table schema if needed
- [ ] Add room filter to UI (optional enhancement)

---

## 3. Follow-up Matching Logic

### How It Works

**Step 1: Identify Planned Tasks**

From extracted activities, filter those with:
- `next_action` IS NOT NULL
- `next_action_date` IS NOT NULL
- `activity_type` != 'other'
- `confidence_score` >= 0.7

**Step 2: Find Matching Activities**

For each planned task, search for actual activities that match:

```typescript
// Matching criteria (ALL must be true):
1. same employee_name
2. activity_date == planned.next_action_date
3. IF planned.customer_name exists:
   - actual.customer_name contains planned.customer_name
   - OR actual.activity_summary contains planned.customer_name
   ELSE:
   - Any activity on that date counts
```

**Step 3: Assign Status**

- **Future** 🔵: `next_action_date` > today
- **Completed** 🟢: Matching activity found
- **Missed** 🔴: No match found and date has passed

**Step 4: Calculate Follow-up Rate**

```
Follow-up Rate = Completed / (Completed + Missed) × 100%
```

Only past tasks count (excludes "future" status).

---

## 4. Noise Filtering

### During Extraction (Gemini Prompt)

AI is instructed to:
- **IGNORE** simple clock-out messages: "화성사무소에서 퇴근합니다"
- **IGNORE** generic completions: "외근 완료" with no details
- **ONLY EXTRACT** meaningful work content:
  - Customer visits
  - Product discussions
  - Sales activities
  - Work completed with details

### During Matching (API Query)

Only include activities with:
- `activity_type` IN ('customer_visit', 'sales_activity', 'work_completed', 'product_discussion')
- `confidence_score` >= 0.7
- `activity_type` != 'other'

---

## 5. Current Issues & Fixes

### Issue 1: Boolean Type Mismatch ✅ FIXED

**Problem:** Database expects INTEGER (0/1) for boolean columns, but we were sending JavaScript booleans (true/false)

**Fix:** Convert in extraction script:
```typescript
requires_followup: a.requires_followup ? 1 : 0,
is_blocker: a.is_blocker ? 1 : 0
```

### Issue 2: Silent Insertion Failures ✅ FIXED

**Problem:** Insertion errors were not clearly logged, leading to missing data

**Fix:**
- Added backup file creation before DB insertion
- Batch insertion (20 rows at a time) with detailed logging
- Created restore script for recovery

### Issue 3: Missing Source Tracking ✅ FIXED

**Problem:** Activities had no link back to original KakaoTalk messages

**Fix:**
- Changed `source_message_id` (INTEGER) → `source_message_ids` (TEXT)
- Store JSON array of all message IDs that contributed to each activity
- Format: `"[123, 456, 789]"`
- Same pattern used in `daily_standup_log` with `source_messages` field

**Usage:**
```typescript
// Parse source messages
const activity = await executeSQL(`SELECT source_message_ids FROM employee_activity_log WHERE id = ${id}`);
const messageIds = JSON.parse(activity.rows[0].source_message_ids);

// Fetch original messages
const messages = await executeSQL(`
  SELECT * FROM kakaotalk_raw_messages
  WHERE id IN (${messageIds.join(',')})
  ORDER BY chat_date
`);
```

**Benefits:**
- Full traceability: see which chat messages led to each extracted activity
- Audit trail for AI extraction accuracy
- Enables "View Source" feature in UI

---

## 6. Implementation Roadmap

### Phase 1: Current State (DONE)
- [x] Single-date extraction working
- [x] Date range extraction working
- [x] Follow-up tracker UI with matching logic
- [x] Backup/restore system
- [x] Boolean type fix

### Phase 2: Chat Room Strategy (COMPLETED)
- [x] Analyze employee overlap between rooms
- [x] Decide on Option C (Hybrid) for chat room handling
- [x] Add `chat_room` column to employee_activity_log table
- [x] Update extraction script to populate chat_room field
- [ ] Re-extract data to populate chat_room and source_message_ids
- [ ] (Optional) Add room filter to UI

### Phase 3: Source Message Tracking (COMPLETED)
- [x] Change `source_message_id` (INTEGER) to `source_message_ids` (TEXT)
- [x] Update extraction script to track message IDs as JSON array
- [x] Create API endpoint `/api/activities/[id]/messages` to fetch source messages
- [x] Document usage for UI integration
- [x] Add "View Source" button in UI with modal display

### Phase 4: UI Development (COMPLETED)
- [x] Employee-focused dashboard (`/employees`)
- [x] Follow-up tracker tab with date and status filters
- [x] Visit calendar view (monthly grid)
- [x] Managed companies tab with visit counts
- [x] Handled products tab with category badges
- [x] Employee search and sidebar navigation
- [x] Integration with `employee_master` table for profile data
- [x] Integration with `product_mapping` for product categories

### Phase 5: Production Usage (PENDING)
- [ ] Re-extract March 11-18 data with chat_room and source_message_ids populated
- [ ] Extract all historical data using rolling window
- [ ] Set up periodic extraction (daily/weekly)
- [ ] Dashboard enhancements:
  - [ ] Add "View Source" button to show original chat messages
  - [ ] Chat room filter in UI
  - [ ] Team comparison metrics
  - [ ] Trends over time visualization

### Phase 6: Rolling Window Extraction (FUTURE)
- [ ] Create "carry forward" logic for pending tasks
- [ ] Build incremental extraction script
- [ ] Track extraction state (last processed date per chat room)

---

---

## 7. User Interface: Employee Dashboard

### Overview

A comprehensive employee-focused dashboard at `/employees` (default home page) that provides detailed insights into each employee's activities, follow-up performance, and customer/product engagement.

**Entry Point:** Home page (`/`) redirects to `/employees`

### Features

#### 1. Employee Sidebar
**Location:** Left sidebar (320px width)
- **Search Bar:** Filter employees by name or department
- **Employee Cards:**
  - Employee name and department
  - Follow-up rate progress bar (visual percentage)
  - Sorted alphabetically in Korean (localeCompare 'ko-KR')
- **Selection:** Click to view employee details

#### 2. Employee Header
**Location:** Top of main content area
- **Profile Info:**
  - Employee name with status badge (ACTIVE/etc)
  - Department / Position
  - Team
- **Quick Stats (3 cards):**
  - Total companies visited
  - Total products mentioned
  - Follow-up rate percentage

#### 3. Tab Navigation

##### Tab 1: Follow-up Tracker
**API:** `/api/employees?employee={name}&startDate={start}&endDate={end}`

**Features:**
- Date range filter
- Status filter (all/completed/missed/future)
- Shows planned tasks vs actual completion
- Color-coded by status:
  - Green border: Completed
  - Red border: Missed
  - Gray border: Future

**Display:**
- Planned task details (date, action, customer)
- If completed: Shows actual activity with summary
- If missed: Shows warning message
- **"View Source" button:** Opens modal showing original KakaoTalk messages

**Source Messages Modal:**
- Displays all original chat messages that contributed to the activity
- Shows user avatar, name, timestamp for each message
- Chat-like interface with message bubbles
- Activity summary at top for context
- Message count in footer
- Full traceability from extraction back to source

##### Tab 2: Visit Calendar
**API:** `/api/employees/activities?employee={name}`

**Features:**
- Monthly calendar grid view
- Navigate between months
- Activity dots on dates with work
- Color-coded activities:
  - Blue: Customer visits (🏢)
  - Purple: Product discussions (🛢️)
- Hover shows activity details and products

**Implementation:**
- Calculates first day of month offset
- Filters activities by date
- Shows activity summaries and product tags per day

##### Tab 3: Managed Companies
**API:** `/api/employee-summary?employee={name}`

**Features:**
- Grid of company cards (2 columns)
- Each card shows:
  - Company icon (Building2)
  - Company name
  - Last visit date
  - Visit count (large number)
- Sorted by visit count (descending)
- Hover effect with shadow

##### Tab 4: Handled Products
**API:** `/api/employee-summary?employee={name}`

**Features:**
- Grid of product cards (2 columns)
- Each card shows:
  - Product icon (Package)
  - Product name
  - Category badges (품목그룹1명, 품목그룹2명)
  - Last mentioned date
  - Mention count (large number)
- Sorted by mention count (descending)
- Categories fetched from `product_mapping` table

### API Endpoints

#### GET `/api/activities/[id]/messages`
**Purpose:** Get original KakaoTalk messages that contributed to an activity (source tracing)

**Path Params:**
- `id`: Activity ID

**Returns:**
```json
{
  "success": true,
  "data": {
    "activity": {
      "id": 1,
      "employee_name": "김건우",
      "activity_date": "2024-03-11",
      "activity_summary": "현대위아 방문",
      "chat_room": "Youngil OnC 최강 B2B 14 님과 카카오톡 대화"
    },
    "messages": [
      {
        "id": 123,
        "chat_date": "2024-03-11T09:30:00",
        "user_name": "김건우",
        "message": "오늘 현대위아 방문 예정입니다.",
        "chat_room": "Youngil OnC 최강 B2B 14 님과 카카오톡 대화"
      },
      {
        "id": 124,
        "chat_date": "2024-03-11T15:45:00",
        "user_name": "김건우",
        "message": "현대위아 방문 완료했습니다. Mobil DTE 25 논의함.",
        "chat_room": "Youngil OnC 최강 B2B 14 님과 카카오톡 대화"
      }
    ],
    "messageCount": 2
  }
}
```

**Usage in UI:**
- Add "📄 View Source" button on activity cards
- Show original chat messages in modal/drawer
- Display full conversation context that led to the extraction
- Useful for auditing AI extraction accuracy

#### GET `/api/employees`
**Purpose:** Get employee list with follow-up stats and matches

**Query Params:**
- `employee` (optional): Filter to specific employee
- `customer` (optional): Filter by customer
- `startDate` (optional): Default '2024-01-01'
- `endDate` (optional): Default '2026-12-31'

**Returns:**
```json
{
  "success": true,
  "data": {
    "matches": [/* follow-up matches */],
    "stats": { "total": 10, "completed": 7, "missed": 2, "future": 1, "followUpRate": "77.8" },
    "employeeStats": [
      {
        "employee_name": "김건우",
        "department": "영업팀",
        "total": 5,
        "completed": 3,
        "missed": 1,
        "future": 1,
        "followUpRate": "75.0"
      }
    ],
    "filters": {
      "employees": ["김건우", "조성호", ...],
      "customers": ["삼성전자", "현대위아", ...]
    }
  }
}
```

**Special Logic:**
- Pulls ALL employees from `employee_master` table (not just those with activities)
- Merges with activity stats (shows 0 for employees with no activities)
- Sorted alphabetically by Korean name

#### GET `/api/employees/activities`
**Purpose:** Get all activities for a specific employee (for calendar view)

**Query Params:**
- `employee` (required): Employee name
- `startDate` (optional): Default '2024-01-01'
- `endDate` (optional): Default '2026-12-31'

**Returns:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "activity_date": "2024-03-11",
      "activity_type": "customer_visit",
      "activity_summary": "현대위아 방문",
      "customer_name": "현대위아",
      "products_mentioned": ["Mobil DTE 25", "Mobil SHC 630"],
      "confidence_score": 0.95
    }
  ]
}
```

**Note:** `products_mentioned` is parsed from JSON string to array in API

#### GET `/api/employee-summary`
**Purpose:** Get aggregated companies and products for an employee

**Query Params:**
- `employee` (required): Employee name

**Returns:**
```json
{
  "success": true,
  "data": {
    "companies": [
      {
        "customer_name": "삼성전자",
        "visit_count": 15,
        "last_visit": "2024-03-15"
      }
    ],
    "products": [
      {
        "product_name": "Mobil DTE 25",
        "mention_count": 8,
        "last_mentioned": "2024-03-14",
        "category1": "Industrial Lubricants",
        "category2": "Hydraulic"
      }
    ],
    "profile": {
      "employee_name": "김건우",
      "department": "영업팀",
      "position": "과장",
      "team": "본사",
      "employment_status": "active"
    }
  }
}
```

**Processing:**
1. Companies: GROUP BY customer_name with COUNT and MAX(activity_date)
2. Products: Parse JSON arrays in JavaScript, aggregate counts manually
3. Product categories: JOIN with `product_mapping` table using 품목명
4. Profile: Fetch from `employee_master` table

### Design Patterns

**Styling:**
- Modern, card-based layout with rounded corners (rounded-2xl, rounded-3xl)
- Color coding: Blue (visits), Purple (products), Green (completed), Red (missed)
- Font weights: font-bold, font-black for emphasis
- Shadow and hover effects for interactivity
- Custom scrollbar hiding with `.no-scrollbar` class

**Data Loading:**
- Parallel API calls using `Promise.all()` for employee details
- Separate loading states for sidebar vs details
- Error handling with console.error

**State Management:**
- React useState for all UI state
- useEffect for data loading on mount and selection change
- Tab state for switching between views

---

## Notes & Questions

- **Q:** How far back should we extract historical data?
- **Q:** Should we handle employee name variations (e.g., "김건우" vs "김 건우")?
- **Q:** What's the desired frequency for ongoing extraction (daily, weekly)?
- **Q:** Should we add filtering by chat_room in the employees UI?
