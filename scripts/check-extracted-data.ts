#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';

async function main() {
  const result = await executeSQL(`
    SELECT
      employee_name,
      report_date,
      completed_today,
      planned_tasks,
      blockers,
      customers_visited,
      products_discussed
    FROM daily_standup_log
    WHERE report_date BETWEEN '2024-02-05' AND '2024-02-11'
    ORDER BY report_date, employee_name
  `);

  console.log(JSON.stringify(result.rows, null, 2));
}

main();
