import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { requireAuth } from '@/lib/auth';
import {
  getAllLeadsRaw, findLeadRow, updateLeadRow, logActivity,
  validateDateTime, formatNowSheet, sanitizeString, STAGES, SUB_STATUSES,
} from '@/lib/leads';

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

export async function GET(request, { params }) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const sheets = getSheetsClient();
    const leads = await getAllLeadsRaw(sheets, process.env.SPREADSHEET_ID, session.role, session.userNumber);
    const lead = leads.find((l) => l.uniqueId === id);
    if (!lead) return NextResponse.json({ success: false, message: 'Lead not found or unauthorized!' }, { status: 404 });
    return NextResponse.json({ success: true, lead });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { subStatus, nextFollowDateTime, remark, project } = body;

    if (SUB_STATUSES.indexOf(subStatus) === -1) return NextResponse.json({ success: false, message: 'Invalid sub-status!' }, { status: 400 });
    const validDateTime = validateDateTime(nextFollowDateTime);
    if (!validDateTime) return NextResponse.json({ success: false, message: 'Valid follow-up date & time required!' }, { status: 400 });
    const cleanRemark = sanitizeString(remark, 1000);
    const cleanProject = sanitizeString(project, 100);

    const sheets = getSheetsClient();
    const ssid = process.env.SPREADSHEET_ID;
    const found = await findLeadRow(sheets, ssid, id);
    if (!found) return NextResponse.json({ success: false, message: 'Lead not found!' }, { status: 404 });
    const { rowNum, row } = found;

    if (session.role !== 'Admin' && !phoneMatches(row[7], session.userNumber)) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Not your lead!' }, { status: 403 });
    }

    const oldStage = row[9] || '';
    const oldFollowDate = row[10] || 'None';
    const currentCount = parseInt(row[11] || 0, 10);
    const existingRemark = row[12] || '';
    const timestamp = formatNowSheet();

    let newStage = oldStage;
    let finalSubStatus = subStatus;

    if (subStatus === 'Done') {
      const idx = STAGES.indexOf(oldStage);
      if (idx >= 0 && idx < STAGES.length - 2) newStage = STAGES[idx + 1];
      else if (oldStage === 'Follow Up 2') newStage = 'Deal Won';
      finalSubStatus = 'Under Follow-up';
    } else if (subStatus === 'Not Interested') {
      newStage = 'Deal Lost';
      finalSubStatus = 'Not Interested';
    }

    const newRemarkText = cleanRemark
      ? `[${timestamp} - ${subStatus} by ${session.name}] ${cleanRemark}${existingRemark ? '\n' + existingRemark : ''}`
      : existingRemark;

    if (cleanProject) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: ssid, range: `FMS!F${rowNum}`, valueInputOption: 'RAW',
        requestBody: { values: [[cleanProject]] },
      });
    }

    await updateLeadRow(sheets, ssid, rowNum, 10, [newStage, validDateTime, currentCount + 1, newRemarkText, finalSubStatus, timestamp]);

    await logActivity(sheets, ssid, {
      leadId: id, action: 'Lead Updated', doerName: session.name, doerRole: session.role,
      oldStage, newStage, subStatus: finalSubStatus, oldFollowUp: oldFollowDate, newFollowUp: validDateTime,
      customerInfo: row[1] || '', remark: cleanRemark || '',
    });

    return NextResponse.json({ success: true, message: `Lead updated! Stage: ${newStage} | Status: ${finalSubStatus}` });
  } catch (error) {
    console.error('UPDATE LEAD ERROR:', error);
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}