import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { requireAdmin } from '@/lib/auth';
import { getUnassignedLeadDbRows, markLeadDbAssigned, suggestedStageFor } from '@/lib/leadDatabase';
import {
  STAGES, generateUniqueId, logActivity, formatDateOnly, formatNowSheet,
  defaultFollowUpTomorrow9am, sanitizeString, sanitizePhone,
} from '@/lib/leads';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const sheets = getSheetsClient();
    const ssid = process.env.SPREADSHEET_ID;
    const rows = await getUnassignedLeadDbRows(sheets, ssid);
    const leads = rows.map((r) => ({ ...r, suggestedStage: suggestedStageFor(r.from) }));
    return NextResponse.json({ success: true, leads });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const session = await requireAdmin(request);
    const body = await request.json();

    const uniqueIds = Array.isArray(body.uniqueIds) ? body.uniqueIds.map(String) : [];
    const cpName = sanitizeString(body.cpName, 100);
    const cpNumber = sanitizePhone(body.cpNumber);
    const stage = STAGES.includes(body.stage) ? body.stage : null;
    const remark = sanitizeString(body.remark, 1000);

    if (!uniqueIds.length) return NextResponse.json({ success: false, message: 'Select at least one lead!' }, { status: 400 });
    if (!cpName || !cpNumber) return NextResponse.json({ success: false, message: 'Select a CP to assign to!' }, { status: 400 });
    if (!stage) return NextResponse.json({ success: false, message: 'Select a valid stage!' }, { status: 400 });

    const sheets = getSheetsClient();
    const ssid = process.env.SPREADSHEET_ID;

    // Re-fetch fresh instead of trusting client-sent row data, so we don't
    // double-assign a row someone else already claimed a moment ago.
    const dbRows = await getUnassignedLeadDbRows(sheets, ssid);
    const wanted = dbRows.filter((r) => uniqueIds.includes(r.uniqueId));

    if (!wanted.length) {
      return NextResponse.json({ success: false, message: 'None of the selected leads are available (already assigned?).' }, { status: 400 });
    }

    const dateStr = formatDateOnly();
    const nowStr = formatNowSheet();
    const followDT = defaultFollowUpTomorrow9am();
    const assigned = [];

    for (const row of wanted) {
      const newId = await generateUniqueId(sheets, ssid);
      const combinedRemark = [row.remarks, remark].filter(Boolean).join(' | ');

      await sheets.spreadsheets.values.append({
        spreadsheetId: ssid,
        range: 'FMS!A:O',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            dateStr, newId, row.name, row.contactNumber, row.interestedIn,
            '', cpName, cpNumber, row.leadSource, stage,
            followDT, 0, combinedRemark, '', nowStr,
          ]],
        },
      });

      await markLeadDbAssigned(sheets, ssid, row.rowNum, row.from, `Assigned to ${cpName} as ${newId}`);

      await logActivity(sheets, ssid, {
        leadId: newId, action: 'Lead Assigned', doerName: session.name, doerRole: session.role,
        newStage: stage, newFollowUp: followDT,
        customerInfo: `${row.name} (${row.contactNumber})`,
        remark: remark || '',
      });

      assigned.push({ dbUniqueId: row.uniqueId, newLeadId: newId });
    }

    return NextResponse.json({ success: true, message: `${assigned.length} lead(s) assigned to ${cpName}!`, assigned });
  } catch (error) {
    console.error('ASSIGN LEADS ERROR:', error);
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}