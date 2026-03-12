-- Rollback Migration: Drop employee activity tracking tables
-- Created: 2026-03-11

-- Drop views first (dependent objects)
DROP VIEW IF EXISTS v_current_blockers_followups;
DROP VIEW IF EXISTS v_weekly_standup_summary;
DROP VIEW IF EXISTS v_employee_recent_activity;

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_employee_master_timestamp ON employee_master;

-- Drop functions
DROP FUNCTION IF EXISTS update_employee_master_timestamp();

-- Drop indexes (will be automatically dropped with tables, but explicit for clarity)
DROP INDEX IF EXISTS idx_employee_status;
DROP INDEX IF EXISTS idx_employee_department;
DROP INDEX IF EXISTS idx_employee_name;
DROP INDEX IF EXISTS idx_standup_availability;
DROP INDEX IF EXISTS idx_standup_date;
DROP INDEX IF EXISTS idx_standup_employee_date;
DROP INDEX IF EXISTS idx_activity_confidence;
DROP INDEX IF EXISTS idx_activity_is_blocker;
DROP INDEX IF EXISTS idx_activity_requires_followup;
DROP INDEX IF EXISTS idx_activity_source;
DROP INDEX IF EXISTS idx_activity_date;
DROP INDEX IF EXISTS idx_activity_type;
DROP INDEX IF EXISTS idx_activity_employee_date;

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS daily_standup_log;
DROP TABLE IF EXISTS employee_activity_log;
DROP TABLE IF EXISTS employee_master;
