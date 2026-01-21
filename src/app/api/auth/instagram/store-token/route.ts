import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: 'No Instagram token in env' }, { status: 400 });
  }

  try {
    // Verify token and get user info
    const response = await fetch(
      `https://graph.instagram.com/me?fields=user_id,username&access_token=${accessToken}`
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const profile = await response.json();
    const instagramAccountId = profile.user_id || profile.id;

    // Check if already linked
    const { data: existingAccount } = await supabase
      .from('Account')
      .select('*')
      .eq('provider', 'instagram')
      .eq('providerAccountId', instagramAccountId)
      .single();

    if (existingAccount) {
      // Update existing
      await supabase
        .from('Account')
        .update({
          access_token: accessToken,
          expires_at: Math.floor(Date.now() / 1000) + 5184000, // 60 days
          token_type: 'bearer',
        })
        .eq('id', existingAccount.id);
    } else {
      // Create new
      await supabase.from('Account').insert({
        id: generateId(),
        userId: session.user.id,
        type: 'oauth',
        provider: 'instagram',
        providerAccountId: instagramAccountId,
        access_token: accessToken,
        expires_at: Math.floor(Date.now() / 1000) + 5184000,
        token_type: 'bearer',
      });
    }

    return NextResponse.json({
      success: true,
      username: profile.username,
      message: 'Instagram connected!'
    });
  } catch (error) {
    console.error('Error storing Instagram token:', error);
    return NextResponse.json({ error: 'Failed to store token' }, { status: 500 });
  }
}
