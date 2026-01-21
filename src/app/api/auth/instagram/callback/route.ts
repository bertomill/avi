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
  const userId = cookieStore.get('link_instagram_user_id')?.value;
  cookieStore.delete('link_instagram_user_id');

  if (error) {
    console.error('Instagram OAuth error:', error, searchParams.get('error_description'));
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
    // Build redirect URI - must match exactly what was used in OAuth request
    const baseUrl = (process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
    const redirectUri = `${baseUrl}/api/auth/instagram/callback`;

    const clientId = process.env.INSTAGRAM_APP_ID || '';
    const clientSecret = process.env.INSTAGRAM_APP_SECRET || '';

    console.log('Token exchange redirect_uri:', redirectUri);

    // Exchange code for short-lived access token using Instagram API
    const formData = new URLSearchParams();
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    formData.append('grant_type', 'authorization_code');
    formData.append('redirect_uri', redirectUri);
    formData.append('code', code);

    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Instagram token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=instagram_token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();
    const shortLivedToken = tokens.access_token;
    const instagramUserId = tokens.user_id?.toString();

    console.log('Got short-lived token for user:', instagramUserId);

    // Exchange for long-lived token (valid for 60 days)
    const longLivedResponse = await fetch(
      `https://graph.instagram.com/access_token?` +
      `grant_type=ig_exchange_token` +
      `&client_secret=${clientSecret}` +
      `&access_token=${shortLivedToken}`
    );

    let finalAccessToken = shortLivedToken;
    let expiresIn = 3600; // default 1 hour for short-lived

    if (longLivedResponse.ok) {
      const longLivedData = await longLivedResponse.json();
      finalAccessToken = longLivedData.access_token;
      expiresIn = longLivedData.expires_in || 5184000; // 60 days
      console.log('Exchanged for long-lived token, expires in:', expiresIn);
    } else {
      console.error('Failed to get long-lived token:', await longLivedResponse.text());
    }

    // Get Instagram user profile to verify
    const profileResponse = await fetch(
      `https://graph.instagram.com/me?fields=user_id,username&access_token=${finalAccessToken}`
    );

    let instagramAccountId = instagramUserId;
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      instagramAccountId = profile.user_id || profile.id || instagramUserId;
      console.log('Instagram profile:', profile);
    }

    if (!instagramAccountId) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=instagram_no_account_id`
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
          access_token: finalAccessToken,
          expires_at: Math.floor(Date.now() / 1000) + expiresIn,
          token_type: 'bearer',
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
        access_token: finalAccessToken,
        expires_at: Math.floor(Date.now() / 1000) + expiresIn,
        token_type: 'bearer',
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
