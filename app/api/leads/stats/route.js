import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { requireAuth } from '@/lib/auth';
import { getAllLeadsRaw, formatDateOnly } from '@/lib/leads';

export async function GET(request) {
  try {
    const session = await requireAuth(request);
    const sheets = getSheetsClient();
    const leads = await getAllLeadsRaw(sheets, process.env.SPREADSHEET_ID, session.role, session.userNumber);

    const today = formatDateOnly();
    const now = new Date();
    const stats = { totalLeads: leads.length, newLeads: 0, followUp1: 0, siteVisit: 0, followUp2: 0, dealWon: 0, dealLost: 0, todaysFollowUps: 0, overdueFollowUps: 0 };

    for (const lead of leads) {
      switch (lead.currentStage) {
        case 'New Lead': stats.newLeads++; break;
        case 'Follow Up 1': stats.followUp1++; break;
        case 'Site Visit': stats.siteVisit++; break;
        case 'Follow Up 2': stats.followUp2++; break;
        case 'Deal Won': stats.dealWon++; break;
        case 'Deal Lost': stats.dealLost++; break;
      }
      if (lead.nextFollowDate && lead.currentStage !== 'Deal Won' && lead.currentStage !== 'Deal Lost') {
        if (lead.nextFollowDate.substring(0, 10) === today) stats.todaysFollowUps++;
        const parts = lead.nextFollowDate.split(' ');
        if (parts.length === 2) {
          const [dd, mm, yyyy] = parts[0].split('/').map(Number);
          const [hh, min] = parts[1].split(':').map(Number);
          if (![dd, mm, yyyy, hh, min].some(isNaN)) {
            const followDateTime = new Date(yyyy, mm - 1, dd, hh, min);
            if (followDateTime < now) stats.overdueFollowUps++;
          }
        }
      }
    }

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}