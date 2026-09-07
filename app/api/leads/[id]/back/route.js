import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { requireAuth } from '@/lib/auth';
import { findLeadRow, updateLeadRow, logActivity, formatNowSheet, sanitizeString, STAGES } from '@/lib/leads';

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
    const { remark } = await request.json();
    const cleanRemark = sanitizeString(remark, 1000);

    const sheets = getSheetsClient();
    const ssid = process.env.SPREADSHEET_ID;
    const found = await findLeadRow(sheets, ssid, id);
    if (!found) return NextResponse.json({ success: false, message: 'Lead not found!' }, { status: 404 });
    const { rowNum, row } = found;

    if (session.role !== 'Admin' && !phoneMatches(row[7], session.userNumber)) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Not your lead!' }, { status: 403 });
    }

    const currentStage = row[9] || '';
    const stageIdx = STAGES.indexOf(currentStage);
    if (stageIdx <= 0) return NextResponse.json({ success: false, message: 'Cannot move back from New Lead or Deal Lost/Won!' }, { status: 400 });

    const newStage = STAGES[stageIdx - 1];
    const timestamp = formatNowSheet();
    const currentCount = parseInt(row[11] || 0, 10);
    const existingRemark = row[12] || '';
    const oldFollowDate = row[10] || 'None';
    const newRemarkText = cleanRemark
      ? `[${timestamp} - Moved Back to ${newStage} by ${session.name}] ${cleanRemark}${existingRemark ? '\n' + existingRemark : ''}`
      : existingRemark;

    await updateLeadRow(sheets, ssid, rowNum, 10, [newStage, oldFollowDate === 'None' ? '' : oldFollowDate, currentCount + 1, newRemarkText, 'Under Follow-up', timestamp]);

    await logActivity(sheets, ssid, {
      leadId: id, action: 'Moved Back', doerName: session.name, doerRole: session.role,
      oldStage: currentStage, newStage, oldFollowUp: oldFollowDate, newFollowUp: oldFollowDate,
      customerInfo: row[1] || '', remark: cleanRemark || '',
    });

    return NextResponse.json({ success: true, message: 'Lead moved back to ' + newStage });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}