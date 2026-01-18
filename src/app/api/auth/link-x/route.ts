import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/x';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  const cookieStore = await cookies();

  // Store user ID (same pattern as YouTube)
  cookieStore.set('link_x_user_id', session.user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  // Store PKCE code verifier (X-specific requirement)
  cookieStore.set('x_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  // Store state for CSRF verification
  cookieStore.set('x_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  const clientId = process.env.X_CLIENT_ID?.trim();
  const baseUrl = process.env.NEXTAUTH_URL?.trim();
  const redirectUri = `${baseUrl}/api/auth/link-x/callback`;

  // Required scopes: tweet.read, users.read, offline.access (for refresh token)
  const scope = encodeURIComponent('tweet.read users.read offline.access');

  const xAuthUrl =
    `https://twitter.com/i/oauth2/authorize?` +
    `response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scope}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  return NextResponse.redirect(xAuthUrl);
}
