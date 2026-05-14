import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'closing-meeting');
const GLOBAL_ORDER_FILE = path.join(DATA_DIR, 'overview-order-global.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

async function ensureDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const type = searchParams.get('type'); // 'order' or 'settings'
    
    await ensureDir();
    
    if (type === 'settings') {
      try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
        return NextResponse.json({ success: true, data: JSON.parse(data) });
      } catch {
        return NextResponse.json({ success: true, data: { isLocked: false } });
      }
    }

    let filePath = GLOBAL_ORDER_FILE;
    if (month) {
      filePath = path.join(DATA_DIR, `overview-order-${month}.json`);
    }

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return NextResponse.json({ success: true, data: JSON.parse(data) });
    } catch {
      // If month-specific file doesn't exist, try global
      if (month) {
        try {
          const globalData = await fs.readFile(GLOBAL_ORDER_FILE, 'utf-8');
          return NextResponse.json({ success: true, data: JSON.parse(globalData) });
        } catch {
          return NextResponse.json({ success: true, data: null });
        }
      }
      return NextResponse.json({ success: true, data: null });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { month, data, type } = body;
    
    await ensureDir();
    
    if (type === 'settings') {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
      return NextResponse.json({ success: true });
    }

    const filePath = month 
      ? path.join(DATA_DIR, `overview-order-${month}.json`)
      : GLOBAL_ORDER_FILE;

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    
    // Also update global if it's a month-specific save? 
    // Usually we want the latest order to be the new global default.
    await fs.writeFile(GLOBAL_ORDER_FILE, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
