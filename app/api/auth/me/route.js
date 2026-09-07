import { NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE, requireAuth } from '@/lib/auth';
import { getSheetsClient } from '@/lib/google';
import { getUserByNumber, updateUserEmailByNumber } from '@/lib/users';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    return NextResponse.json(
      { success: false, error: 'Missing env: SPREADSHEET_ID' },
      { status: 500 }
    );
  }

  try {
    const sheets = getSheetsClient();
    const user = await getUserByNumber(sheets, spreadsheetId, session.userNumber);

    return NextResponse.json({
      success: true,
      name: session.name,
      userNumber: session.userNumber,
      role: session.role,
      email: user?.email || '',
    });
  } catch (e) {
    // still return session info even if sheet read fails
    return NextResponse.json({
      success: true,
      name: session.name,
      userNumber: session.userNumber,
      role: session.role,
      email: '',
    });
  }
}

export async function PUT(request) {
  try {
    const session = await requireAuth(request);

    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, error: 'Missing env: SPREADSHEET_ID' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim();

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const sheets = getSheetsClient();
    const updated = await updateUserEmailByNumber(
      sheets,
      spreadsheetId,
      session.userNumber,
      email
    );

    return NextResponse.json({ success: true, email: updated.email });
  } catch (err) {
    const status = err?.status || 500;
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error' },
      { status }
    );
  }
}