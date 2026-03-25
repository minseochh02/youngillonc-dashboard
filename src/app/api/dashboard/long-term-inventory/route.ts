import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'src/data/long-term-inventory.json');

async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function saveData(data: any[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // Expecting YYYY-MM
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;
    const stockType = searchParams.get('type') || 'all'; // all, dead, slow
    
    const savedItems = await readData();

    // Fetch items for selection with category and specification
    const items = await executeSQL(`
      SELECT
        i.품목코드,
        i.품목명 as item_name,
        COALESCE(i.규격정보, '') as spec,
        CASE
          WHEN i.품목그룹1코드 = 'IL' THEN 'IL'
          WHEN i.품목그룹1코드 IN ('PVL', 'CVL', 'AL') THEN 'AL'
          ELSE '기타'
        END as category
      FROM items i
      ORDER BY item_name
    `);

    // Fetch warehouses for selection
    const warehouses = await executeSQL(`
      SELECT DISTINCT 창고명 as warehouse 
      FROM inventory 
      WHERE 창고명 IS NOT NULL 
      ORDER BY 창고명
    `);

    // Fetch units for selection
    const units = await executeSQL(`
      SELECT DISTINCT 단위 as unit
      FROM south_division_sales
      WHERE 단위 IS NOT NULL AND 단위 != ''
      UNION
      SELECT DISTINCT 단위 as unit
      FROM east_division_purchases
      WHERE 단위 IS NOT NULL AND 단위 != ''
    `);

    // Map saved items with their current categories
    const itemMap = new Map();
    (items?.rows || []).forEach((it: any) => {
      itemMap.set(it.품목코드, it.category);
    });

    let filteredSavedItems = savedItems;
    if (month) {
      filteredSavedItems = savedItems.filter((si: any) => si.targetMonth === month);
    }

    const savedItemsWithCategory = filteredSavedItems.map((si: any) => ({
      ...si,
      category: itemMap.get(si.itemCode) || '기타'
    }));

    // 4. Automated Analysis for Recommendations
    const inactiveDays = 180;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const turnoverThreshold = 0.1; // 10% in 6 months

    let havingClause = "";
    if (stockType === 'dead') {
      havingClause = `(MAX(last_sales.일자) IS NULL OR MAX(last_sales.일자) < '${cutoffDateStr}') AND SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL)) > 0`;
    } else if (stockType === 'slow') {
      havingClause = `(MAX(last_sales.일자) >= '${cutoffDateStr}') AND (COALESCE(sales_sum.qty, 0) / SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL)) < ${turnoverThreshold}) AND SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL)) > 0`;
    } else {
      havingClause = `(COALESCE(sales_sum.qty, 0) / SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL)) < ${turnoverThreshold}) AND SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL)) > 0`;
    }

    const totalCountResult = await executeSQL(`
      SELECT COUNT(*) as count FROM (
        SELECT i.품목코드
        FROM inventory i
        LEFT JOIN (
          SELECT 품목코드, MAX(일자) as 일자 FROM (
            SELECT 품목코드, 일자 FROM sales
            UNION ALL SELECT 품목코드, 일자 FROM east_division_sales
            UNION ALL SELECT 품목코드, 일자 FROM west_division_sales
            UNION ALL SELECT 품목코드, 일자 FROM south_division_sales
          ) GROUP BY 품목코드
        ) last_sales ON i.품목코드 = last_sales.품목코드
        LEFT JOIN (
          SELECT 품목코드, SUM(CAST(REPLACE(수량, ',', '') AS REAL)) as qty
          FROM (
            SELECT 품목코드, 수량, 일자 FROM sales
            UNION ALL SELECT 품목코드, 수량, 일자 FROM east_division_sales
            UNION ALL SELECT 품목코드, 수량, 일자 FROM west_division_sales
            UNION ALL SELECT 품목코드, 수량, 일자 FROM south_division_sales
          ) 
          WHERE 일자 >= '${cutoffDateStr}'
          GROUP BY 품목코드
        ) sales_sum ON i.품목코드 = sales_sum.품목코드
        WHERE i.imported_at = (SELECT MAX(imported_at) FROM inventory)
        GROUP BY i.품목코드, i.품목명_규격_, i.창고명
        HAVING ${havingClause}
      )
    `);
    const totalCount = totalCountResult?.rows?.[0]?.count || 0;

    const recommendedItems = await executeSQL(`
      SELECT 
        i.품목코드 as itemCode,
        i.품목명_규격_ as itemName,
        i.창고명 as warehouse,
        SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL)) as quantity,
        COALESCE(sales_sum.qty, 0) as sales_qty_6m,
        MAX(last_sales.일자) as lastSoldDate,
        CASE 
          WHEN SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL)) > 0 
          THEN COALESCE(sales_sum.qty, 0) / SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL))
          ELSE 0 
        END as turnoverRatio
      FROM inventory i
      LEFT JOIN (
        SELECT 품목코드, MAX(일자) as 일자 FROM (
          SELECT 품목코드, 일자 FROM sales
          UNION ALL SELECT 품목코드, 일자 FROM east_division_sales
          UNION ALL SELECT 품목코드, 일자 FROM west_division_sales
          UNION ALL SELECT 품목코드, 일자 FROM south_division_sales
        ) GROUP BY 품목코드
      ) last_sales ON i.품목코드 = last_sales.품목코드
      LEFT JOIN (
        SELECT 품목코드, SUM(CAST(REPLACE(수량, ',', '') AS REAL)) as qty
        FROM (
          SELECT 품목코드, 수량, 일자 FROM sales
          UNION ALL SELECT 품목코드, 수량, 일자 FROM east_division_sales
          UNION ALL SELECT 품목코드, 수량, 일자 FROM west_division_sales
          UNION ALL SELECT 품목코드, 수량, 일자 FROM south_division_sales
        ) 
        WHERE 일자 >= '${cutoffDateStr}'
        GROUP BY 품목코드
      ) sales_sum ON i.품목코드 = sales_sum.품목코드
      WHERE i.imported_at = (SELECT MAX(imported_at) FROM inventory)
      GROUP BY i.품목코드, i.품목명_규격_, i.창고명
      HAVING ${havingClause}
      ORDER BY quantity DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    return NextResponse.json({
      success: true,
      data: {
        savedItems: savedItemsWithCategory,
        items: items?.rows || [],
        warehouses: (warehouses?.rows || []).map((r: any) => r.warehouse),
        units: (units?.rows || []).map((r: any) => r.unit),
        recommendations: recommendedItems?.rows || [],
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          page,
          pageSize,
        },
      },
    });
  } catch (error: any) {
    console.error('Long-term Inventory API GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newItem = await request.json();
    const { action } = newItem;
    
    if (action === 'carry-over') {
      const { fromMonth, toMonth } = newItem;
      if (!fromMonth || !toMonth) {
        return NextResponse.json({ success: false, error: 'Missing months' }, { status: 400 });
      }
      
      const savedItems = await readData();
      const previousItems = savedItems.filter((si: any) => si.targetMonth === fromMonth);
      
      // Check if current month already has items
      const existingInTarget = savedItems.filter((si: any) => si.targetMonth === toMonth);
      const existingCodes = new Set(existingInTarget.map((si: any) => `${si.itemCode}-${si.warehouse}`));
      
      const itemsToCarry = previousItems.filter((si: any) => !existingCodes.has(`${si.itemCode}-${si.warehouse}`));
      
      const newEntries = itemsToCarry.map((si: any) => ({
        ...si,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        targetMonth: toMonth,
        createdAt: new Date().toISOString(),
        actionPlan: '', // Clear action plan for new month
      }));
      
      savedItems.push(...newEntries);
      await saveData(savedItems);
      return NextResponse.json({ success: true, count: newEntries.length });
    }

    const savedItems = await readData();
    
    // Add unique ID if not present
    const itemToAdd = {
      ...newItem,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    
    savedItems.push(itemToAdd);
    await saveData(savedItems);
    
    return NextResponse.json({ success: true, data: itemToAdd });
  } catch (error: any) {
    console.error('Long-term Inventory API POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });
    }
    
    let savedItems = await readData();
    savedItems = savedItems.filter((item: any) => item.id !== id);
    await saveData(savedItems);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Long-term Inventory API DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, remarks, actionPlan } = await request.json();
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });
    }
    
    let savedItems = await readData();
    const itemIndex = savedItems.findIndex((item: any) => item.id === id);
    
    if (itemIndex === -1) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }
    
    savedItems[itemIndex] = {
      ...savedItems[itemIndex],
      remarks: remarks !== undefined ? remarks : savedItems[itemIndex].remarks,
      actionPlan: actionPlan !== undefined ? actionPlan : savedItems[itemIndex].actionPlan,
      updatedAt: new Date().toISOString(),
    };
    
    await saveData(savedItems);
    
    return NextResponse.json({ success: true, data: savedItems[itemIndex] });
  } catch (error: any) {
    console.error('Long-term Inventory API PATCH error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
