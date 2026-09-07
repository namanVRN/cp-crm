import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { requireAdmin } from '@/lib/auth';
import { deleteUserByNumber, resetUserPassword } from '@/lib/users';

export async function DELETE(request, { params }) {
  try {
    const session = await requireAdmin(request);
    const { number } = await params;

    if (number === session.userNumber) {
      return NextResponse.json({ success: false, message: 'Cannot delete yourself!' }, { status: 400 });
    }

    const sheets = getSheetsClient();
    await deleteUserByNumber(sheets, process.env.SPREADSHEET_ID, number);
    return NextResponse.json({ success: true, message: 'User deleted!' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    await requireAdmin(request);
    const { number } = await params;
    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ success: false, message: 'Password must be at least 4 characters!' }, { status: 400 });
    }

    const sheets = getSheetsClient();
    await resetUserPassword(sheets, process.env.SPREADSHEET_ID, number, newPassword);
    return NextResponse.json({ success: true, message: 'Password reset!' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message || String(error) }, { status: error.status || 500 });
  }
}