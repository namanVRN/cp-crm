import { NextResponse } from 'next/server';
import { getCalendarOAuthClient, getSheetsClient } from '@/lib/google';
import { google } from 'googleapis';

// ---- Helper: upsert refresh token into CP_TOKENS sheet ----
async function upsertRefreshToken(cpNumber, refreshToken, email) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const tabName = 'CP_TOKENS';

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:A`,
  });
  const rows = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === cpNumber) {
      rowIndex = i + 1;
      break;
    }
  }

  const now = new Date().toISOString();
  const values = [[cpNumber, refreshToken, email || '', now]];

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A:D`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A${rowIndex}:D${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  }
}
// ----------------------------------------------------------

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const cpNumber = searchParams.get('state');

  if (error) {
    console.error('OAuth error from Google:', error);
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('calendar', 'error');
    redirectUrl.searchParams.set('message', error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  try {
    const oauth2Client = getCalendarOAuthClient();
    
    // ✅ DYNAMIC FIX: Automatically detect localhost or Vercel
    const url = new URL(request.url);
    const redirectUri = `${url.protocol}//${url.host}/api/auth/callback`;

    // Exchange code with the exact same dynamic redirect URI
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: redirectUri
    });
    
    oauth2Client.setCredentials(tokens);

    // Get user's email
    let email = '';
    try {
      if (tokens.id_token) {
        const ticket = await oauth2Client.verifyIdToken({
          idToken: tokens.id_token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        email = payload.email || '';
      } else if (tokens.access_token) {
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userinfo = await oauth2.userinfo.get();
        email = userinfo.data.email || '';
      }
    } catch (emailError) {
      console.warn('Could not retrieve user email:', emailError.message);
    }

    // Save refresh token
    if (tokens.refresh_token) {
      await upsertRefreshToken(cpNumber, tokens.refresh_token, email);
      console.log(`✅ Refresh token saved for CP ${cpNumber}`);
    } else {
      console.warn(`⚠️ No refresh_token received for CP ${cpNumber}`);
    }

    // Redirect to dashboard with success
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('calendar', 'success');
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('calendar', 'error');
    redirectUrl.searchParams.set('message', 'Authentication failed. Please try again.');
    return NextResponse.redirect(redirectUrl);
  }
}