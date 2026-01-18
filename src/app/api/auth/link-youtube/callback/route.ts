import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Get the stored user ID from cookie
  const cookieStore = await cookies();
  const userId = cookieStore.get('link_user_id')?.value;

  // Clear the cookie
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
    // Exchange code for tokens
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

    // Get user info from Google
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
    const existingAccount = await prisma.account.findFirst({
      where: {
        provider: 'google',
        providerAccountId: userInfo.id,
      },
    });

    if (existingAccount && existingAccount.userId !== userId) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard?error=account_already_linked`
      );
    }

    // Upsert the account (create or update)
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: userInfo.id,
        },
      },
      update: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        expires_at: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : undefined,
        token_type: tokens.token_type,
        scope: tokens.scope,
        id_token: tokens.id_token,
      },
      create: {
        userId,
        type: 'oauth',
        provider: 'google',
        providerAccountId: userInfo.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : undefined,
        token_type: tokens.token_type,
        scope: tokens.scope,
        id_token: tokens.id_token,
      },
    });

    // Update user email if not set
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: userInfo.email,
        image: userInfo.picture,
      },
    });

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
