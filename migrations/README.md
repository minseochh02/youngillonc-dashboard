# Database Migrations

This directory contains SQL migration scripts for the employee activity tracking system.

## Migration Files

### 001_create_employee_activity_tables.sql
Creates the core tables for employee activity tracking:
- `employee_activity_log`: Main activity tracking table
- `daily_standup_log`: Daily standup-style summary table
- `employee_master`: Employee master data table
- Indexes for performance optimization
- Useful views for reporting
- Helper functions and triggers

### 001_rollback.sql
Rollback script to undo the changes from migration 001.

### 002_seed_employee_master.sql
Seeds the `employee_master` table with employees from existing KakaoTalk messages.

## How to Run Migrations

### Option 1: Using psql command line
```bash
psql -h <host> -U <username> -d <database> -f migrations/001_create_employee_activity_tables.sql
psql -h <host> -U <username> -d <database> -f migrations/002_seed_employee_master.sql
```

### Option 4: Using migrate-v2.ts (recommended)
Use the enhanced migration script that uses `@egdesk-helpers.ts` to create tables and seed data through the EGDesk API.

```bash
npx tsx scripts/migrate-v2.ts 001_create_employee_activity_tables.sql
npx tsx scripts/migrate-v2.ts 002_seed_employee_master.sql
```

### Option 3: Copy-paste into database client
Open the SQL files and execute them in your preferred database client (pgAdmin, DBeaver, etc.).

## Rollback

To rollback migration 001:
```bash
psql -h <host> -U <username> -d <database> -f migrations/001_rollback.sql
```

## Tables Created

### employee_activity_log
Main table for tracking all employee activities extracted from messages.

**Key fields:**
- `activity_type`: task_completed, task_planned, meeting_attendance, etc.
- `activity_summary`: Brief description of the activity
- `activity_details`: JSONB field for flexible structured data
- `confidence_score`: AI extraction confidence (0-1)

### daily_standup_log
Daily summary table following standup meeting format.

**Key fields:**
- `completed_today`: JSON array of completed tasks
- `planned_tasks`: JSON array of planned tasks
- `blockers`: JSON array of blockers/issues
- `availability_status`: available, partial, unavailable

### employee_master
Master employee reference table.

**Key fields:**
- `employee_name`: Primary employee name
- `employee_name_variants`: Array of name variations
- `department`, `position`, `team`: Organizational info

## Views Created

- `v_employee_recent_activity`: Last 30 days of activity by employee
- `v_weekly_standup_summary`: Weekly aggregation of standup data
- `v_current_blockers_followups`: Current items needing attention

## Example Queries

### Get recent activity for an employee
```sql
SELECT * FROM v_employee_recent_activity
WHERE employee_name = '차민수'
ORDER BY activity_date DESC
LIMIT 10;
```

### Find all current blockers
```sql
SELECT * FROM v_current_blockers_followups
WHERE flag_type = 'blocker'
ORDER BY activity_date DESC;
```

### Get weekly standup summary
```sql
SELECT * FROM v_weekly_standup_summary
WHERE week_start >= CURRENT_DATE - INTERVAL '4 weeks'
ORDER BY week_start DESC, employee_name;
```

## Extraction Strategy: Why Daily Conversation Windows?

The KakaoTalk data is a **group chat**, not individual messages. This creates challenges:

1. **Temporal context**: Messages reference each other across time
2. **Conversation threading**: Multiple discussions happening simultaneously
3. **Attribution**: Need to track who is replying to whom
4. **Context preservation**: "I'll do that" needs prior context to understand

**Solution**: Process entire day's conversation as a single unit
- AI sees ALL messages from one day together
- Preserves conversation context and references
- Properly attributes tasks based on conversation flow
- More accurate extraction than processing messages individually

## Next Steps

After running the migrations:

1. **Run migrations**:
   ```bash
   npx tsx scripts/run-migration.ts 001_create_employee_activity_tables.sql
   npx tsx scripts/run-migration.ts 002_seed_employee_master.sql
   ```

2. **Set up Gemini API**:
   ```bash
   npm install @google/generative-ai
   export GEMINI_API_KEY=your_key  # Get from https://aistudio.google.com/app/apikey
   ```

3. **Extract activities** (uses daily conversation windows):
   ```bash
   # Process last 7 days
   npx tsx scripts/extract-daily-activities.ts --days=7

   # Process specific date
   npx tsx scripts/extract-daily-activities.ts --date=2026-03-07
   ```

4. **View results**:
   ```bash
   # View daily standups
   npx tsx scripts/view-daily-activities.ts --date=2026-03-07

   # View detailed activities
   npx tsx scripts/view-daily-activities.ts --employee="차민수" --detailed
   ```

5. **Build dashboards**: Create visualizations using the views
6. **Set up automation**: Schedule regular daily extraction for new messages
