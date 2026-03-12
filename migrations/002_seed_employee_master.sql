-- Migration: Seed employee_master table with users from kakaotalk_egdesk_pm
-- Created: 2026-03-11
-- Description: Populates employee_master with unique employees from KakaoTalk messages

INSERT INTO employee_master (employee_name, employee_name_variants, employment_status)
SELECT DISTINCT
  user_name as employee_name,
  ARRAY[user_name] as employee_name_variants,
  'active' as employment_status
FROM kakaotalk_egdesk_pm
WHERE user_name IS NOT NULL
  AND user_name != ''
  AND user_name != '🌈' -- Exclude emoji-only names
ON CONFLICT (employee_name) DO NOTHING;

-- Update specific employees with known information
-- (Customize this section based on your actual employee data)

-- Example: Update phone numbers extracted from usernames
UPDATE employee_master
SET phone_number = '010-4702-9008'
WHERE employee_name = '김주희 010-4702-9008';

-- Clean up employee name for this specific case
UPDATE employee_master
SET
  employee_name = '김주희',
  employee_name_variants = ARRAY['김주희', '김주희 010-4702-9008']
WHERE employee_name = '김주희 010-4702-9008';

-- Add notes about special cases
COMMENT ON TABLE employee_master IS 'Employee master data. Some names may need manual cleanup (e.g., phone numbers in names, emoji names).';
