import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Build redirect URI - ensure consistency
  const baseUrl = (process.env.NEXTAUTH_URL || '').replace(/\/$/, ''); // Remove trailing slash
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;
  const isHttps = baseUrl.startsWith('https');

  console.log('OAuth redirect_uri:', redirectUri);

  // Store the user ID in a cookie for the callback
  const cookieStore = await cookies();
  cookieStore.set('link_instagram_user_id', session.user.id, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  // Use Instagram Login (direct Instagram OAuth)
  const clientId = process.env.INSTAGRAM_APP_ID;

  // Scopes for Instagram API with Instagram Login
  // instagram_business_basic: Read profile info, media, and account data
  // instagram_business_content_publish: Publish content (optional, for future use)
  const scope = encodeURIComponent('instagram_business_basic,instagram_business_content_publish');

  const instagramAuthUrl =
    `https://www.instagram.com/oauth/authorize?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scope}` +
    `&response_type=code` +
    `&enable_fb_login=0`;

  return NextResponse.redirect(instagramAuthUrl);
}
