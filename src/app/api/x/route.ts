import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFullAnalytics, refreshAccessToken } from '@/lib/x';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: account } = await supabase
      .from('Account')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'x')
      .single();

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'No X account connected' },
        { status: 400 }
      );
    }

    let accessToken = account.access_token;

    // Check if token needs refresh
    if (
      account.expires_at &&
      account.expires_at < Math.floor(Date.now() / 1000)
    ) {
      if (account.refresh_token) {
        const newTokens = await refreshAccessToken(account.refresh_token);
        if (newTokens) {
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
            { error: 'Token refresh failed. Please reconnect your X account.' },
            { status: 401 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Token expired. Please reconnect your X account.' },
          { status: 401 }
        );
      }
    }

    const analytics = await getFullAnalytics(accessToken);

    if (!analytics) {
      return NextResponse.json(
        { error: 'Could not fetch X data' },
        { status: 500 }
      );
    }

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('X API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch X data' },
      { status: 500 }
    );
  }
}
