import { NextResponse } from 'next/server';
import { getSheetsClient, getCalendarClientForCP } from '@/lib/google';
import { requireAuth } from '@/lib/auth';
import { findLeadRow } from '@/lib/leads';

function phoneMatches(a, b) {
  const norm = (p) => {
    if (!p) return '';
    let d = p.toString().replace(/\D/g, '');
    if (d.length === 12 && d.substring(0, 2) === '91') d = d.substring(2);
    if (d.length === 11 && d.charAt(0) === '0') d = d.substring(1);
    return d;
  };
  const n1 = norm(a), n2 = norm(b);
  return Boolean(n1 && n2 && n1 === n2);
}

function parseFollowDate(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
  return null;
}

export async function POST(request, { params }) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    const sheets = getSheetsClient();
    const ssid = process.env.SPREADSHEET_ID;
    const found = await findLeadRow(sheets, ssid, id);
    if (!found) return NextResponse.json({ success: false, message: 'Lead not found!' }, { status: 404 });
    const { row } = found;

    if (session.role !== 'Admin' && !phoneMatches(row[7], session.userNumber)) {
      return NextResponse.json({ success: false, message: 'Unauthorized!' }, { status: 403 });
    }

    const followDateStr = row[10] || '';
    if (!followDateStr) {
      return NextResponse.json({ success: false, message: 'No follow-up date set for this lead.' }, { status: 400 });
    }
    const eventStart = parseFollowDate(followDateStr);
    if (!eventStart) {
      return NextResponse.json({ success: false, message: 'Invalid follow-up date format.' }, { status: 400 });
    }

    const cpNumber = session.userNumber;
    const calendar = await getCalendarClientForCP(cpNumber);
    if (!calendar) {
      return NextResponse.json(
        { success: false, message: 'CP has not connected their Google Calendar. Please connect first.' },
        { status: 400 }
      );
    }

    const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000); // 1 hour
    const event = {
      summary: `Follow-up with ${row[1] || 'Lead'}`,
      description: `Lead ID: ${id}\nCustomer: ${row[1] || ''}\nPhone: ${row[2] || ''}\nProject: ${row[4] || ''}\nRemark: ${row[12] || 'None'}`,
      start: {
        dateTime: eventStart.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: eventEnd.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    console.log('✅ Calendar event created:', response.data.htmlLink);

    return NextResponse.json({
      success: true,
      message: 'Calendar event created!',
      eventLink: response.data.htmlLink,
    });
  } catch (error) {
    console.error('Sync calendar error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create calendar event.' },
      { status: 500 }
    );
  }
}