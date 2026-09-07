import { NextResponse } from 'next/server';
import { getCalendarOAuthClient } from '@/lib/google';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const cpNumber = searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  try {
    const oauth2Client = getCalendarOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    
    // TODO: Build the logic to save `tokens.refresh_token` to your Users database row
    console.log(`Save this refresh token for CP ${cpNumber}:`, tokens.refresh_token);

    // Redirect the user back to the main dashboard page
    return NextResponse.redirect(new URL('/?calendar=success', request.url));
  } catch (error) {
    return NextResponse.json({ error: 'Authentication failed', details: error.message }, { status: 500 });
  }
}