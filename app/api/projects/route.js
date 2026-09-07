import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { requireAuth } from '@/lib/auth';

export async function GET(request) {
  try {
    await requireAuth(request);
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Projects!A2:A',
    });
    const rows = res.data.values || [];
    const projects = rows.map((r) => (r[0] || '').toString().trim()).filter(Boolean);
    return NextResponse.json({ success: true, projects });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || String(error), projects: [] }, { status: error.status || 500 });
  }
}