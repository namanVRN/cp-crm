import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { requireAuth } from '@/lib/auth';
import { findLeadRow, logActivity, validateDateTime, formatNowSheet, sanitizeString } from '@/lib/leads';

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

export async function POST(request, { params }) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const { followDateTime, remark } = await request.json();

    const validDateTime = validateDateTime(followDateTime);
    if (!validDateTime) return NextResponse.json({ success: false, message: 'Invalid date & time!' }, { status: 400 });
    const cleanRemark = sanitizeString(remark, 1000);

    const sheets = getSheetsClient();
    const ssid = process.env.SPREADSHEET_ID;
    const found = await findLeadRow(sheets, ssid, id);
    if (!found) return NextResponse.json({ success: false, message: 'Lead not found!' }, { status: 404 });
    const { rowNum, row } = found;

    if (session.role !== 'Admin' && !phoneMatches(row[7], session.userNumber)) {
      return NextResponse.json({ success: false, message: 'Unauthorized!' }, { status: 403 });
    }

    // ---- Update the lead sheet (no calendar event) ----
    const oldFollowDate = row[10] || 'None';
    const existingRemark = row[12] || '';
    const timestamp = formatNowSheet();
    const newRemarkText = cleanRemark
      ? `[${timestamp} - Follow-up Scheduled by ${session.name}] ${cleanRemark}${existingRemark ? '\n' + existingRemark : ''}`
      : existingRemark;

    await sheets.spreadsheets.values.update({
      spreadsheetId: ssid,
      range: `FMS!K${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[validDateTime]] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: ssid,
      range: `FMS!M${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[newRemarkText]] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: ssid,
      range: `FMS!O${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[timestamp]] },
    });

    await logActivity(sheets, ssid, {
      leadId: id,
      action: 'Follow-up Scheduled',
      doerName: session.name,
      doerRole: session.role,
      oldStage: row[9] || '',
      newStage: row[9] || '',
      oldFollowUp: oldFollowDate,
      newFollowUp: validDateTime,
      customerInfo: row[1] || '',
      remark: cleanRemark || '',
    });

    return NextResponse.json({ success: true, message: 'Follow-up scheduled!' });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || String(error) },
      { status: error.status || 500 }
    );
  }
}