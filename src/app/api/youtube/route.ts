import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFullAnalytics } from '@/lib/youtube';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: account } = await supabase
      .from('Account')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'google')
      .single();

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'No YouTube account connected' },
        { status: 400 }
      );
    }

    const analytics = await getFullAnalytics(account.access_token);

    if (!analytics) {
      return NextResponse.json(
        { error: 'Could not fetch YouTube data' },
        { status: 500 }
      );
    }

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('YouTube API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch YouTube data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: account } = await supabase
      .from('Account')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'google')
      .single();

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'No YouTube account connected' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Data synced' });
  } catch (error) {
    console.error('YouTube sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync YouTube data' },
      { status: 500 }
    );
  }
}
