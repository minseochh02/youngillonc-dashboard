import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    console.log('=== Enriching Purchase Data ===\n');

    // Load parsed purchase data
    const migrationsPath = path.join(process.cwd(), 'migrations');
    const dongbuData = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'dongbu-purchases-parsed.json'), 'utf-8')
    );
    const seobuData = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'seobu-purchases-parsed.json'), 'utf-8')
    );

    console.log(`Loaded 동부: ${dongbuData.length} rows`);
    console.log(`Loaded 서부: ${seobuData.length} rows`);

    // Get all unique 품목코드 from both datasets
    const allRecords = [...dongbuData, ...seobuData];
    const unique품목코드 = [...new Set(allRecords.map(r => r.품목코드).filter(Boolean))];
    console.log(`\nUnique 품목코드: ${unique품목코드.length}`);

    // Fetch 품목그룹1코드 from items table
    console.log('Fetching 품목그룹1코드 from items table...');
    const itemsQuery = `SELECT 품목코드, 품목그룹1코드 FROM items WHERE 품목코드 IN (${unique품목코드.map(code => `'${code}'`).join(',')})`;
    const itemsResult = await executeSQL(itemsQuery);

    console.log(`✓ Fetched ${itemsResult.rows.length} items`);

    // Create mapping
    const 품목코드To그룹1코드: Record<string, string> = {};
    itemsResult.rows.forEach((item: any) => {
      if (item.품목코드 && item.품목그룹1코드) {
        품목코드To그룹1코드[item.품목코드] = item.품목그룹1코드;
      }
    });

    console.log(`Created mapping for ${Object.keys(품목코드To그룹1코드).length} items`);

    // Apply mapping to both datasets
    function enrichRecords(records: any[], source: string) {
      let mapped = 0;
      let unmapped = 0;

      const enriched = records.map(record => {
        const newRecord = { ...record };

        if (record.품목코드) {
          const 그룹1코드 = 품목코드To그룹1코드[record.품목코드];
          if (그룹1코드) {
            newRecord.품목그룹1코드 = 그룹1코드;
            mapped++;
          } else {
            unmapped++;
          }
        }

        return newRecord;
      });

      console.log(`\n${source}: ${mapped} mapped, ${unmapped} unmapped`);
      return enriched;
    }

    const dongbuEnriched = enrichRecords(dongbuData, '동부구매');
    const seobuEnriched = enrichRecords(seobuData, '서부구매');

    // Save enriched data
    fs.writeFileSync(
      path.join(migrationsPath, 'dongbu-purchases-final.json'),
      JSON.stringify(dongbuEnriched, null, 2)
    );

    fs.writeFileSync(
      path.join(migrationsPath, 'seobu-purchases-final.json'),
      JSON.stringify(seobuEnriched, null, 2)
    );

    console.log('\n✓ Saved dongbu-purchases-final.json');
    console.log('✓ Saved seobu-purchases-final.json');

    return NextResponse.json({
      success: true,
      message: 'Purchase data enriched successfully',
      stats: {
        동부구매: dongbuEnriched.length,
        서부구매: seobuEnriched.length,
        품목코드Mapped: Object.keys(품목코드To그룹1코드).length
      },
      sampleDongbu: dongbuEnriched[0],
      sampleSeobu: seobuEnriched[0]
    });

  } catch (error: any) {
    console.error('Enrich error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Enrichment failed',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
