import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { requireAuth } from '@/lib/auth';

export async function GET(request) {
  try {
    const session = await requireAuth(request);
    const cpNumber = session.userNumber;
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const tabName = 'CP_TOKENS';

    let connected = false;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tabName}!A:B`,
      });
      const rows = res.data.values || [];
      for (const row of rows) {
        if (row[0] === cpNumber && row[1] && row[1].trim() !== '') {
          connected = true;
          break;
        }
      }
    } catch (error) {
      // If the sheet doesn't exist, just return disconnected
      if (error.code === 400 && error.message.includes('Unable to parse range')) {
        console.warn('CP_TOKENS sheet not found – returning disconnected');
        // Do nothing, connected remains false
      } else {
        console.error('Calendar status check error:', error);
        // Re-throw to be caught by outer try-catch
        throw error;
      }
    }

    return NextResponse.json({ connected });
  } catch (error) {
    console.error('Calendar status check error:', error);
    return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
  }
}