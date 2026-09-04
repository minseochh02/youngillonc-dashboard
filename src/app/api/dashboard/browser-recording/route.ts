import { NextResponse } from 'next/server';
import {
  listBrowserRecordingTests,
  getBrowserRecordingReplayOptions,
  runBrowserRecording,
  type BrowserRecordingRunOptions
} from '@/egdesk-helpers';

type ScriptEntry = string | { name?: string };

function normalizeScriptNames(input: unknown): string[] {
  const list =
    input && typeof input === 'object' && 'tests' in input
      ? (input as { tests?: unknown[] }).tests
      : Array.isArray(input)
        ? input
        : [];

  return (list || [])
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') return (entry as { name?: string }).name;
      return undefined;
    })
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
}

/** Convert YYYY-MM-DD → YYYY/MM/DD and normalize August 31 to September 1 for Ecount compatibility */
function toPickerDate(date: string): string {
  const normalized = date.replace(/-/g, '/');
  // Ecount fails on August 31st end date, adjust YYYY/08/31 to YYYY/09/01
  return normalized.replace(/(\d{4})\/08\/31/, '$1/09/01');
}

/**
 * Build the correct BrowserRecordingRunOptions based on what the script's UI actually supports.
 * - dateRange  → pass both startDate and endDate
 * - singleDate → pass only startDate (use endDate value so the single picker gets the range end)
 * - none       → pass no dates at all
 */
async function buildRunOptions(
  testFile: string,
  startDate?: string,
  endDate?: string,
  headless?: boolean
): Promise<BrowserRecordingRunOptions> {
  const replayOpts = await getBrowserRecordingReplayOptions(testFile);
  const ui: string = replayOpts?.ui ?? 'none';

  const baseOpts: BrowserRecordingRunOptions = {
    headless: typeof headless === 'boolean' ? headless : false,
  };

  if (ui === 'dateRange' && startDate && endDate) {
    return { ...baseOpts, startDate: toPickerDate(startDate), endDate: toPickerDate(endDate) };
  }

  if (ui === 'singleDate' && (endDate || startDate)) {
    // Use endDate as the single date (represents "as of end of period")
    return { ...baseOpts, startDate: toPickerDate(endDate ?? startDate!) };
  }

  // ui === 'none' or no dates provided
  return baseOpts;
}

export async function GET() {
  try {
    const listed = await listBrowserRecordingTests();
    const scripts = normalizeScriptNames(listed);
    const outputDir =
      listed && typeof listed === 'object' && 'outputDir' in listed
        ? String((listed as { outputDir?: string }).outputDir || '')
        : '';

    return NextResponse.json({
      success: true,
      scripts,
      count: scripts.length,
      outputDir: outputDir || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list scripts';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const testFile = typeof body?.testFile === 'string' ? body.testFile : '';
    const startDate = typeof body?.runOptions?.startDate === 'string' ? body.runOptions.startDate : undefined;
    const endDate = typeof body?.runOptions?.endDate === 'string' ? body.runOptions.endDate : undefined;
    const headless = typeof body?.runOptions?.headless === 'boolean' ? body.runOptions.headless : false;

    if (!testFile) {
      return NextResponse.json(
        { success: false, error: 'testFile is required' },
        { status: 400 }
      );
    }

    const runOptions = await buildRunOptions(testFile, startDate, endDate, headless);
    const result = await runBrowserRecording(testFile, runOptions);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run script';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
