import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

interface PlannedTask {
  id: number;
  employee_name: string;
  activity_date: string;
  next_action: string;
  next_action_date: string;
  customer_name?: string;
  confidence_score: number;
}

interface ActualActivity {
  id: number;
  employee_name: string;
  activity_date: string;
  activity_type: string;
  activity_summary: string;
  customer_name?: string;
  confidence_score: number;
}

interface FollowUpMatch {
  planned: PlannedTask;
  actual: ActualActivity | null;
  status: 'completed' | 'missed' | 'future';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const employeeFilter = searchParams.get('employee');
  const customerFilter = searchParams.get('customer');
  const startDate = searchParams.get('startDate') || '2024-01-01';
  const endDate = searchParams.get('endDate') || '2026-12-31';

  try {
    // Get all planned tasks (exclude noise: "other" type, low confidence)
    let plannedQuery = `
      SELECT
        id,
        employee_name,
        activity_date,
        next_action,
        next_action_date,
        customer_name,
        confidence_score
      FROM employee_activity_log
      WHERE next_action IS NOT NULL
        AND next_action_date IS NOT NULL
        AND activity_type != 'other'
        AND confidence_score >= 0.7
        AND activity_date >= '${startDate}'
        AND activity_date <= '${endDate}'
    `;

    if (employeeFilter) {
      plannedQuery += ` AND employee_name = '${employeeFilter}'`;
    }

    if (customerFilter) {
      plannedQuery += ` AND customer_name LIKE '%${customerFilter}%'`;
    }

    plannedQuery += ' ORDER BY activity_date DESC, employee_name';

    const plannedResult = await executeSQL(plannedQuery);
    const plannedTasks: PlannedTask[] = plannedResult?.rows || [];

    // Get all actual activities (exclude noise)
    const actualQuery = `
      SELECT
        id,
        employee_name,
        activity_date,
        activity_type,
        activity_summary,
        customer_name,
        confidence_score
      FROM employee_activity_log
      WHERE activity_type IN ('customer_visit', 'sales_activity', 'work_completed', 'product_discussion')
        AND confidence_score >= 0.7
        AND activity_date >= '${startDate}'
        AND activity_date <= '${endDate}'
      ORDER BY activity_date, employee_name
    `;

    const actualResult = await executeSQL(actualQuery);
    const actualActivities: ActualActivity[] = actualResult?.rows || [];

    // Match planned tasks with actual activities
    const matches: FollowUpMatch[] = plannedTasks.map(planned => {
      const today = new Date().toISOString().split('T')[0];

      // Check if it's a future task
      if (planned.next_action_date > today) {
        return {
          planned,
          actual: null,
          status: 'future' as const
        };
      }

      // Find matching activity on the planned date
      const matchingActivity = actualActivities.find(actual => {
        // Must be same employee and same date
        if (actual.employee_name !== planned.employee_name) return false;
        if (actual.activity_date !== planned.next_action_date) return false;

        // If planned task has a customer, check if actual activity mentions it
        if (planned.customer_name) {
          // Check if customer name appears in the actual activity
          if (actual.customer_name && actual.customer_name.includes(planned.customer_name)) {
            return true;
          }
          // Also check in the summary
          if (actual.activity_summary && actual.activity_summary.includes(planned.customer_name)) {
            return true;
          }
          return false;
        }

        // If no specific customer in plan, any activity on that date counts
        return true;
      });

      return {
        planned,
        actual: matchingActivity || null,
        status: matchingActivity ? 'completed' as const : 'missed' as const
      };
    });

    // 1. Get all active employees as base
    const employeesResult = await executeSQL(`
      SELECT employee_name, department, position, team 
      FROM employee_master 
      WHERE employment_status = 'active'
      ORDER BY employee_name
    `);
    const allEmployees = employeesResult?.rows || [];

    // Calculate statistics
    const stats = {
      total: matches.length,
      completed: matches.filter(m => m.status === 'completed').length,
      missed: matches.filter(m => m.status === 'missed').length,
      future: matches.filter(m => m.status === 'future').length,
      followUpRate: matches.filter(m => m.status !== 'future').length > 0
        ? (matches.filter(m => m.status === 'completed').length / matches.filter(m => m.status !== 'future').length * 100).toFixed(1)
        : '0.0'
    };

    // Calculate per-employee stats
    const employeeStatsMap: Record<string, any> = {};
    matches.forEach(match => {
      if (!employeeStatsMap[match.planned.employee_name]) {
        employeeStatsMap[match.planned.employee_name] = {
          total: 0,
          completed: 0,
          missed: 0,
          future: 0
        };
      }
      employeeStatsMap[match.planned.employee_name].total++;
      employeeStatsMap[match.planned.employee_name][match.status]++;
    });

    // Merge all employees with their stats
    const employeeStatsArray = allEmployees.map((emp: any) => {
      const s = employeeStatsMap[emp.employee_name] || { total: 0, completed: 0, missed: 0, future: 0 };
      const actionable = s.total - s.future;
      return {
        employee_name: emp.employee_name,
        department: emp.department,
        total: s.total,
        completed: s.completed,
        missed: s.missed,
        future: s.future,
        followUpRate: actionable > 0 ? (s.completed / actionable * 100).toFixed(1) : '0.0'
      };
    }).sort((a: any, b: any) => a.employee_name.localeCompare(b.employee_name, 'ko-KR'));

    // Get unique employees and customers for filters
    const uniqueEmployees = allEmployees.map((e: any) => e.employee_name);


    const uniqueCustomers = await executeSQL(`
      SELECT DISTINCT customer_name
      FROM employee_activity_log
      WHERE customer_name IS NOT NULL
        AND customer_name != ''
      ORDER BY customer_name
    `);

    return NextResponse.json({
      success: true,
      data: {
        matches,
        stats,
        employeeStats: employeeStatsArray,
        filters: {
          employees: uniqueEmployees,
          customers: uniqueCustomers?.rows?.map((r: any) => r.customer_name) || []
        }
      }
    });
  } catch (error: any) {
    console.error('Error in follow-up tracker:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to load follow-up data'
    }, { status: 500 });
  }
}
