import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const cookieStore = await cookies();
  const userId = cookieStore.get('link_user_id')?.value;
  cookieStore.delete('link_user_id');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=oauth_cancelled`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=no_code`
    );
  }

  if (!userId) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=session_expired`
    );
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/link-youtube/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();

    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=userinfo_failed`
      );
    }

    const userInfo = await userInfoResponse.json();

    // Check if this Google account is already linked to another user
    const { data: existingAccount } = await supabase
      .from('Account')
      .select('*')
      .eq('provider', 'google')
      .eq('providerAccountId', userInfo.id)
      .single();

    if (existingAccount && existingAccount.userId !== userId) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=account_already_linked`
      );
    }

    if (existingAccount) {
      // Update existing account
      await supabase
        .from('Account')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: tokens.expires_in
            ? Math.floor(Date.now() / 1000) + tokens.expires_in
            : null,
          token_type: tokens.token_type,
          scope: tokens.scope,
          id_token: tokens.id_token,
        })
        .eq('id', existingAccount.id);
    } else {
      // Create new account
      await supabase.from('Account').insert({
        id: generateId(),
        userId,
        type: 'oauth',
        provider: 'google',
        providerAccountId: userInfo.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : null,
        token_type: tokens.token_type,
        scope: tokens.scope,
        id_token: tokens.id_token,
      });
    }

    // Update user email if not set
    await supabase
      .from('User')
      .update({
        email: userInfo.email,
        image: userInfo.picture,
      })
      .eq('id', userId);

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?youtube=connected`
    );
  } catch (error) {
    console.error('Error linking YouTube account:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=link_failed`
    );
  }
}
