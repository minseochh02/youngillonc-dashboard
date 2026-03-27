import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

interface PlannedTask {
  id: number;
  employee_name: string;
  message_date: string; // When they made the plan
  next_action: string;
  next_action_date: string; // When they plan to do it
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
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  const startDate = searchParams.get('startDate') || firstDayOfMonth;
  const endDate = searchParams.get('endDate') || today;

  try {
    // Get all planned tasks (activity_type = 'planned_task')
    // Join with kakaotalk_raw_messages to get the original message and when it was sent
    let plannedQuery = `
      SELECT
        eal.id,
        eal.employee_name,
        krm.chat_date as message_date,
        krm.message as next_action,
        eal.activity_label,
        eal.activity_date as next_action_date,
        eal.customer as customer_name,
        eal.confidence_score
      FROM employee_activity_log eal
      JOIN kakaotalk_raw_messages krm ON eal.source_message_id = krm.id
      WHERE eal.activity_type = 'planned_task'
        AND eal.confidence_score >= 0.7
        AND eal.activity_date >= '${startDate}'
        AND eal.activity_date <= '${endDate}'
    `;

    if (employeeFilter) {
      plannedQuery += ` AND eal.employee_name = '${employeeFilter}'`;
    }

    if (customerFilter) {
      plannedQuery += ` AND eal.customer LIKE '%${customerFilter}%'`;
    }

    plannedQuery += ' ORDER BY eal.activity_date DESC, eal.employee_name';

    const plannedResult = await executeSQL(plannedQuery);
    const plannedTasks: PlannedTask[] = plannedResult?.rows || [];

    // Get all actual completed activities
    // Join with kakaotalk_raw_messages to get the original message
    const actualQuery = `
      SELECT
        eal.id,
        eal.employee_name,
        eal.activity_date,
        eal.activity_type,
        krm.message as activity_summary,
        eal.activity_label,
        eal.customer as customer_name,
        eal.confidence_score
      FROM employee_activity_log eal
      JOIN kakaotalk_raw_messages krm ON eal.source_message_id = krm.id
      WHERE eal.activity_type = 'completed_task'
        AND eal.confidence_score >= 0.7
        AND eal.activity_date >= '${startDate}'
        AND eal.activity_date <= '${endDate}'
      ORDER BY eal.activity_date, eal.employee_name
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

    // 1. Get all employees from activity log
    const employeesResult = await executeSQL(`
      SELECT DISTINCT employee_name
      FROM employee_activity_log
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
      SELECT DISTINCT customer as customer_name
      FROM employee_activity_log
      WHERE customer IS NOT NULL
        AND customer != ''
      ORDER BY customer
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
