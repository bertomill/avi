import { TikTokUserData, TikTokVideoData, TikTokAnalytics } from '@/types';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export async function getTikTokUserInfo(accessToken: string): Promise<TikTokUserData | null> {
  try {
    const response = await fetch(
      `${TIKTOK_API_BASE}/user/info/?fields=open_id,union_id,display_name,avatar_url,bio_description,profile_deep_link,follower_count,following_count,likes_count,video_count`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch TikTok user info:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.error?.code !== 'ok' && data.error?.code) {
      console.error('TikTok API error:', data.error);
      return null;
    }

    return data.data?.user || null;
  } catch (error) {
    console.error('Error fetching TikTok user info:', error);
    return null;
  }
}

export async function getTikTokVideos(
  accessToken: string,
  maxCount: number = 20
): Promise<TikTokVideoData[]> {
  try {
    const response = await fetch(
      `${TIKTOK_API_BASE}/video/list/?fields=id,title,cover_image_url,video_description,duration,create_time,share_url,view_count,like_count,comment_count,share_count`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_count: maxCount,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch TikTok videos:', response.status, errorText);
      return [];
    }

    const data = await response.json();

    if (data.error?.code !== 'ok' && data.error?.code) {
      console.error('TikTok API error:', data.error);
      return [];
    }

    return data.data?.videos || [];
  } catch (error) {
    console.error('Error fetching TikTok videos:', error);
    return [];
  }
}

export async function getTikTokAnalytics(accessToken: string): Promise<TikTokAnalytics | null> {
  try {
    const user = await getTikTokUserInfo(accessToken);
    if (!user) return null;

    const videos = await getTikTokVideos(accessToken, 20);

    // Calculate recent performance from videos
    const recentVideos = videos.slice(0, 10);
    const recentPerformance = {
      totalViews: recentVideos.reduce((sum, v) => sum + (v.view_count || 0), 0),
      totalLikes: recentVideos.reduce((sum, v) => sum + (v.like_count || 0), 0),
      totalComments: recentVideos.reduce((sum, v) => sum + (v.comment_count || 0), 0),
      totalShares: recentVideos.reduce((sum, v) => sum + (v.share_count || 0), 0),
      avgViewsPerVideo: recentVideos.length
        ? Math.round(recentVideos.reduce((sum, v) => sum + (v.view_count || 0), 0) / recentVideos.length)
        : 0,
    };

    // Get top videos by view count
    const topVideos = [...videos]
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 5);

    return {
      user,
      videos,
      recentPerformance,
      topVideos,
    };
  } catch (error) {
    console.error('Error fetching TikTok analytics:', error);
    return null;
  }
}

export async function refreshTikTokToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  try {
    const response = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY || '',
        client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('Failed to refresh TikTok token:', response.status);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error refreshing TikTok token:', error);
    return null;
  }
}
