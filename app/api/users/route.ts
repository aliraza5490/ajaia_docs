import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const users = getAllUsers();
    const currentUser = await getCurrentUser();
    return NextResponse.json({ users, currentUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const response = NextResponse.json({ success: true, userId });
    response.cookies.set('ajaia_user_id', userId, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
