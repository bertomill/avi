import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { getUserData } from '@/lib/x';

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const cookieStore = await cookies();
  const userId = cookieStore.get('link_x_user_id')?.value;
  const codeVerifier = cookieStore.get('x_code_verifier')?.value;
  const storedState = cookieStore.get('x_oauth_state')?.value;

  // Clean up cookies immediately
  cookieStore.delete('link_x_user_id');
  cookieStore.delete('x_code_verifier');
  cookieStore.delete('x_oauth_state');

  // Validate state (CSRF protection)
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=x_invalid_state`
    );
  }

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=x_oauth_cancelled`
    );
  }

  if (!code || !codeVerifier) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=x_no_code`
    );
  }

  if (!userId) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=x_session_expired`
    );
  }

  try {
    // X requires Basic auth header for token exchange
    const credentials = Buffer.from(
      `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
    ).toString('base64');

    console.log('X OAuth callback - exchanging code for tokens...');

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/link-x/callback`,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('X token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=x_token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();
    console.log('X OAuth - tokens received, fetching user data...');

    // Get user info from X API
    const userData = await getUserData(tokens.access_token);
    console.log('X OAuth - user data:', userData?.username);

    if (!userData) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=x_user_fetch_failed`
      );
    }

    // Check if this X account is already linked to another user
    const { data: existingAccount } = await supabase
      .from('Account')
      .select('*')
      .eq('provider', 'x')
      .eq('providerAccountId', userData.id)
      .single();

    if (existingAccount && existingAccount.userId !== userId) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=x_account_already_linked`
      );
    }

    const accountData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: tokens.expires_in
        ? Math.floor(Date.now() / 1000) + tokens.expires_in
        : null,
      token_type: tokens.token_type,
      scope: tokens.scope,
    };

    if (existingAccount) {
      // Update existing account
      console.log('X OAuth - updating existing account:', existingAccount.id);
      const { error: updateError } = await supabase
        .from('Account')
        .update(accountData)
        .eq('id', existingAccount.id);
      if (updateError) {
        console.error('X OAuth - update error:', updateError);
      }
    } else {
      // Create new account
      const newAccountId = generateId();
      console.log('X OAuth - creating new account for userId:', userId, 'accountId:', newAccountId);
      const { error: insertError } = await supabase.from('Account').insert({
        id: newAccountId,
        userId,
        type: 'oauth',
        provider: 'x',
        providerAccountId: userData.id,
        ...accountData,
      });
      if (insertError) {
        console.error('X OAuth - insert error:', insertError);
      }
    }

    console.log('X OAuth - complete, redirecting to dashboard');
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?x=connected`
    );
  } catch (error) {
    console.error('Error linking X account:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=x_link_failed`
    );
  }
}
