import { executeSQL } from '../egdesk-helpers';

// Target tables with display names
const TARGET_TABLES = [
  { name: 'west_division_sales', displayName: '서부판매현황' },
  { name: 'east_division_sales', displayName: '동부판매현황' },
  { name: 'purchases', displayName: '구매현황' },
  { name: 'sales', displayName: '판매현황' }
];

interface TableReport {
  tableName: string;
  displayName: string;
  minDate: string | null;
  maxDate: string | null;
  totalMonths: number;
  monthsWithData: number;
  missingMonths: string[];
  hasData: boolean;
}

/**
 * Generate all months between start and end dates (inclusive)
 */
function generateMonthRange(startDate: string, endDate: string): string[] {
  const months: string[] = [];

  // Parse YYYY-MM-DD format
  const [startYear, startMonth] = startDate.split('-').map(Number);
  const [endYear, endMonth] = endDate.split('-').map(Number);

  let currentYear = startYear;
  let currentMonth = startMonth;

  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    const yearStr = currentYear.toString();
    const monthStr = currentMonth.toString().padStart(2, '0');
    months.push(`${yearStr}-${monthStr}`);

    // Move to next month
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return months;
}

/**
 * Check missing months for a single table
 */
async function checkTableMissingMonths(
  tableName: string,
  displayName: string
): Promise<TableReport> {
  // Query min/max dates
  const dateRangeResult = await executeSQL(`
    SELECT
      MIN(일자) as min_date,
      MAX(일자) as max_date
    FROM ${tableName}
    WHERE 일자 IS NOT NULL
  `);

  const minDate = dateRangeResult.rows[0]?.min_date;
  const maxDate = dateRangeResult.rows[0]?.max_date;

  // Handle empty table or no data
  if (!minDate || !maxDate) {
    return {
      tableName,
      displayName,
      minDate: null,
      maxDate: null,
      totalMonths: 0,
      monthsWithData: 0,
      missingMonths: [],
      hasData: false
    };
  }

  // Generate expected months
  const expectedMonths = generateMonthRange(minDate, maxDate);

  // Query actual unique months from table
  const actualMonthsResult = await executeSQL(`
    SELECT DISTINCT strftime('%Y-%m', 일자) as month
    FROM ${tableName}
    WHERE 일자 IS NOT NULL
    ORDER BY month
  `);

  const actualMonths = new Set(
    actualMonthsResult.rows.map((row: any) => row.month).filter(Boolean)
  );

  // Calculate missing months
  const missingMonths = expectedMonths.filter(month => !actualMonths.has(month));

  return {
    tableName,
    displayName,
    minDate,
    maxDate,
    totalMonths: expectedMonths.length,
    monthsWithData: actualMonths.size,
    missingMonths,
    hasData: true
  };
}

/**
 * Print individual table report
 */
function printTableReport(report: TableReport) {
  console.log(`${report.displayName} (${report.tableName})`);

  if (!report.hasData) {
    console.log('  ⚠️  No data in table\n');
    return;
  }

  console.log(`  📅 Date Range: ${report.minDate} to ${report.maxDate}`);
  console.log(`  📊 Total Months in Range: ${report.totalMonths}`);
  console.log(`  ✅ Months with Data: ${report.monthsWithData}`);

  if (report.missingMonths.length > 0) {
    console.log(`  ❌ Missing Months: ${report.missingMonths.length}`);
    report.missingMonths.forEach(month => {
      console.log(`     - ${month}`);
    });
  } else {
    console.log('  ✅ No missing months!');
  }

  console.log('');
}

/**
 * Print summary statistics
 */
function printSummary(reports: TableReport[]) {
  console.log('============================================================');
  console.log('📈 Summary');
  console.log('============================================================');

  const tablesWithData = reports.filter(r => r.hasData);
  const tablesWithMissingMonths = reports.filter(r => r.missingMonths.length > 0);
  const totalMissingMonths = reports.reduce((sum, r) => sum + r.missingMonths.length, 0);

  console.log(`  Total Tables Checked: ${reports.length}`);
  console.log(`  Tables with Data: ${tablesWithData.length}`);
  console.log(`  Tables with Missing Months: ${tablesWithMissingMonths.length}`);
  console.log(`  Total Missing Months: ${totalMissingMonths}`);
  console.log('');
}

/**
 * Main function
 */
async function main() {
  console.log('📊 Sales & Purchase Tables - Missing Months Report');
  console.log('============================================================\n');

  const reports: TableReport[] = [];

  for (const table of TARGET_TABLES) {
    try {
      const report = await checkTableMissingMonths(table.name, table.displayName);
      reports.push(report);
      printTableReport(report);
    } catch (error) {
      console.error(`❌ Error checking ${table.displayName}:`, error instanceof Error ? error.message : String(error));
      console.log('');
    }
  }

  printSummary(reports);

  console.log('✨ Report complete!\n');
}

// Execute main function
main().catch(error => {
  console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
