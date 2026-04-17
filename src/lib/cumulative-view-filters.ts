import type { CumulativeRow, CumulativeSection } from "@/lib/closing-meeting-cumulative";

/** B2C `branch_subtotal` label: "{사업소} 소계" */
export function parseB2cBranchSubtotalLabel(label: string): string | null {
  if (label.endsWith(" 소계") && !label.includes("B2B")) {
    return label.slice(0, -" 소계".length);
  }
  return null;
}

/** B2B `b2b_branch_subtotal` label: "{사업소} 소계 (B2B)" */
export function parseB2bBranchSubtotalLabel(label: string): string | null {
  const m = label.match(/^(.+) 소계 \(B2B\)$/);
  return m ? m[1] : null;
}

export function extractBranchesFromSections(sections: CumulativeSection[]): string[] {
  const set = new Set<string>();
  for (const sec of sections) {
    for (const row of sec.rows) {
      const b2c = parseB2cBranchSubtotalLabel(row.label);
      if (b2c) set.add(b2c);
      const b2b = parseB2bBranchSubtotalLabel(row.label);
      if (b2b) set.add(b2b);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
}

/**
 * When `branch` is set, keep summary rows + only that 사업소의 소계/팀 행.
 * (재고·sell-in·채널 합계 행은 전사 기준이므로 그대로 둠 — 필터는 상세에만 적용.)
 */
export function filterSectionsByBranch(
  sections: CumulativeSection[],
  branch: string | null | undefined
): CumulativeSection[] {
  if (!branch?.trim()) return sections;

  return sections.map((sec) => ({
    ...sec,
    rows: filterRowsByBranch(sec.rows, branch.trim()),
  }));
}

function filterRowsByBranch(rows: CumulativeRow[], branch: string): CumulativeRow[] {
  const out: CumulativeRow[] = [];
  let curB2c: string | null = null;
  let curB2b: string | null = null;

  for (const row of rows) {
    switch (row.rowKind) {
      case "inventory":
      case "sellin":
      case "total":
      case "b2b_total":
        out.push(row);
        break;
      case "branch_subtotal": {
        const b = parseB2cBranchSubtotalLabel(row.label);
        if (b !== null) curB2c = b;
        if (b === branch) out.push(row);
        break;
      }
      case "team":
        if (curB2c === branch) out.push(row);
        break;
      case "b2b_branch_subtotal": {
        const b = parseB2bBranchSubtotalLabel(row.label);
        if (b !== null) curB2b = b;
        if (b === branch) out.push(row);
        break;
      }
      case "b2b_team":
        if (curB2b === branch) out.push(row);
        break;
      default:
        out.push(row);
    }
  }
  return out;
}
