import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFullAnalyticsByChannelId } from '@/lib/youtube';
import { supabase } from '@/lib/supabase';
import { YouTubeAnalytics } from '@/types';

// Save YouTube data to Supabase
async function syncToDatabase(userId: string, analytics: YouTubeAnalytics) {
  try {
    const { channel, videos } = analytics;

    // Upsert channel data
    await supabase
      .from('YouTubeChannel')
      .upsert({
        id: channel.id,
        userId,
        title: channel.title,
        description: channel.description,
        customUrl: channel.customUrl,
        thumbnailUrl: channel.thumbnailUrl,
        subscriberCount: channel.subscriberCount,
        videoCount: channel.videoCount,
        viewCount: channel.viewCount,
        publishedAt: channel.publishedAt || null,
        lastSyncedAt: new Date().toISOString(),
      }, { onConflict: 'id' });

    // Upsert videos data
    if (videos.length > 0) {
      const videoRecords = videos.map(video => ({
        id: video.id,
        channelId: channel.id,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt || null,
        duration: video.duration,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        lastSyncedAt: new Date().toISOString(),
      }));

      await supabase
        .from('YouTubeVideo')
        .upsert(videoRecords, { onConflict: 'id' });
    }

    console.log(`Synced ${videos.length} videos to database for channel ${channel.title}`);
  } catch (error) {
    console.error('Error syncing to database:', error);
    // Don't throw - we still want to return the data even if sync fails
  }
}

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

    // Sync to database in background
    syncToDatabase(session.user.id, analytics);

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

    // Re-fetch analytics and sync to database
    const analytics = await getFullAnalyticsByChannelId(user.youtubeChannelId);

    if (analytics) {
      await syncToDatabase(session.user.id, analytics);
    }

    return NextResponse.json({ success: true, message: 'Data synced to database', analytics });
  } catch (error) {
    console.error('YouTube sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync YouTube data' },
      { status: 500 }
    );
  }
}
