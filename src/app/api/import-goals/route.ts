import { NextRequest, NextResponse } from 'next/server';
import { insertRows, deleteRows } from '@/egdesk-helpers';

interface ParsedGoal {
  year: string;
  month: string;
  goal_type: string;
  target_name: string;
  target_weight: number;
  target_amount: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, sheetsData } = body;

    if (!year || !sheetsData || !Array.isArray(sheetsData)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: year, sheetsData' },
        { status: 400 }
      );
    }

    // Find the three required sheets
    const b2bSheet = sheetsData.find((s: any) => s.sheetName === 'B2B사업계획');
    const b2cWeightSheet = sheetsData.find((s: any) => s.sheetName === 'B2C사업계획(중량)');
    const b2cAmountSheet = sheetsData.find((s: any) => s.sheetName === 'B2C사업계획(금액)');

    if (!b2bSheet || !b2cWeightSheet || !b2cAmountSheet) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required sheets. Found: ${sheetsData.map((s: any) => s.sheetName).join(', ')}. Required: B2B사업계획, B2C사업계획(중량), B2C사업계획(금액)`
        },
        { status: 400 }
      );
    }

    console.log('Starting business plan import for year:', year);

    // Parse each sheet
    const b2bGoals = parseB2BSheet(b2bSheet.data, year);
    const b2cWeights = parseB2CWeightSheet(b2cWeightSheet.data);
    const b2cAmounts = parseB2CAmountSheet(b2cAmountSheet.data);
    const b2cGoals = combineB2CData(b2cWeights, b2cAmounts, year);

    console.log(`Parsed ${b2bGoals.length} B2B goals`);
    console.log(`Parsed ${b2cGoals.length} B2C goals`);

    // Combine all goals
    const allGoals = [...b2bGoals, ...b2cGoals];

    if (allGoals.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid goals parsed from Excel file' },
        { status: 400 }
      );
    }

    // Delete existing goals for this year (overwrite mode)
    console.log(`Deleting existing goals for year ${year}...`);
    await deleteRows('sales_goals', {
      filters: {
        year: year.toString()
      }
    });

    // Insert goals in batches
    const BATCH_SIZE = 100;
    let insertedCount = 0;

    for (let i = 0; i < allGoals.length; i += BATCH_SIZE) {
      const batch = allGoals.slice(i, i + BATCH_SIZE);
      await insertRows('sales_goals', batch);
      insertedCount += batch.length;
      console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allGoals.length / BATCH_SIZE)}`);
    }

    // Collect unique team names
    const b2bTeams = Array.from(new Set(b2bGoals.map(g => g.target_name)));
    const b2cTeams = Array.from(new Set(b2cGoals.map(g => g.target_name)));

    console.log(`Successfully imported ${insertedCount} goals`);

    return NextResponse.json({
      success: true,
      importedCount: insertedCount,
      breakdown: {
        b2b_il: b2bGoals.length,
        b2c_auto: b2cGoals.length
      },
      teams: {
        b2b: b2bTeams,
        b2c: b2cTeams
      }
    });

  } catch (error: any) {
    console.error('Import goals error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Import failed',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}

/**
 * Parse B2B사업계획 sheet
 * Columns: 사업소, IL팀, IL담당, 산업분류, sector, 2026년1월...2026년12월
 * Aggregate by IL팀 (column[1])
 */
function parseB2BSheet(data: any[][], year: string): ParsedGoal[] {
  const goals: ParsedGoal[] = [];

  // Skip header row (index 0), start from row 1
  const teamMonthlyTotals = new Map<string, number[]>();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 17) continue; // Need at least columns 0-16

    const teamName = row[1]; // IL팀
    if (!teamName || teamName === '') continue;

    if (!teamMonthlyTotals.has(teamName)) {
      teamMonthlyTotals.set(teamName, new Array(12).fill(0));
    }

    const monthlyTotals = teamMonthlyTotals.get(teamName)!;

    // Columns 5-16 are monthly values (Jan-Dec)
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const value = row[5 + monthIdx];
      const numValue = parseNumeric(value);
      monthlyTotals[monthIdx] += numValue;
    }
  }

  // Convert to goals (one per team per month)
  for (const [teamName, monthlyTotals] of teamMonthlyTotals.entries()) {
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const monthStr = String(monthIdx + 1).padStart(2, '0');
      goals.push({
        year,
        month: monthStr,
        goal_type: 'b2b-il',
        target_name: teamName,
        target_weight: Math.round(monthlyTotals[monthIdx]),
        target_amount: 0 // B2B sheet only has weight data
      });
    }
  }

  return goals;
}

/**
 * Parse B2C사업계획(중량) sheet
 * Columns: 구분, name, 1월...12월
 * Aggregate by team name (column[0])
 * Returns Map<teamName, monthlyWeights[]>
 */
function parseB2CWeightSheet(data: any[][]): Map<string, number[]> {
  const teamMonthlyWeights = new Map<string, number[]>();

  // Skip title (0) and header (1), start from row 2
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 14) continue; // Need at least columns 0-13

    const teamName = row[0]; // 구분 (team name)
    if (!teamName || teamName === '') continue;

    if (!teamMonthlyWeights.has(teamName)) {
      teamMonthlyWeights.set(teamName, new Array(12).fill(0));
    }

    const monthlyWeights = teamMonthlyWeights.get(teamName)!;

    // Columns 2-13 are monthly weights (Jan-Dec)
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const value = row[2 + monthIdx];
      const numValue = parseNumeric(value);
      monthlyWeights[monthIdx] += numValue;
    }
  }

  return teamMonthlyWeights;
}

/**
 * Parse B2C사업계획(금액) sheet
 * Columns: 구분, name, 1월...12월
 * Aggregate by team name (column[0])
 * Returns Map<teamName, monthlyAmounts[]>
 */
function parseB2CAmountSheet(data: any[][]): Map<string, number[]> {
  const teamMonthlyAmounts = new Map<string, number[]>();

  // Skip title (0) and header (1), start from row 2
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 14) continue; // Need at least columns 0-13

    const teamName = row[0]; // 구분 (team name)
    if (!teamName || teamName === '') continue;

    if (!teamMonthlyAmounts.has(teamName)) {
      teamMonthlyAmounts.set(teamName, new Array(12).fill(0));
    }

    const monthlyAmounts = teamMonthlyAmounts.get(teamName)!;

    // Columns 2-13 are monthly amounts (Jan-Dec)
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const value = row[2 + monthIdx];
      const numValue = parseNumeric(value);
      monthlyAmounts[monthIdx] += numValue;
    }
  }

  return teamMonthlyAmounts;
}

/**
 * Combine B2C weight and amount data
 * Merge by team name to create b2c-auto goals
 */
function combineB2CData(
  weights: Map<string, number[]>,
  amounts: Map<string, number[]>,
  year: string
): ParsedGoal[] {
  const goals: ParsedGoal[] = [];

  // Get all unique team names from both maps
  const allTeams = new Set([...weights.keys(), ...amounts.keys()]);

  for (const teamName of allTeams) {
    const teamWeights = weights.get(teamName) || new Array(12).fill(0);
    const teamAmounts = amounts.get(teamName) || new Array(12).fill(0);

    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const monthStr = String(monthIdx + 1).padStart(2, '0');
      goals.push({
        year,
        month: monthStr,
        goal_type: 'b2c-auto',
        target_name: teamName,
        target_weight: Math.round(teamWeights[monthIdx]),
        target_amount: Math.round(teamAmounts[monthIdx])
      });
    }
  }

  return goals;
}

/**
 * Parse numeric value from Excel cell
 * Handles null, undefined, empty strings, and floating point precision
 */
function parseNumeric(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  if (isNaN(num)) return 0;
  return num;
}
