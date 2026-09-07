import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { phoneMatches } from '@/lib/utils';

export async function POST(request) {
  try {
    const { userNumber, password } = await request.json();

    if (!userNumber || !password) {
      return NextResponse.json(
        { success: false, message: 'Please enter credentials!' },
        { status: 400 }
      );
    }

    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Users!A2:D',
    });

    const rows = res.data.values || [];
    const match = rows.find(
      (row) => phoneMatches(row[1], userNumber) && (row[3] || '').toString() === password.toString()
    );

    if (!match) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials!' },
        { status: 401 }
      );
    }

    const userData = { name: match[0].toString(), userNumber: match[1].toString(), role: match[2].toString() };
    const token = await createSessionToken(userData);

    const response = NextResponse.json({ success: true, ...userData, message: 'Login successful!' });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return NextResponse.json(
      { success: false, message: 'Error: ' + error.toString() },
      { status: 500 }
    );
  }
}