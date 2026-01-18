import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const cookieStore = await cookies();
  const userId = cookieStore.get('tiktok_link_user_id')?.value;
  const savedState = cookieStore.get('tiktok_oauth_state')?.value;
  const codeVerifier = cookieStore.get('tiktok_code_verifier')?.value;

  // Clean up cookies
  cookieStore.delete('tiktok_link_user_id');
  cookieStore.delete('tiktok_oauth_state');
  cookieStore.delete('tiktok_code_verifier');

  if (error) {
    console.error('TikTok OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=tiktok_oauth_cancelled`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=tiktok_no_code`
    );
  }

  if (!userId) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=session_expired`
    );
  }

  // Verify state to prevent CSRF
  if (state !== savedState) {
    console.error('State mismatch:', { state, savedState });
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=tiktok_state_mismatch`
    );
  }

  if (!codeVerifier) {
    console.error('Missing code verifier');
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=tiktok_missing_verifier`
    );
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL?.trim();
    const redirectUri = `${baseUrl}/api/auth/link-tiktok/callback`;

    // Exchange code for access token (with PKCE code_verifier)
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY || '',
        client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('TikTok token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=tiktok_token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('TikTok token error:', tokenData);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=tiktok_token_error`
      );
    }

    const { access_token, refresh_token, expires_in, open_id, scope } = tokenData;

    // Fetch user info to get display name and profile
    const userInfoResponse = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,avatar_url,bio_description,follower_count,following_count,likes_count,video_count',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    let userInfo = { open_id };
    if (userInfoResponse.ok) {
      const userInfoData = await userInfoResponse.json();
      if (userInfoData.data?.user) {
        userInfo = userInfoData.data.user;
      }
    }

    // Check if this TikTok account is already linked to another user
    const { data: existingAccount } = await supabase
      .from('Account')
      .select('*')
      .eq('provider', 'tiktok')
      .eq('providerAccountId', open_id)
      .single();

    if (existingAccount && existingAccount.userId !== userId) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=tiktok_account_already_linked`
      );
    }

    if (existingAccount) {
      // Update existing account
      await supabase
        .from('Account')
        .update({
          access_token,
          refresh_token: refresh_token || null,
          expires_at: expires_in
            ? Math.floor(Date.now() / 1000) + expires_in
            : null,
          scope,
        })
        .eq('id', existingAccount.id);
    } else {
      // Create new account
      await supabase.from('Account').insert({
        id: generateId(),
        userId,
        type: 'oauth',
        provider: 'tiktok',
        providerAccountId: open_id,
        access_token,
        refresh_token,
        expires_at: expires_in
          ? Math.floor(Date.now() / 1000) + expires_in
          : null,
        scope,
      });
    }

    // Update user with TikTok info if available
    const updateData: Record<string, string> = {};
    if (userInfo && 'avatar_url' in userInfo && userInfo.avatar_url) {
      updateData.image = userInfo.avatar_url as string;
    }

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('User')
        .update(updateData)
        .eq('id', userId);
    }

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?tiktok=connected`
    );
  } catch (error) {
    console.error('Error linking TikTok account:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=tiktok_link_failed`
    );
  }
}
