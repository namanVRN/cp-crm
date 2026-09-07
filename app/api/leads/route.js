import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { requireAuth } from '@/lib/auth';
import {
  getAllLeadsRaw, generateUniqueId, logActivity, validateDateTime,
  formatDateOnly, formatNowSheet, sanitizeString, sanitizePhone,
} from '@/lib/leads';

export async function GET(request) {
  try {
    const session = await requireAuth(request);
    const sheets = getSheetsClient();
    const ssid = process.env.SPREADSHEET_ID;
    let leads = await getAllLeadsRaw(sheets, ssid, session.role, session.userNumber);

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');
    const scope = searchParams.get('scope');
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    if (stage) leads = leads.filter((l) => l.currentStage === stage);

    if (scope === 'today') {
      const today = formatDateOnly();
      leads = leads.filter((l) => {
        if (l.currentStage === 'Deal Won' || l.currentStage === 'Deal Lost') return false;
        if (!l.nextFollowDate) return false;
        return l.nextFollowDate.substring(0, 10) === today;
      });
    } else if (scope === 'overdue') {
      const now = new Date();
      leads = leads.filter((l) => {
        if (l.currentStage === 'Deal Won' || l.currentStage === 'Deal Lost') return false;
        const d = parseFollow(l.nextFollowDate);
        return d && d < now;
      });
    }

    if (q) {
      leads = leads.filter((l) =>
        (l.customerName || '').toLowerCase().includes(q) ||
        (l.customerNumber || '').toLowerCase().includes(q) ||
        (l.uniqueId || '').toLowerCase().includes(q) ||
        (l.project || '').toLowerCase().includes(q) ||
        (l.cpName || '').toLowerCase().includes(q)
      );
    }

    return NextResponse.json({ success: true, leads });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}

function parseFollow(str) {
  if (!str) return null;
  const parts = str.split(' ');
  if (parts.length !== 2) return null;
  const [dd, mm, yyyy] = parts[0].split('/').map(Number);
  const [hh, min] = parts[1].split(':').map(Number);
  if ([dd, mm, yyyy, hh, min].some(isNaN)) return null;
  return new Date(yyyy, mm - 1, dd, hh, min);
}

export async function POST(request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();

    const clean = {
      customerName: sanitizeString(body.customerName, 100),
      customerNumber: sanitizePhone(body.customerNumber),
      interestedIn: sanitizeString(body.interestedIn, 50),
      project: sanitizeString(body.project, 100),
      cpName: sanitizeString(body.cpName, 100),
      cpNumber: sanitizePhone(body.cpNumber),
      leadSource: sanitizeString(body.leadSource, 100),
      nextFollowDateTime: validateDateTime(body.nextFollowDateTime),
      remark: sanitizeString(body.remark, 1000),
    };

    if (!clean.customerName) return NextResponse.json({ success: false, message: 'Customer name required!' }, { status: 400 });
    if (!clean.customerNumber) return NextResponse.json({ success: false, message: 'Customer number required!' }, { status: 400 });
    if (!clean.nextFollowDateTime) return NextResponse.json({ success: false, message: 'Valid follow-up date & time required!' }, { status: 400 });

    if (session.role !== 'Admin') {
      clean.cpName = session.name;
      clean.cpNumber = session.userNumber;
    } else {
      if (!clean.cpName) clean.cpName = session.name;
      if (!clean.cpNumber) clean.cpNumber = session.userNumber;
    }

    const sheets = getSheetsClient();
    const ssid = process.env.SPREADSHEET_ID;
    const uniqueId = await generateUniqueId(sheets, ssid);
    const dateStr = formatDateOnly();
    const nowStr = formatNowSheet();

    await sheets.spreadsheets.values.append({
      spreadsheetId: ssid,
      range: 'FMS!A:O',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          dateStr, uniqueId, clean.customerName, clean.customerNumber, clean.interestedIn,
          clean.project, clean.cpName, clean.cpNumber, clean.leadSource, 'New Lead',
          clean.nextFollowDateTime, 0, clean.remark, '', nowStr,
        ]],
      },
    });

    await logActivity(sheets, ssid, {
      leadId: uniqueId, action: 'Lead Created', doerName: session.name, doerRole: session.role,
      newStage: 'New Lead', newFollowUp: clean.nextFollowDateTime,
      customerInfo: `${clean.customerName} (${clean.customerNumber}) - ${clean.project || 'No Project'}`,
      remark: clean.remark || '',
    });

    return NextResponse.json({ success: true, message: 'Lead added! ID: ' + uniqueId, uniqueId });
  } catch (error) {
    console.error('ADD LEAD ERROR:', error);
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}