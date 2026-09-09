import { google } from 'googleapis';

// ---- Existing functions ----

export function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export function getCalendarOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/api/auth/callback'  // ← hardcoded for local test
  );
}

// ---- NEW helper: build a Calendar client for a specific CP ----

/**
 * Fetch the stored refresh token for a CP and return an authenticated Calendar client.
 * Returns null if no token is found.
 */
export async function getCalendarClientForCP(cpNumber) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const tabName = 'CP_TOKENS';

  // Read all rows (we only need A and B)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:B`,
  });
  const rows = res.data.values || [];
  let refreshToken = null;
  for (const row of rows) {
    if (row[0] === cpNumber) {
      refreshToken = row[1];
      break;
    }
  }
  if (!refreshToken) return null;

  const oauth2Client = getCalendarOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}