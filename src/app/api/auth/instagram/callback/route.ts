import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { getInstagramAccountId } from '@/lib/instagram';

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const cookieStore = await cookies();
  const userId = cookieStore.get('link_instagram_user_id')?.value;
  cookieStore.delete('link_instagram_user_id');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=instagram_oauth_cancelled`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=instagram_no_code`
    );
  }

  if (!userId) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=instagram_session_expired`
    );
  }

  try {
    const tokenResponse = await fetch(
      'https://graph.facebook.com/v19.0/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: process.env.INSTAGRAM_APP_ID || '',
          client_secret: process.env.INSTAGRAM_APP_SECRET || '',
          redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/instagram/callback`,
          grant_type: 'authorization_code',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Instagram token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=instagram_token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    const instagramAccountId = await getInstagramAccountId(accessToken);

    if (!instagramAccountId) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=instagram_no_business_account`
      );
    }

    // Check if this Instagram account is already linked to another user
    const { data: existingAccount } = await supabase
      .from('Account')
      .select('*')
      .eq('provider', 'instagram')
      .eq('providerAccountId', instagramAccountId)
      .single();

    if (existingAccount && existingAccount.userId !== userId) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=instagram_account_already_linked`
      );
    }

    if (existingAccount) {
      // Update existing account
      await supabase
        .from('Account')
        .update({
          access_token: accessToken,
          expires_at: tokens.expires_in
            ? Math.floor(Date.now() / 1000) + tokens.expires_in
            : null,
          token_type: tokens.token_type || 'bearer',
        })
        .eq('id', existingAccount.id);
    } else {
      // Create new account
      await supabase.from('Account').insert({
        id: generateId(),
        userId,
        type: 'oauth',
        provider: 'instagram',
        providerAccountId: instagramAccountId,
        access_token: accessToken,
        expires_at: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : null,
        token_type: tokens.token_type || 'bearer',
      });
    }

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?instagram=connected`
    );
  } catch (error) {
    console.error('Error linking Instagram account:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard?error=instagram_link_failed`
    );
  }
}
