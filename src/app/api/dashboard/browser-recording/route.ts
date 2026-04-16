import { NextResponse } from 'next/server';
import {
  listBrowserRecordingTests,
  runBrowserRecording,
  type BrowserRecordingRunOptions
} from '@/egdesk-helpers';

type ScriptEntry = string | { name?: string };

const HARDCODED_LABELED_FILLS: Record<string, (string | undefined)[][]> = {
  'fields2.spec.js': [
    [
      '2026/04/15',
      'C001',
      '데모거래처',
      'E01',
      '데모담당',
      'W01',
      '데모창고',
      'P01',
      '데모프로젝트',
      '0',
      '0',
      '데모적요'
    ]
  ]
};

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
      if (entry && typeof entry === 'object') return (entry as ScriptEntry).name;
      return undefined;
    })
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
}

function mergeRunOptions(
  testFile: string,
  runOptions: BrowserRecordingRunOptions = {}
): BrowserRecordingRunOptions {
  const merged: BrowserRecordingRunOptions = { ...runOptions };

  if (!merged.labeledFieldFills && HARDCODED_LABELED_FILLS[testFile]) {
    merged.labeledFieldFills = HARDCODED_LABELED_FILLS[testFile];
  }

  return merged;
}

export async function GET() {
  try {
    const listed = await listBrowserRecordingTests();
    const scripts = normalizeScriptNames(listed);

    return NextResponse.json({ success: true, scripts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list scripts';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const testFile = typeof body?.testFile === 'string' ? body.testFile : '';
    const runOptions =
      body?.runOptions && typeof body.runOptions === 'object'
        ? (body.runOptions as BrowserRecordingRunOptions)
        : {};

    if (!testFile) {
      return NextResponse.json(
        { success: false, error: 'testFile is required' },
        { status: 400 }
      );
    }

    const result = await runBrowserRecording(testFile, mergeRunOptions(testFile, runOptions));

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run script';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
