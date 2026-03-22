import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function main() {
  const filePath = 'REPORT/[참고] 2602 판매실적.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[] = XLSX.utils.sheet_to_json(sheet);

  const start = 46079;
  const end = 46081;
  const filtered = data.filter(row => row['일자'] >= start && row['일자'] <= end);

  const targets = {
    'SeoulHwaseongIL': 132952396,
    'Changwon': 103078140,
    'Busan': 26980250,
    'West': 26549858,
    'Central': 19841120,
    'East': 3773771,
    'Jeju': 1272200
  };

  const groups = [];
  const branches = Array.from(new Set(filtered.map(row => row['거래처그룹1명'])));
  const categories = Array.from(new Set(filtered.map(row => row['품목그룹1코드'])));

  branches.forEach(b => {
    categories.forEach(c => {
      const supply = filtered.reduce((s, row) => (row['거래처그룹1명'] === b && row['품목그룹1코드'] === c && row['공급가액'] > 0) ? s + row['공급가액'] : s, 0);
      const total = filtered.reduce((s, row) => (row['거래처그룹1명'] === b && row['품목그룹1코드'] === c && row['합계'] > 0) ? s + row['합계'] : s, 0);
      if (supply > 0) groups.push({ name: `${b} ${c} Supply`, val: supply });
      if (total > 0) groups.push({ name: `${b} ${c} Total`, val: total });
    });
  });

  // Also try employee-based groups
  const emps = Array.from(new Set(filtered.map(row => row['현 담당자'])));
  emps.forEach(e => {
    const supply = filtered.reduce((s, row) => (row['현 담당자'] === e && row['공급가액'] > 0) ? s + row['공급가액'] : s, 0);
    const total = filtered.reduce((s, row) => (row['현 담당자'] === e && row['합계'] > 0) ? s + row['합계'] : s, 0);
    if (supply > 0) groups.push({ name: `${e} Supply`, val: supply });
    if (total > 0) groups.push({ name: `${e} Total`, val: total });
  });

  console.log(`Testing ${groups.length} groups against targets...`);

  Object.entries(targets).forEach(([name, target]) => {
    console.log(`\n--- Target: ${name} (${target.toLocaleString()}) ---`);
    groups.forEach(g => {
      if (Math.abs(g.val - target) < 1000) {
        console.log(`  MATCH: ${g.name} = ${g.val.toLocaleString()} (Diff: ${Math.round(g.val - target).toLocaleString()})`);
      }
    });
  });
}

main();
