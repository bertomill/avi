import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getTikTokAnalytics, refreshTikTokToken } from '@/lib/tiktok';
import { TikTokAnalytics } from '@/types';

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Sync TikTok data to Supabase
async function syncTikTokToDatabase(
  userId: string,
  analytics: TikTokAnalytics
): Promise<void> {
  const { user, videos } = analytics;

  // Upsert TikTok account data
  const { data: existingAccount } = await supabase
    .from('TikTokAccount')
    .select('id')
    .eq('userId', userId)
    .single();

  const accountId = existingAccount?.id || generateId();

  if (existingAccount) {
    // Update existing account
    await supabase
      .from('TikTokAccount')
      .update({
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bioDescription: user.bio_description,
        followerCount: user.follower_count || 0,
        followingCount: user.following_count || 0,
        likesCount: user.likes_count || 0,
        videoCount: user.video_count || 0,
        lastSyncedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', accountId);
  } else {
    // Insert new account
    await supabase.from('TikTokAccount').insert({
      id: accountId,
      userId,
      openId: user.open_id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bioDescription: user.bio_description,
      followerCount: user.follower_count || 0,
      followingCount: user.following_count || 0,
      likesCount: user.likes_count || 0,
      videoCount: user.video_count || 0,
      lastSyncedAt: new Date().toISOString(),
    });
  }

  // Upsert videos
  for (const video of videos) {
    const { data: existingVideo } = await supabase
      .from('TikTokVideo')
      .select('id')
      .eq('accountId', accountId)
      .eq('tiktokVideoId', video.id)
      .single();

    const videoData = {
      title: video.title || '',
      description: video.video_description || '',
      coverImageUrl: video.cover_image_url || '',
      shareUrl: video.share_url || '',
      duration: video.duration || 0,
      viewCount: video.view_count || 0,
      likeCount: video.like_count || 0,
      commentCount: video.comment_count || 0,
      shareCount: video.share_count || 0,
      createTime: video.create_time
        ? new Date(video.create_time * 1000).toISOString()
        : null,
      updatedAt: new Date().toISOString(),
    };

    if (existingVideo) {
      await supabase
        .from('TikTokVideo')
        .update(videoData)
        .eq('id', existingVideo.id);
    } else {
      await supabase.from('TikTokVideo').insert({
        id: generateId(),
        accountId,
        tiktokVideoId: video.id,
        ...videoData,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

// Get cached TikTok data from database
async function getCachedTikTokData(userId: string): Promise<TikTokAnalytics | null> {
  const { data: account } = await supabase
    .from('TikTokAccount')
    .select('*')
    .eq('userId', userId)
    .single();

  if (!account) return null;

  const { data: videos } = await supabase
    .from('TikTokVideo')
    .select('*')
    .eq('accountId', account.id)
    .order('viewCount', { ascending: false });

  const videoList = (videos || []).map((v) => ({
    id: v.tiktokVideoId,
    title: v.title || '',
    cover_image_url: v.coverImageUrl || '',
    video_description: v.description || '',
    duration: v.duration || 0,
    create_time: v.createTime ? Math.floor(new Date(v.createTime).getTime() / 1000) : 0,
    share_url: v.shareUrl || '',
    view_count: v.viewCount || 0,
    like_count: v.likeCount || 0,
    comment_count: v.commentCount || 0,
    share_count: v.shareCount || 0,
  }));

  const recentVideos = [...videoList].sort((a, b) => b.create_time - a.create_time).slice(0, 10);
  const recentPerformance = {
    totalViews: recentVideos.reduce((sum, v) => sum + (v.view_count || 0), 0),
    totalLikes: recentVideos.reduce((sum, v) => sum + (v.like_count || 0), 0),
    totalComments: recentVideos.reduce((sum, v) => sum + (v.comment_count || 0), 0),
    totalShares: recentVideos.reduce((sum, v) => sum + (v.share_count || 0), 0),
    avgViewsPerVideo: recentVideos.length
      ? Math.round(recentVideos.reduce((sum, v) => sum + (v.view_count || 0), 0) / recentVideos.length)
      : 0,
  };

  return {
    user: {
      open_id: account.openId,
      display_name: account.displayName || '',
      avatar_url: account.avatarUrl || '',
      bio_description: account.bioDescription || '',
      follower_count: account.followerCount || 0,
      following_count: account.followingCount || 0,
      likes_count: account.likesCount || 0,
      video_count: account.videoCount || 0,
    },
    videos: videoList,
    recentPerformance,
    topVideos: videoList.slice(0, 5),
  };
}

// Check if data needs refresh (older than 1 hour)
async function needsRefresh(userId: string): Promise<boolean> {
  const { data: account } = await supabase
    .from('TikTokAccount')
    .select('lastSyncedAt')
    .eq('userId', userId)
    .single();

  if (!account?.lastSyncedAt) return true;

  const lastSync = new Date(account.lastSyncedAt);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  return lastSync < oneHourAgo;
}

// Get valid access token (refresh if needed)
async function getValidAccessToken(account: {
  id: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}): Promise<string | null> {
  let accessToken = account.access_token;

  // Check if token is expired
  if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000)) {
    if (account.refresh_token) {
      const newTokens = await refreshTikTokToken(account.refresh_token);

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
        return null;
      }
    } else {
      return null;
    }
  }

  return accessToken;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get TikTok OAuth account
    const { data: oauthAccount, error } = await supabase
      .from('Account')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'tiktok')
      .single();

    if (error || !oauthAccount) {
      return NextResponse.json(
        { error: 'No TikTok account connected' },
        { status: 404 }
      );
    }

    // Check if we have cached data and if it's fresh enough
    const shouldRefresh = await needsRefresh(session.user.id);

    if (!shouldRefresh) {
      // Return cached data
      const cachedData = await getCachedTikTokData(session.user.id);
      if (cachedData) {
        return NextResponse.json(cachedData);
      }
    }

    // Need to fetch fresh data
    const accessToken = await getValidAccessToken(oauthAccount);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'TikTok token expired. Please reconnect your account.' },
        { status: 401 }
      );
    }

    const analytics = await getTikTokAnalytics(accessToken);

    if (!analytics) {
      // Try to return cached data as fallback
      const cachedData = await getCachedTikTokData(session.user.id);
      if (cachedData) {
        return NextResponse.json(cachedData);
      }
      return NextResponse.json(
        { error: 'Failed to fetch TikTok analytics' },
        { status: 500 }
      );
    }

    // Save to database
    await syncTikTokToDatabase(session.user.id, analytics);

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
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get TikTok OAuth account
    const { data: oauthAccount, error } = await supabase
      .from('Account')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'tiktok')
      .single();

    if (error || !oauthAccount) {
      return NextResponse.json(
        { error: 'No TikTok account connected' },
        { status: 404 }
      );
    }

    const accessToken = await getValidAccessToken(oauthAccount);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'TikTok token expired. Please reconnect your account.' },
        { status: 401 }
      );
    }

    // Force fetch fresh data
    const analytics = await getTikTokAnalytics(accessToken);

    if (!analytics) {
      return NextResponse.json(
        { error: 'Failed to fetch TikTok analytics' },
        { status: 500 }
      );
    }

    // Save to database
    await syncTikTokToDatabase(session.user.id, analytics);

    return NextResponse.json({
      success: true,
      message: 'TikTok data synced successfully',
      analytics,
    });
  } catch (error) {
    console.error('Error syncing TikTok data:', error);
    return NextResponse.json(
      { error: 'Failed to sync TikTok data' },
      { status: 500 }
    );
  }
}
