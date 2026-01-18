import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFullAnalyticsByChannelId } from '@/lib/youtube';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's YouTube channel ID
    const { data: user } = await supabase
      .from('User')
      .select('youtubeChannelId')
      .eq('id', session.user.id)
      .single();

    if (!user?.youtubeChannelId) {
      return NextResponse.json(
        { error: 'No YouTube channel connected' },
        { status: 400 }
      );
    }

    const analytics = await getFullAnalyticsByChannelId(user.youtubeChannelId);

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

    // Get user's YouTube channel ID
    const { data: user } = await supabase
      .from('User')
      .select('youtubeChannelId')
      .eq('id', session.user.id)
      .single();

    if (!user?.youtubeChannelId) {
      return NextResponse.json(
        { error: 'No YouTube channel connected' },
        { status: 400 }
      );
    }

    // Re-fetch analytics (acts as a refresh)
    const analytics = await getFullAnalyticsByChannelId(user.youtubeChannelId);

    return NextResponse.json({ success: true, message: 'Data refreshed', analytics });
  } catch (error) {
    console.error('YouTube sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync YouTube data' },
      { status: 500 }
    );
  }
}
