
import { executeSQL, deleteRows, updateRows } from './egdesk-helpers';

async function main() {
  try {
    console.log('--- Starting Ledger Data Cleanup and Fix ---');

    // 1. Identify Metadata Rows for Deletion
    console.log('Identifying metadata rows to delete...');
    const metadataQuery = `
      SELECT id FROM ledger 
      WHERE (일자 LIKE '%회사명%' OR 일자 LIKE '%~%' OR 일자 LIKE '%오전%' OR 일자 LIKE '%오후%')
      AND 일자 NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    `;
    const metadataResult = await executeSQL(metadataQuery);
    const idsToDelete = metadataResult.rows.map((r: any) => r.id);

    if (idsToDelete.length > 0) {
      console.log(`Deleting ${idsToDelete.length} metadata rows...`);
      // Delete in chunks of 500 to be safe
      for (let i = 0; i < idsToDelete.length; i += 500) {
        const chunk = idsToDelete.slice(i, i + 500);
        await deleteRows('ledger', { ids: chunk });
      }
      console.log('Deletion completed.');
    } else {
      console.log('No metadata rows found for deletion.');
    }

    // 2. Identify Rows with Wrong Date Format (YYYY/MM/DD)
    console.log('\nIdentifying rows with YYYY/MM/DD format...');
    const wrongFormatQuery = `
      SELECT id, 일자 FROM ledger 
      WHERE 일자 LIKE '%/%/%' 
      AND 일자 NOT LIKE '%오전%' 
      AND 일자 NOT LIKE '%오후%'
      AND 일자 NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    `;
    const wrongFormatResult = await executeSQL(wrongFormatQuery);
    const rowsToFix = wrongFormatResult.rows;

    if (rowsToFix.length > 0) {
      console.log(`Fixing ${rowsToFix.length} rows with wrong date format...`);
      
      // Group by original date string to minimize update calls
      const dateGroups: Record<string, number[]> = {};
      rowsToFix.forEach((row: any) => {
        if (!dateGroups[row.일자]) dateGroups[row.일자] = [];
        dateGroups[row.일자].push(row.id);
      });

      const dates = Object.keys(dateGroups);
      for (const oldDate of dates) {
        const newDate = oldDate.replace(/\//g, '-');
        const ids = dateGroups[oldDate];
        
        // Update in chunks of 500 for each date group
        for (let i = 0; i < ids.length; i += 500) {
          const chunk = ids.slice(i, i + 500);
          await updateRows('ledger', { 일자: newDate }, { ids: chunk });
        }
      }
      console.log('Date format fix completed.');
    } else {
      console.log('No rows with YYYY/MM/DD format found.');
    }

    console.log('\n--- Cleanup and Fix Finished Successfully ---');

    // Final verification
    const finalCheck = await executeSQL(`
      SELECT COUNT(*) as remainingInvalid FROM ledger 
      WHERE 일자 NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      AND 일자 IS NOT NULL
    `);
    console.log(`Remaining non-standard date rows: ${finalCheck.rows[0].remainingInvalid}`);

  } catch (error) {
    console.error('An error occurred during cleanup:', error);
  }
}

main();
