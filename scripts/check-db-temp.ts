#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';

async function main() {
  const result = await executeSQL(`
    SELECT employee_name, activity_summary, customer_name, activity_date
    FROM employee_activity_log
    WHERE employee_name = '김건우'
      AND activity_date BETWEEN '2024-03-08' AND '2024-03-11'
    ORDER BY activity_date, id
  `);
  
  console.log(JSON.stringify(result.rows, null, 2));
}

main();
