/**
 * Standalone Data Refresh Script for yeongilsales.spec.js
 *
 * Replicates the exact logic of the "데이터 새로고침" (Data Refresh) button
 * from src/app/dashboard/(main)/data-management/page.tsx, but runs ONLY
 * yeongilsales.spec.js.
 *
 * Usage:
 *   npx tsx scripts/run-yeongilsales-refresh.ts
 *   npx tsx scripts/run-yeongilsales-refresh.ts --year=2026 --month=8
 *   npx tsx scripts/run-yeongilsales-refresh.ts --start=2026-08-01 --end=2026-08-30
 *   npx tsx scripts/run-yeongilsales-refresh.ts --headless
 *   npx tsx scripts/run-yeongilsales-refresh.ts --skip-inventory-rebuild
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import {
  getBrowserRecordingReplayOptions,
  runBrowserRecording,
  type BrowserRecordingRunOptions
} from '../egdesk-helpers';
import {
  rebuildComputedInventoryMonthly,
  rebuildComputedInventoryDaily
} from '../src/lib/computed-inventory-utils';

function toPickerDate(date: string): string {
  return date.replace(/-/g, '/');
}

function parseArgs() {
  const argv = process.argv.slice(2);

  const getArg = (prefix: string) => {
    const match = argv.find((a) => a.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
  };

  const now = new Date();
  const yearArg = getArg('--year=');
  const monthArg = getArg('--month=');
  const startArg = getArg('--start=');
  const endArg = getArg('--end=');
  const isHeadless = argv.includes('--headless');
  const skipRebuild = argv.includes('--skip-inventory-rebuild');

  let startDate: string;
  let endDate: string;
  let selectedYear: number;
  let selectedMonth: number;

  if (startArg && endArg) {
    startDate = startArg;
    endDate = endArg;
    const [y, m] = startArg.split('-');
    selectedYear = parseInt(y, 10);
    selectedMonth = parseInt(m, 10);
  } else {
    selectedYear = yearArg ? parseInt(yearArg, 10) : now.getFullYear();
    selectedMonth = monthArg ? parseInt(monthArg, 10) : now.getMonth() + 1;

    // UI Data Refresh button calculation logic:
    const monthIndex = selectedMonth - 1;
    startDate = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    if (selectedMonth === 8) {
      endDate = `${selectedYear}-09-01`;
    } else {
      const lastDay = new Date(selectedYear, monthIndex + 1, 0).getDate();
      endDate = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  return {
    testFile: 'yeongilsales.spec.js',
    selectedYear,
    selectedMonth,
    startDate,
    endDate,
    headless: isHeadless,
    skipRebuild
  };
}

async function main() {
  const { testFile, selectedYear, selectedMonth, startDate, endDate, headless, skipRebuild } = parseArgs();

  console.log('========================================');
  console.log(' [Data Refresh: Standalone yeongilsales]');
  console.log('========================================');
  console.log(` Target Script: ${testFile}`);
  console.log(` Period       : ${startDate} ~ ${endDate} (${selectedYear}년 ${selectedMonth}월)`);
  console.log(` Mode         : ${headless ? 'Headless (Background)' : 'Headed (Visible Chrome Window)'}`);
  console.log('----------------------------------------');

  // Step 1: Check replay options (same as route.ts buildRunOptions)
  console.log(`\n[1/3] Inspecting script replay options for ${testFile}...`);
  const replayOpts = await getBrowserRecordingReplayOptions(testFile);
  const ui = replayOpts?.ui ?? 'none';
  console.log(`  UI Type: ${ui}`);

  const runOptions: BrowserRecordingRunOptions = {
    headless
  };

  if (ui === 'dateRange' && startDate && endDate) {
    runOptions.startDate = toPickerDate(startDate);
    runOptions.endDate = toPickerDate(endDate);
  } else if (ui === 'singleDate' && (endDate || startDate)) {
    runOptions.startDate = toPickerDate(endDate ?? startDate);
  }

  console.log('  Replay Run Options:', JSON.stringify(runOptions, null, 2));

  // Step 2: Run browser recording replay
  console.log(`\n[2/3] Launching recording replay in Chrome...`);
  const startTime = Date.now();
  const result = await runBrowserRecording(testFile, runOptions);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`  Completed in ${elapsed}s`);
  console.log('  Result:', JSON.stringify(result, null, 2));

  if (!result || result.success === false) {
    throw new Error(result?.error || 'Script execution failed');
  }

  // Step 3: Trigger computed inventory rebuild (same as page.tsx)
  if (skipRebuild) {
    console.log('\n[3/3] Skipping inventory rebuild (--skip-inventory-rebuild passed)');
  } else {
    const fromMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    console.log(`\n[3/3] Rebuilding computed inventory from ${fromMonth}...`);
    try {
      const monthlyResult = await rebuildComputedInventoryMonthly(fromMonth);
      console.log('  Monthly Rebuild Result:', monthlyResult);
      const dailyResult = await rebuildComputedInventoryDaily();
      console.log('  Daily Rebuild Result:', dailyResult);
    } catch (rebuildErr) {
      console.warn('  Warning: Inventory rebuild failed:', rebuildErr);
    }
  }

  console.log('\n========================================');
  console.log(' Data Refresh completed successfully!');
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('\n❌ Execution Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
