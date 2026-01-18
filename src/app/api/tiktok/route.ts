import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getTikTokAnalytics, refreshTikTokToken } from '@/lib/tiktok';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get TikTok account from database
    const { data: account, error } = await supabase
      .from('Account')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'tiktok')
      .single();

    if (error || !account) {
      return NextResponse.json(
        { error: 'No TikTok account connected' },
        { status: 404 }
      );
    }

    let accessToken = account.access_token;

    // Check if token is expired
    if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000)) {
      if (account.refresh_token) {
        // Try to refresh the token
        const newTokens = await refreshTikTokToken(account.refresh_token);

        if (newTokens) {
          // Update tokens in database
          await supabase
            .from('Account')
            .update({
              access_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token,
              expires_at: Math.floor(Date.now() / 1000) + newTokens.expires_in,
            })
            .eq('id', account.id);

          accessToken = newTokens.access_token;
        } else {
          return NextResponse.json(
            { error: 'TikTok token expired. Please reconnect your account.' },
            { status: 401 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'TikTok token expired. Please reconnect your account.' },
          { status: 401 }
        );
      }
    }

    // Fetch analytics from TikTok
    const analytics = await getTikTokAnalytics(accessToken);

    if (!analytics) {
      return NextResponse.json(
        { error: 'Failed to fetch TikTok analytics' },
        { status: 500 }
      );
    }

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching TikTok analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TikTok analytics' },
      { status: 500 }
    );
  }
}

export async function POST() {
  // POST can be used to force a sync/refresh
  return GET();
}
