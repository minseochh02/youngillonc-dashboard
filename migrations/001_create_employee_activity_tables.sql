-- Migration: Create employee activity tracking tables
-- Created: 2026-03-11
-- Description: Creates tables for tracking employee activities extracted from KakaoTalk messages

-- ============================================================================
-- Main Activity Log Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_activity_log (
  id SERIAL PRIMARY KEY,

  -- Source tracking
  source_message_id INTEGER REFERENCES kakaotalk_egdesk_pm(id),
  extracted_at TIMESTAMP DEFAULT NOW(),

  -- Employee info
  employee_name VARCHAR(100) NOT NULL,
  activity_date DATE NOT NULL,

  -- Activity categorization
  activity_type VARCHAR(50) NOT NULL,
  -- Options: 'task_completed', 'task_planned', 'meeting_attendance',
  --          'issue_reported', 'update_shared', 'question_asked', 'other'

  -- Structured activity data
  activity_summary TEXT NOT NULL,
  activity_details JSONB DEFAULT '{}',

  -- Task tracking (optional fields)
  task_status VARCHAR(20),
  -- Options: 'completed', 'in_progress', 'planned', 'blocked'
  task_priority VARCHAR(10),
  -- Options: 'high', 'medium', 'low'

  -- Time tracking (optional)
  time_spent_hours DECIMAL(5,2),
  planned_completion_date DATE,

  -- Context & relationships
  related_project VARCHAR(100),
  related_department VARCHAR(100),
  mentioned_employees TEXT[],

  -- Sentiment & flags
  requires_followup BOOLEAN DEFAULT FALSE,
  is_blocker BOOLEAN DEFAULT FALSE,
  sentiment VARCHAR(20),
  -- Options: 'positive', 'neutral', 'negative', 'urgent'

  -- AI metadata
  confidence_score DECIMAL(3,2) DEFAULT 0.00,
  extraction_model VARCHAR(50),

  -- Constraints
  CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT valid_activity_type CHECK (activity_type IN (
    'task_completed', 'task_planned', 'meeting_attendance',
    'issue_reported', 'update_shared', 'question_asked', 'other'
  )),
  CONSTRAINT valid_task_status CHECK (task_status IS NULL OR task_status IN (
    'completed', 'in_progress', 'planned', 'blocked'
  )),
  CONSTRAINT valid_task_priority CHECK (task_priority IS NULL OR task_priority IN (
    'high', 'medium', 'low'
  )),
  CONSTRAINT valid_sentiment CHECK (sentiment IS NULL OR sentiment IN (
    'positive', 'neutral', 'negative', 'urgent'
  ))
);

-- ============================================================================
-- Daily Standup Log Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_standup_log (
  id SERIAL PRIMARY KEY,

  -- Employee and date
  employee_name VARCHAR(100) NOT NULL,
  report_date DATE NOT NULL,

  -- Standup content
  completed_today JSONB DEFAULT '[]',
  -- Format: [{"task": "...", "details": "...", "time_spent": 2.5}]

  planned_tasks JSONB DEFAULT '[]',
  -- Format: [{"task": "...", "deadline": "2026-03-15", "priority": "high"}]

  blockers JSONB DEFAULT '[]',
  -- Format: [{"issue": "...", "needs_help_from": "...", "severity": "high"}]

  -- Availability
  availability_status VARCHAR(20) DEFAULT 'available',
  -- Options: 'available', 'partial', 'unavailable', 'unknown'
  absence_reason TEXT,

  -- Additional notes
  notes TEXT,

  -- Metadata
  source_messages INTEGER[],
  extracted_at TIMESTAMP DEFAULT NOW(),
  confidence_score DECIMAL(3,2) DEFAULT 0.00,

  -- Unique constraint: one standup per employee per day
  CONSTRAINT unique_employee_date UNIQUE (employee_name, report_date),
  CONSTRAINT valid_availability CHECK (availability_status IN (
    'available', 'partial', 'unavailable', 'unknown'
  )),
  CONSTRAINT valid_standup_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

-- ============================================================================
-- Employee Master Table (for normalization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_master (
  id SERIAL PRIMARY KEY,

  -- Employee identification
  employee_name VARCHAR(100) NOT NULL UNIQUE,
  employee_name_variants TEXT[], -- Alternative names/spellings

  -- Contact info
  phone_number VARCHAR(20),
  email VARCHAR(100),

  -- Organization
  department VARCHAR(100),
  position VARCHAR(100),
  team VARCHAR(100),

  -- Status
  employment_status VARCHAR(20) DEFAULT 'active',
  -- Options: 'active', 'inactive', 'on_leave'
  start_date DATE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_employment_status CHECK (employment_status IN (
    'active', 'inactive', 'on_leave'
  ))
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Activity log indexes
CREATE INDEX idx_activity_employee_date ON employee_activity_log(employee_name, activity_date DESC);
CREATE INDEX idx_activity_type ON employee_activity_log(activity_type);
CREATE INDEX idx_activity_date ON employee_activity_log(activity_date DESC);
CREATE INDEX idx_activity_source ON employee_activity_log(source_message_id);
CREATE INDEX idx_activity_requires_followup ON employee_activity_log(requires_followup) WHERE requires_followup = TRUE;
CREATE INDEX idx_activity_is_blocker ON employee_activity_log(is_blocker) WHERE is_blocker = TRUE;
CREATE INDEX idx_activity_confidence ON employee_activity_log(confidence_score);

-- Daily standup indexes
CREATE INDEX idx_standup_employee_date ON daily_standup_log(employee_name, report_date DESC);
CREATE INDEX idx_standup_date ON daily_standup_log(report_date DESC);
CREATE INDEX idx_standup_availability ON daily_standup_log(availability_status);

-- Employee master indexes
CREATE INDEX idx_employee_name ON employee_master(employee_name);
CREATE INDEX idx_employee_department ON employee_master(department);
CREATE INDEX idx_employee_status ON employee_master(employment_status);

-- ============================================================================
-- Useful Views
-- ============================================================================

-- View: Recent activity summary by employee
CREATE OR REPLACE VIEW v_employee_recent_activity AS
SELECT
  employee_name,
  activity_date,
  COUNT(*) as activity_count,
  COUNT(*) FILTER (WHERE activity_type = 'task_completed') as tasks_completed,
  COUNT(*) FILTER (WHERE activity_type = 'task_planned') as tasks_planned,
  COUNT(*) FILTER (WHERE is_blocker = TRUE) as blockers,
  COUNT(*) FILTER (WHERE requires_followup = TRUE) as followups_needed,
  MAX(extracted_at) as last_updated
FROM employee_activity_log
WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY employee_name, activity_date
ORDER BY activity_date DESC, employee_name;

-- View: Weekly standup summary
CREATE OR REPLACE VIEW v_weekly_standup_summary AS
SELECT
  employee_name,
  DATE_TRUNC('week', report_date) as week_start,
  COUNT(*) as days_reported,
  SUM(CASE WHEN availability_status = 'available' THEN 1 ELSE 0 END) as days_available,
  SUM(CASE WHEN availability_status = 'unavailable' THEN 1 ELSE 0 END) as days_absent,
  JSONB_AGG(completed_today) as all_completed_tasks,
  JSONB_AGG(blockers) as all_blockers
FROM daily_standup_log
WHERE report_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY employee_name, DATE_TRUNC('week', report_date)
ORDER BY week_start DESC, employee_name;

-- View: Current blockers and followups
CREATE OR REPLACE VIEW v_current_blockers_followups AS
SELECT
  employee_name,
  activity_date,
  activity_type,
  activity_summary,
  CASE
    WHEN is_blocker THEN 'blocker'
    WHEN requires_followup THEN 'followup'
    ELSE 'other'
  END as flag_type,
  activity_details,
  extracted_at
FROM employee_activity_log
WHERE (is_blocker = TRUE OR requires_followup = TRUE)
  AND activity_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY activity_date DESC, employee_name;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Update employee_master.updated_at automatically
CREATE OR REPLACE FUNCTION update_employee_master_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_employee_master_timestamp
BEFORE UPDATE ON employee_master
FOR EACH ROW
EXECUTE FUNCTION update_employee_master_timestamp();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE employee_activity_log IS 'Main table for tracking all employee activities extracted from KakaoTalk messages';
COMMENT ON TABLE daily_standup_log IS 'Daily standup-style summary of employee work, aggregated by date';
COMMENT ON TABLE employee_master IS 'Master list of employees with contact and organizational information';

COMMENT ON COLUMN employee_activity_log.activity_details IS 'Flexible JSONB field for activity-specific data structure';
COMMENT ON COLUMN employee_activity_log.confidence_score IS 'AI extraction confidence from 0.00 to 1.00';
COMMENT ON COLUMN daily_standup_log.completed_today IS 'Array of tasks completed today';
COMMENT ON COLUMN daily_standup_log.planned_tasks IS 'Array of tasks planned for future';
COMMENT ON COLUMN daily_standup_log.blockers IS 'Array of issues blocking progress';
