const LEAD_DB_RANGE = 'Lead Database!A2:I';

// Maps the sheet's "From" column to your pipeline stages.
export const FROM_STAGE_MAP = {
  'Lead Qaulificatin': 'New Lead', // matches the sheet's actual (misspelled) value
  'Lead Qualificatin': 'New Lead',
  'Lead Qualification': 'New Lead',
  'First Followup': 'Follow Up 1',
  'After Site Visit Follow up': 'Follow Up 2',
};

export function suggestedStageFor(fromValue) {
  return FROM_STAGE_MAP[(fromValue || '').trim()] || 'New Lead';
}

function rowToDbLead(row, idx) {
  return {
    rowNum: idx + 2,
    timestamp: row[0] || '',
    uniqueId: row[1] || '',
    name: row[2] || '',
    contactNumber: row[3] || '',
    interestedIn: row[4] || '',
    leadSource: row[5] || '',
    status: row[6] || '',
    from: row[7] || '',
    remarks: row[8] || '',
  };
}

export async function getUnassignedLeadDbRows(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: LEAD_DB_RANGE });
  const rows = res.data.values || [];
  const leads = [];
  rows.forEach((row, idx) => {
    if (!row[1] && !row[2]) return; // skip blank rows
    const status = (row[6] || '').trim().toLowerCase();
    if (status !== 'unassigned') return;
    leads.push(rowToDbLead(row, idx));
  });
  return leads;
}

// Marks a Lead Database row as Assigned and appends an audit note to its Remarks (col I).
// `fromValue` must be passed back in since we're updating the whole G:I range at once.
export async function markLeadDbAssigned(sheets, spreadsheetId, rowNum, fromValue, note) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Lead Database!G${rowNum}:I${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Assigned', fromValue || '', note]] },
  });
}