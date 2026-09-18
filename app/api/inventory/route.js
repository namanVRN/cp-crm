import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { getInventoryDashboardData } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const spreadsheetId = process.env.INVENTORY_SPREADSHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Missing env: INVENTORY_SPREADSHEET_ID' }, { status: 500 });
    }

    const sheets = getSheetsClient();
    const data = await getInventoryDashboardData(sheets, spreadsheetId);

    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}