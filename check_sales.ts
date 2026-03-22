import { executeSQL } from './egdesk-helpers';

async function run() {
  try {
    const result = await executeSQL('SELECT 중량, 담당자코드, 품목코드 FROM sales LIMIT 5');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error);
  }
}

run();
