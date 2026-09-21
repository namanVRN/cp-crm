import { NextResponse } from 'next/server';
import { getCalendarOAuthClient } from '@/lib/google';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cpNumber = searchParams.get('cpNumber');

  if (!cpNumber) {
    return NextResponse.json({ error: 'cpNumber is required' }, { status: 400 });
  }

  const oauth2Client = getCalendarOAuthClient();

  // ✅ DYNAMIC FIX: Automatically detect localhost or Vercel
  const url = new URL(request.url);
  const redirectUri = `${url.protocol}//${url.host}/api/auth/callback`;

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: cpNumber,
    redirect_uri: redirectUri, // Force Google to use the correct URL
  });

  return NextResponse.redirect(authUrl);
}