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

    try {
      const data = await fs.readFile(GLOBAL_ORDER_FILE, 'utf-8');
      return NextResponse.json({ success: true, data: JSON.parse(data) });
    } catch {
      return NextResponse.json({ success: true, data: null });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, type } = body;
    
    await ensureDir();
    
    if (type === 'settings') {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
      return NextResponse.json({ success: true });
    }

    await fs.writeFile(GLOBAL_ORDER_FILE, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
