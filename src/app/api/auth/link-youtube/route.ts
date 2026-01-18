import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Store the user ID in a cookie for the callback
  const cookieStore = await cookies();
  cookieStore.set('link_user_id', session.user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  // Build Google OAuth URL
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const baseUrl = process.env.NEXTAUTH_URL?.trim();
  const redirectUri = `${baseUrl}/api/auth/link-youtube/callback`;
  const scope = encodeURIComponent(
    'openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly'
  );

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return NextResponse.redirect(googleAuthUrl);
}
