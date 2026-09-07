const USERS_RANGE = 'Users!A2:E'; // Name, User Number, Role, Password, Email

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

export async function getCpList(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: USERS_RANGE });
  const rows = res.data.values || [];
  return rows
    .filter((row) => (row[2] || '').trim().toUpperCase() === 'CP')
    .map((row) => ({ name: row[0] || '', userNumber: row[1] || '' }))
    .filter((cp) => cp.name && cp.userNumber);
}

export async function getAllUsers(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: USERS_RANGE });
  const rows = res.data.values || [];
  return rows
    .filter((row) => row[0] || row[1])
    .map((row) => ({
      name: row[0] || '',
      userNumber: row[1] || '',
      role: row[2] || '',
      email: row[4] || '',
    }));
}

export async function addUser(sheets, spreadsheetId, { name, userNumber, role, password, email }) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: USERS_RANGE });
  const rows = res.data.values || [];
  const exists = rows.some((row) => phoneMatches(row[1], userNumber));
  if (exists) {
    const err = new Error('A user with this number already exists!');
    err.status = 400;
    throw err;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Users!A:E',
    valueInputOption: 'RAW',
    requestBody: { values: [[name, userNumber, role, password, email || '']] },
  });
}

async function findUserRow(sheets, spreadsheetId, userNumber) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: USERS_RANGE });
  const rows = res.data.values || [];
  const idx = rows.findIndex((row) => phoneMatches(row[1], userNumber));
  if (idx === -1) return null;
  return { rowNum: idx + 2, row: rows[idx] }; // +2 because range starts at row 2
}

async function getUsersSheetId(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const sheet = meta.data.sheets.find((s) => s.properties.title === 'Users');
  if (!sheet) {
    const err = new Error('Users sheet not found!');
    err.status = 500;
    throw err;
  }
  return sheet.properties.sheetId;
}

export async function deleteUserByNumber(sheets, spreadsheetId, userNumber) {
  const found = await findUserRow(sheets, spreadsheetId, userNumber);
  if (!found) {
    const err = new Error('User not found!');
    err.status = 404;
    throw err;
  }
  const sheetId = await getUsersSheetId(sheets, spreadsheetId);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: found.rowNum - 1, endIndex: found.rowNum },
        },
      }],
    },
  });
}

export async function resetUserPassword(sheets, spreadsheetId, userNumber, newPassword) {
  const found = await findUserRow(sheets, spreadsheetId, userNumber);
  if (!found) {
    const err = new Error('User not found!');
    err.status = 404;
    throw err;
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Users!D${found.rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[newPassword]] },
  });
}

/**
 * NEW: Get a single user by number (for Profile screen, /api/users/me, etc.)
 */
export async function getUserByNumber(sheets, spreadsheetId, userNumber) {
  const found = await findUserRow(sheets, spreadsheetId, userNumber);
  if (!found) return null;

  const row = found.row || [];
  return {
    name: row[0] || '',
    userNumber: row[1] || '',
    role: row[2] || '',
    email: row[4] || '',
  };
}

/**
 * NEW: Update the Email (column E) for a user (CP profile save)
 */
export async function updateUserEmailByNumber(sheets, spreadsheetId, userNumber, email) {
  const found = await findUserRow(sheets, spreadsheetId, userNumber);
  if (!found) {
    const err = new Error('User not found!');
    err.status = 404;
    throw err;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Users!E${found.rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[email || '']] },
  });

  // return updated user shape (optional but helpful)
  const row = found.row || [];
  return {
    name: row[0] || '',
    userNumber: row[1] || '',
    role: row[2] || '',
    email: email || '',
  };
}