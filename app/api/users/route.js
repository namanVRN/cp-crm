import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { requireAdmin } from '@/lib/auth';
import { getCpList, getAllUsers, addUser } from '@/lib/users';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const sheets = getSheetsClient();
    const ssid = process.env.SPREADSHEET_ID;
    const { searchParams } = new URL(request.url);

    if (searchParams.get('all') === 'true') {
      const users = await getAllUsers(sheets, ssid);
      return NextResponse.json({ success: true, users });
    }

    const cps = await getCpList(sheets, ssid);
    return NextResponse.json({ success: true, cps });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const name = (body.name || '').toString().trim();
    const userNumber = (body.userNumber || '').toString().trim();
    const role = body.role === 'Admin' ? 'Admin' : 'CP';
    const password = (body.password || '').toString();
    const email = (body.email || '').toString().trim();

    if (!name || !userNumber || !password) {
      return NextResponse.json({ success: false, message: 'Name, number, and password are required!' }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ success: false, message: 'Password must be at least 4 characters!' }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, message: 'Invalid email format!' }, { status: 400 });
    }

    const sheets = getSheetsClient();
    await addUser(sheets, process.env.SPREADSHEET_ID, { name, userNumber, role, password, email });
    return NextResponse.json({ success: true, message: 'User added successfully!' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}