import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// Generate a random code verifier for PKCE
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Generate code challenge from verifier (SHA256, base64url encoded)
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Store the user ID in a cookie for the callback
  // Using sameSite: 'none' with secure: true for cross-site OAuth redirects
  const cookieStore = await cookies();
  const isHttps = process.env.NEXTAUTH_URL?.startsWith('https');

  cookieStore.set('tiktok_link_user_id', session.user.id, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  // Generate a random state for CSRF protection
  const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
  cookieStore.set('tiktok_oauth_state', state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store code verifier in cookie for the callback
  cookieStore.set('tiktok_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  // Build TikTok OAuth URL
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const baseUrl = process.env.NEXTAUTH_URL?.trim();
  const redirectUri = `${baseUrl}/api/auth/link-tiktok/callback`;

  // TikTok scopes for reading user info and videos
  const scope = 'user.info.basic,user.info.profile,user.info.stats,video.list';

  const tiktokAuthUrl = `https://www.tiktok.com/v2/auth/authorize/?` +
    `client_key=${clientKey}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  return NextResponse.redirect(tiktokAuthUrl);
}
