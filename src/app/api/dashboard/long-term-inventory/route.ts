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
    
    const savedItems = await readData();

    // Fetch items for selection with category and specification
    const items = await executeSQL(`
      SELECT 
        i.품목코드, 
        i.품목명_규격_ as item_name,
        COALESCE(MAX(spec_map.spec), '') as spec,
        CASE 
          WHEN MAX(cat_map.품목그룹1코드) = 'IL' THEN 'IL'
          WHEN MAX(cat_map.품목그룹1코드) IN ('PVL', 'CVL') THEN 'AL'
          ELSE '기타'
        END as category
      FROM inventory i
      LEFT JOIN (
        SELECT 품목코드, MAX(규격명) as spec FROM sales GROUP BY 품목코드
        UNION ALL
        SELECT 품목코드, MAX(규격_규격명) as spec FROM purchases GROUP BY 품목코드
      ) spec_map ON i.품목코드 = spec_map.품목코드
      LEFT JOIN (
        SELECT 품목코드, MAX(품목그룹1코드) as 품목그룹1코드 FROM sales GROUP BY 품목코드
        UNION ALL
        SELECT 품목코드, MAX(품목그룹1코드) as 품목그룹1코드 FROM purchases GROUP BY 품목코드
      ) cat_map ON i.품목코드 = cat_map.품목코드
      GROUP BY i.품목코드, i.품목명_규격_
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
      FROM sales
      WHERE 단위 IS NOT NULL AND 단위 != ''
      UNION
      SELECT DISTINCT 단위 as unit
      FROM purchases
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

    return NextResponse.json({
      success: true,
      data: {
        savedItems: savedItemsWithCategory,
        items: items?.rows || [],
        warehouses: (warehouses?.rows || []).map((r: any) => r.warehouse),
        units: (units?.rows || []).map((r: any) => r.unit),
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
