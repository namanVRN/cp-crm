import { NextResponse } from 'next/server';
import { getCalendarOAuthClient } from '@/lib/google';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cpNumber = searchParams.get('cpNumber');

  if (!cpNumber) {
    return NextResponse.json({ error: 'cpNumber is required' }, { status: 400 });
  }

  const oauth2Client = getCalendarOAuthClient();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: cpNumber, 
  });

  return NextResponse.redirect(authUrl);
}