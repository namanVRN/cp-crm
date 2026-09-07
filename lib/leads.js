import { sanitizeString, sanitizePhone } from './utils';

export const STAGES = ['New Lead', 'Follow Up 1', 'Site Visit', 'Follow Up 2', 'Deal Won', 'Deal Lost'];
export const SUB_STATUSES = ['Done', 'Under Follow-up', 'Not Interested'];
const FMS_RANGE = 'FMS!A2:O';

export function validateDateTime(dateTimeStr) {
  if (!dateTimeStr) return null;
  const parts = dateTimeStr.split('T');
  if (parts.length !== 2) return null;
  const dateParts = parts[0].split('-');
  if (dateParts.length !== 3) return null;
  const timeParts = parts[1].split(':');
  if (timeParts.length !== 2) return null;
  const y = parseInt(dateParts[0], 10), m = parseInt(dateParts[1], 10), d = parseInt(dateParts[2], 10);
  const h = parseInt(timeParts[0], 10), min = parseInt(timeParts[1], 10);
  if ([y, m, d, h, min].some(isNaN)) return null;
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020 || y > 2100) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d)}/${pad(m)}/${y} ${pad(h)}:${pad(min)}`;
}

export function formatNowSheet() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateOnly() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function defaultFollowUpTomorrow9am() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} 09:00`;
}

function normalizePhone(phone) {
  if (!phone) return '';
  let digits = phone.toString().replace(/\D/g, '');
  if (digits.length === 12 && digits.substring(0, 2) === '91') digits = digits.substring(2);
  if (digits.length === 11 && digits.charAt(0) === '0') digits = digits.substring(1);
  return digits;
}

function rowToLead(row, idx) {
  return {
    rowIndex: idx + 2,
    date: row[0] || '',
    uniqueId: row[1] || '',
    customerName: row[2] || '',
    customerNumber: row[3] || '',
    interestedIn: row[4] || '',
    project: row[5] || '',
    cpName: row[6] || '',
    cpNumber: row[7] || '',
    leadSource: row[8] || '',
    currentStage: (row[9] || '').toString().trim(),
    nextFollowDate: row[10] || '',
    followCount: row[11] || 0,
    remark: row[12] || '',
    subStatus: row[13] || '',
    lastUpdated: row[14] || '',
  };
}

export async function getAllLeadsRaw(sheets, spreadsheetId, role, cpNumber) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: FMS_RANGE });
  const rows = res.data.values || [];
  const isAdmin = role === 'Admin';
  const myNorm = normalizePhone(cpNumber);

  const leads = [];
  rows.forEach((row, idx) => {
    if (!row[1] && !row[2]) return;
    if (!isAdmin) {
      const rowCpNorm = normalizePhone(row[7]);
      if (!rowCpNorm || rowCpNorm !== myNorm) return;
    }
    leads.push(rowToLead(row, idx));
  });
  return leads;
}

export async function generateUniqueId(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'FMS!B2:B' });
  const rows = res.data.values || [];
  let maxId = 0;
  rows.forEach((row) => {
    if (row[0]) {
      const num = parseInt(row[0].toString().replace('LEAD-', ''), 10);
      if (!isNaN(num) && num > maxId) maxId = num;
    }
  });
  return 'LEAD-' + String(maxId + 1).padStart(4, '0');
}

export async function logActivity(sheets, spreadsheetId, logData) {
  try {
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const timestamp = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Logger!A:L',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          timestamp, logData.leadId || '', logData.action || '', logData.doerName || '', logData.doerRole || '',
          logData.oldStage || '', logData.newStage || '', logData.subStatus || '', logData.oldFollowUp || '',
          logData.newFollowUp || '', logData.customerInfo || '', logData.remark || '',
        ]],
      },
    });
  } catch (e) {
    console.error('Logger Error:', e);
  }
}

// Finds a lead's sheet row number + raw row data by uniqueId. Returns null if not found.
export async function findLeadRow(sheets, spreadsheetId, uniqueId) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: FMS_RANGE });
  const rows = res.data.values || [];
  const idx = rows.findIndex((row) => (row[1] || '').toString() === uniqueId.toString());
  if (idx === -1) return null;
  return { rowNum: idx + 2, row: rows[idx] };
}

export async function updateLeadRow(sheets, spreadsheetId, rowNum, colStart, values) {
  const endCol = String.fromCharCode('A'.charCodeAt(0) + colStart - 1 + values.length);
  const startCol = String.fromCharCode('A'.charCodeAt(0) + colStart - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `FMS!${startCol}${rowNum}:${endCol}${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

export { sanitizeString, sanitizePhone };