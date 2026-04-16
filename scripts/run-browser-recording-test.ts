/**
 * Lists saved browser-recorder *.spec.js tests and replays one (first, or --file=name.spec.js).
 * Requires EGDesk running at NEXT_PUBLIC_EGDESK_API_URL (see .env.local).
 *
 * Labeled-field replay (captureLabeledFields): pass labeledFieldFills matching
 * getBrowserRecordingReplayOptions → labeledFieldReplayBlocks (see --fields2-demo-fills).
 */
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

import {
  listBrowserRecordingTests,
  runBrowserRecording,
  type BrowserRecordingRunOptions
} from '../egdesk-helpers';

/** One captureLabeledFields block for fields2.spec.js (12 fields, order from replay_options). */
const FIELDS2_DEMO_LABELED_FILLS: (string | undefined)[][] = [
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
];

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseRunOptions(argv: string[], resolvedTestFile: string): BrowserRecordingRunOptions {
  const o: BrowserRecordingRunOptions = {};
  const startArg = argv.find((a) => a.startsWith('--start='))?.slice('--start='.length);
  const endArg = argv.find((a) => a.startsWith('--end='))?.slice('--end='.length);
  if (argv.includes('--week-from-today')) {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    o.startDate = localYmd(today);
    o.endDate = localYmd(end);
  } else if (startArg || endArg) {
    o.startDate = startArg;
    o.endDate = endArg;
  }

  const jsonArg = argv.find((a) => a.startsWith('--labeled-fills-json='))?.slice('--labeled-fills-json='.length);
  if (jsonArg) {
    o.labeledFieldFills = JSON.parse(jsonArg) as (string | undefined)[][];
  }
  const fileArg = argv.find((a) => a.startsWith('--labeled-fills-file='))?.slice('--labeled-fills-file='.length);
  if (fileArg) {
    o.labeledFieldFills = JSON.parse(readFileSync(fileArg, 'utf8')) as (string | undefined)[][];
  }
  if (argv.includes('--fields2-demo-fills')) {
    if (resolvedTestFile.includes('fields2')) {
      o.labeledFieldFills = FIELDS2_DEMO_LABELED_FILLS;
    } else {
      console.warn(
        '[run-browser-recording-test] --fields2-demo-fills only applies when running fields2.spec.js; ignoring.'
      );
    }
  }
  return o;
}

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='));
  const testFile = fileArg?.slice('--file='.length);

  const listed = await listBrowserRecordingTests();
  console.log('Saved tests:', JSON.stringify(listed, null, 2));

  const toFileName = (x: unknown): string | undefined => {
    if (typeof x === 'string') return x;
    if (x && typeof x === 'object' && 'name' in x && typeof (x as { name: unknown }).name === 'string') {
      return (x as { name: string }).name;
    }
    return undefined;
  };

  let files: string[] = [];
  if (Array.isArray(listed)) {
    files = listed.map(toFileName).filter((s): s is string => Boolean(s));
  } else if (listed && typeof listed === 'object' && 'tests' in listed) {
    const t = (listed as { tests: unknown }).tests;
    if (Array.isArray(t)) files = t.map(toFileName).filter((s): s is string => Boolean(s));
  } else if (listed && typeof listed === 'object' && 'files' in listed) {
    const f = (listed as { files: unknown }).files;
    if (Array.isArray(f)) files = f.map(toFileName).filter((s): s is string => Boolean(s));
  }

  const target = testFile ?? files[0];
  if (!target) {
    console.error('No test file to run. Pass --file=your.spec.js when listing is empty.');
    process.exit(1);
  }

  const runOptions = parseRunOptions(process.argv, target);

  console.log('Running:', target);
  if (Object.keys(runOptions).length > 0) {
    console.log('runBrowserRecording options:', runOptions);
  }
  const result = await runBrowserRecording(target, runOptions);
  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
