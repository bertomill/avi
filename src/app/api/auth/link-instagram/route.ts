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
  cookieStore.set('link_instagram_user_id', session.user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  // Build Facebook OAuth URL for Instagram
  const clientId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/link-instagram/callback`;

  // Scopes needed for Instagram Business Account access
  // - instagram_basic: Basic profile info
  // - instagram_manage_insights: Access to insights (optional for business accounts)
  // - pages_show_list: Required to access Instagram business account via Facebook Page
  // - pages_read_engagement: Read page engagement data
  const scope = encodeURIComponent(
    'instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement'
  );

  const facebookAuthUrl =
    `https://www.facebook.com/v19.0/dialog/oauth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scope}` +
    `&response_type=code`;

  return NextResponse.redirect(facebookAuthUrl);
}
