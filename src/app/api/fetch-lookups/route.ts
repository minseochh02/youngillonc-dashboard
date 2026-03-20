import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    console.log('=== Fetching Lookup Data from Database ===\n');

    // Fetch employees
    console.log('Fetching employees...');
    const employeesResult = await executeSQL(
      `SELECT 사원_담당_코드, 사원_담당_명 FROM employees WHERE 사원_담당_명 IS NOT NULL`
    );
    console.log(`✓ Fetched ${employeesResult.rows.length} employees`);

    // Create 담당자코드명 → 담당자코드 mapping
    const employeeMap: Record<string, string> = {};
    employeesResult.rows.forEach((emp: any) => {
      if (emp.사원_담당_명 && emp.사원_담당_코드) {
        employeeMap[emp.사원_담당_명] = emp.사원_담당_코드;
      }
    });

    // Fetch warehouses
    console.log('Fetching warehouses...');
    const warehousesResult = await executeSQL(
      `SELECT 창고코드, 창고명 FROM warehouses WHERE 창고명 IS NOT NULL`
    );
    console.log(`✓ Fetched ${warehousesResult.rows.length} warehouses`);

    // Create 창고명 → 창고코드 mapping
    const warehouseMap: Record<string, string> = {};
    warehousesResult.rows.forEach((wh: any) => {
      if (wh.창고명 && wh.창고코드) {
        warehouseMap[wh.창고명] = wh.창고코드;
      }
    });

    // Save mappings
    const mappings = {
      employees: employeeMap,
      warehouses: warehouseMap
    };

    const migrationsPath = path.join(process.cwd(), 'migrations');
    fs.writeFileSync(
      path.join(migrationsPath, 'lookup-mappings.json'),
      JSON.stringify(mappings, null, 2)
    );

    console.log('\n✓ Saved lookup-mappings.json');

    // Load transformed data to check for unmapped values
    const transformedDongbu = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'dongbu-sales-schema.json'), 'utf-8')
    );
    const transformedSeobu = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'seobu-sales-schema.json'), 'utf-8')
    );

    const allRecords = [...transformedDongbu, ...transformedSeobu];

    // Check unmapped employees
    const unmappedEmployees = new Set<string>();
    allRecords.forEach((r: any) => {
      if (r.담당자코드 && !employeeMap[r.담당자코드]) {
        unmappedEmployees.add(r.담당자코드);
      }
    });

    // Check unmapped warehouses
    const unmappedWarehouses = new Set<string>();
    allRecords.forEach((r: any) => {
      if (r.출하창고코드 && !warehouseMap[r.출하창고코드]) {
        unmappedWarehouses.add(r.출하창고코드);
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Lookup mappings fetched successfully',
      stats: {
        employeeMappings: Object.keys(employeeMap).length,
        warehouseMappings: Object.keys(warehouseMap).length,
        unmappedEmployees: Array.from(unmappedEmployees),
        unmappedWarehouses: Array.from(unmappedWarehouses)
      },
      sampleEmployees: Object.entries(employeeMap).slice(0, 5),
      sampleWarehouses: Object.entries(warehouseMap).slice(0, 5)
    });

  } catch (error: any) {
    console.error('Error fetching lookups:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch lookups'
      },
      { status: 500 }
    );
  }
}
