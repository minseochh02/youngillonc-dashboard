#!/usr/bin/env tsx
/**
 * Deploy Employee Activity Tracking Tables
 *
 * Creates the following tables:
 * 1. employee_activity_log - Track all employee activities from KakaoTalk
 * 2. daily_standup_log - Daily activity summaries
 * 3. employee_master - Employee reference data
 *
 * Usage:
 *   npx tsx scripts/deploy-activity-tables.ts
 */

import { createTable, executeSQL, insertRows } from '../egdesk-helpers';

/**
 * Create employee_activity_log table
 */
async function createActivityLogTable() {
  console.log('📋 Creating employee_activity_log table...');

  try {
    const result = await createTable(
      '직원활동로그',
      [
        // Source tracking
        { name: 'source_message_id', type: 'INTEGER' },
        { name: 'extracted_at', type: 'TEXT', defaultValue: 'CURRENT_TIMESTAMP' },

        // Employee info
        { name: 'employee_name', type: 'TEXT', notNull: true },
        { name: 'activity_date', type: 'DATE', notNull: true },

        // Activity categorization
        { name: 'activity_type', type: 'TEXT', notNull: true },
        // Options: 'customer_visit', 'product_discussion', 'work_completed',
        //          'sales_activity', 'issue_reported', 'planning', 'other'

        // Structured activity data
        { name: 'activity_summary', type: 'TEXT', notNull: true },
        { name: 'activity_details', type: 'TEXT' }, // JSON object

        // Customer/Location tracking
        { name: 'customer_name', type: 'TEXT' },
        { name: 'location', type: 'TEXT' },

        // Product tracking
        { name: 'products_mentioned', type: 'TEXT' }, // JSON array

        // Task tracking (optional)
        { name: 'task_status', type: 'TEXT' },
        // Options: 'completed', 'in_progress', 'planned', 'blocked'
        { name: 'task_priority', type: 'TEXT' },
        // Options: 'high', 'medium', 'low'

        // Time tracking (optional)
        { name: 'time_spent_hours', type: 'REAL' },
        { name: 'planned_completion_date', type: 'DATE' },

        // Context & relationships
        { name: 'related_project', type: 'TEXT' },
        { name: 'related_department', type: 'TEXT' },
        { name: 'mentioned_employees', type: 'TEXT' }, // JSON array

        // Flags
        { name: 'requires_followup', type: 'INTEGER', defaultValue: 0 }, // Boolean as 0/1
        { name: 'is_blocker', type: 'INTEGER', defaultValue: 0 }, // Boolean as 0/1
        { name: 'sentiment', type: 'TEXT' },
        // Options: 'positive', 'neutral', 'negative', 'urgent'

        // Next action
        { name: 'next_action', type: 'TEXT' },
        { name: 'next_action_date', type: 'DATE' },

        // AI metadata
        { name: 'confidence_score', type: 'REAL', defaultValue: 0.0 },
        { name: 'extraction_model', type: 'TEXT' }
      ],
      {
        tableName: 'employee_activity_log',
        description: 'Employee activities extracted from KakaoTalk messages - tracks customer visits, sales activities, work completed',
        uniqueKeyColumns: ['employee_name', 'activity_date', 'activity_summary'],
        duplicateAction: 'skip'
      }
    );
    console.log('✅ employee_activity_log created successfully');
    return result;
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('ℹ️  employee_activity_log already exists, skipping');
    } else {
      throw error;
    }
  }
}

/**
 * Create daily_standup_log table
 */
async function createStandupLogTable() {
  console.log('📋 Creating daily_standup_log table...');

  try {
    const result = await createTable(
      '일일업무요약',
      [
        // Employee and date
        { name: 'employee_name', type: 'TEXT', notNull: true },
        { name: 'report_date', type: 'DATE', notNull: true },

        // Standup content (stored as JSON)
        { name: 'completed_today', type: 'TEXT' },
        // Format: JSON array of {task, details, customer, time_spent}

        { name: 'planned_tasks', type: 'TEXT' },
        // Format: JSON array of {task, customer, deadline, priority}

        { name: 'blockers', type: 'TEXT' },
        // Format: JSON array of {issue, needs_help_from, severity}

        // Customers visited
        { name: 'customers_visited', type: 'TEXT' }, // JSON array of customer names

        // Products discussed
        { name: 'products_discussed', type: 'TEXT' }, // JSON array of product names

        // Availability
        { name: 'availability_status', type: 'TEXT', defaultValue: 'available' },
        // Options: 'available', 'partial', 'unavailable', 'vacation'
        { name: 'absence_reason', type: 'TEXT' },

        // Location
        { name: 'checkout_location', type: 'TEXT' }, // Where they checked out from
        { name: 'work_region', type: 'TEXT' }, // Region worked (e.g., 대산, 화성, etc.)

        // Additional notes
        { name: 'notes', type: 'TEXT' },

        // Metadata
        { name: 'source_messages', type: 'TEXT' }, // JSON array of message IDs
        { name: 'extracted_at', type: 'TEXT', defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'confidence_score', type: 'REAL', defaultValue: 0.0 }
      ],
      {
        tableName: 'daily_standup_log',
        description: 'Daily standup-style summary of employee work activities aggregated by date',
        uniqueKeyColumns: ['employee_name', 'report_date'],
        duplicateAction: 'update' // Update if re-processing the same date
      }
    );
    console.log('✅ daily_standup_log created successfully');
    return result;
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('ℹ️  daily_standup_log already exists, skipping');
    } else {
      throw error;
    }
  }
}

/**
 * Create employee_master table
 */
async function createEmployeeMasterTable() {
  console.log('📋 Creating employee_master table...');

  try {
    const result = await createTable(
      '직원마스터',
      [
        // Employee identification
        { name: 'employee_name', type: 'TEXT', notNull: true },
        { name: 'employee_name_variants', type: 'TEXT' }, // JSON array of alternative names

        // Contact info
        { name: 'phone_number', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },

        // Organization
        { name: 'department', type: 'TEXT' },
        { name: 'position', type: 'TEXT' },
        { name: 'team', type: 'TEXT' },
        { name: 'region', type: 'TEXT' }, // e.g., "경남&부산", "B2B"

        // Chat room membership
        { name: 'chat_rooms', type: 'TEXT' }, // JSON array of chat room names

        // Statistics
        { name: 'total_messages', type: 'INTEGER', defaultValue: 0 },
        { name: 'first_message_date', type: 'DATE' },
        { name: 'last_message_date', type: 'DATE' },

        // Status
        { name: 'employment_status', type: 'TEXT', defaultValue: 'active' },
        // Options: 'active', 'inactive', 'on_leave'
        { name: 'start_date', type: 'DATE' },

        // Metadata
        { name: 'created_at', type: 'TEXT', defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'TEXT', defaultValue: 'CURRENT_TIMESTAMP' }
      ],
      {
        tableName: 'employee_master',
        description: 'Master list of employees with contact and organizational information, populated from KakaoTalk data',
        uniqueKeyColumns: ['employee_name'],
        duplicateAction: 'update'
      }
    );
    console.log('✅ employee_master created successfully');
    return result;
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('ℹ️  employee_master already exists, skipping');
    } else {
      throw error;
    }
  }
}

/**
 * Seed employee_master table from KakaoTalk messages
 */
async function seedEmployeeMaster() {
  console.log('\n🌱 Seeding employee_master from KakaoTalk messages...');

  // Get employee statistics from messages
  const employeeStats = await executeSQL(`
    SELECT
      user_name as employee_name,
      COUNT(*) as total_messages,
      MIN(DATE(chat_date)) as first_message_date,
      MAX(DATE(chat_date)) as last_message_date,
      GROUP_CONCAT(DISTINCT chat_room) as chat_rooms
    FROM kakaotalk_raw_messages
    WHERE user_name != 'SYSTEM'
    GROUP BY user_name
    ORDER BY total_messages DESC
  `);

  if (!employeeStats || !employeeStats.rows || employeeStats.rows.length === 0) {
    console.log('⚠️  No employees found in KakaoTalk messages');
    return;
  }

  console.log(`📊 Found ${employeeStats.rows.length} employees`);

  // Prepare employee records
  const employees = employeeStats.rows.map((emp: any) => {
    // Determine region from chat room
    let region = 'Unknown';
    if (emp.chat_rooms?.includes('B2B')) {
      region = 'B2B영업팀';
    } else if (emp.chat_rooms?.includes('경남&부산')) {
      region = '경남&부산사업소';
    }

    // Parse chat rooms
    const chatRooms = emp.chat_rooms ? emp.chat_rooms.split(',') : [];

    return {
      employee_name: emp.employee_name,
      employee_name_variants: JSON.stringify([]), // Can be populated later
      region: region,
      chat_rooms: JSON.stringify(chatRooms),
      total_messages: emp.total_messages,
      first_message_date: emp.first_message_date,
      last_message_date: emp.last_message_date,
      employment_status: 'active',
      start_date: emp.first_message_date
    };
  });

  // Insert employees
  try {
    const result = await insertRows('employee_master', employees);
    console.log(`✅ Seeded ${employees.length} employees into employee_master`);

    // Show top 10
    console.log('\n👥 Top 10 employees by activity:');
    employees.slice(0, 10).forEach((emp: any, idx: number) => {
      console.log(`   ${(idx + 1).toString().padStart(2)}. ${emp.employee_name.padEnd(20)} - ${emp.total_messages} messages (${emp.region})`);
    });

    return result;
  } catch (error: any) {
    console.error('❌ Error seeding employee_master:', error.message);
    throw error;
  }
}

/**
 * Verify tables were created
 */
async function verifyTables() {
  console.log('\n🔍 Verifying tables...');

  const tables = ['employee_activity_log', 'daily_standup_log', 'employee_master'];

  for (const tableName of tables) {
    try {
      const result = await executeSQL(`SELECT COUNT(*) as count FROM ${tableName}`);
      const count = result?.rows?.[0]?.count || 0;
      console.log(`   ✅ ${tableName}: ${count} rows`);
    } catch (error) {
      console.log(`   ❌ ${tableName}: Error verifying`);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Deploying Employee Activity Tracking Tables\n');

  // Step 1: Create tables
  await createActivityLogTable();
  await createStandupLogTable();
  await createEmployeeMasterTable();

  // Step 2: Seed employee_master
  await seedEmployeeMaster();

  // Step 3: Verify
  await verifyTables();

  console.log('\n✅ Phase 2 deployment complete!');
  console.log('\n📝 Next steps:');
  console.log('   - Phase 3: Extract activities from messages using Gemini AI');
  console.log('   - Phase 4: Link activities to sales data');
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
