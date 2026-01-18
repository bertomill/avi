import { google } from 'googleapis';
import { YouTubeChannelData, YouTubeVideoData, YouTubeAnalytics } from '@/types';

// API Key client for public data (no OAuth needed)
export function getYouTubeApiKeyClient() {
  return google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY,
  });
}

// OAuth client (kept for backward compatibility)
export async function getYouTubeClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({ access_token: accessToken });

  return google.youtube({
    version: 'v3',
    auth: oauth2Client,
  });
}

// Extract channel ID from various YouTube URL formats
export function extractChannelIdentifier(input: string): { type: 'id' | 'username' | 'handle'; value: string } | null {
  const trimmed = input.trim();

  // Direct channel ID (starts with UC)
  if (trimmed.startsWith('UC') && trimmed.length === 24) {
    return { type: 'id', value: trimmed };
  }

  // YouTube URL patterns
  const patterns = [
    // https://www.youtube.com/channel/UC...
    /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/,
    // https://www.youtube.com/@handle
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
    // https://www.youtube.com/c/customname or /user/username
    /youtube\.com\/(?:c|user)\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const value = match[1];
      if (value.startsWith('UC') && value.length === 24) {
        return { type: 'id', value };
      }
      if (trimmed.includes('/@')) {
        return { type: 'handle', value };
      }
      return { type: 'username', value };
    }
  }

  // Assume it's a handle if starts with @
  if (trimmed.startsWith('@')) {
    return { type: 'handle', value: trimmed.substring(1) };
  }

  // Assume it's a username/handle otherwise
  if (trimmed.length > 0 && !trimmed.includes(' ')) {
    return { type: 'handle', value: trimmed };
  }

  return null;
}

// Resolve channel identifier to channel ID
export async function resolveChannelId(identifier: { type: 'id' | 'username' | 'handle'; value: string }): Promise<string | null> {
  const youtube = getYouTubeApiKeyClient();

  try {
    if (identifier.type === 'id') {
      return identifier.value;
    }

    if (identifier.type === 'handle') {
      // Search for channel by handle
      const response = await youtube.search.list({
        part: ['snippet'],
        q: `@${identifier.value}`,
        type: ['channel'],
        maxResults: 1,
      });

      return response.data.items?.[0]?.snippet?.channelId || null;
    }

    // Username lookup
    const response = await youtube.channels.list({
      part: ['id'],
      forUsername: identifier.value,
    });

    return response.data.items?.[0]?.id || null;
  } catch (error) {
    console.error('Error resolving channel ID:', error);
    return null;
  }
}

// Get channel data by channel ID (public data, no OAuth)
export async function getChannelDataById(channelId: string): Promise<YouTubeChannelData | null> {
  try {
    const youtube = getYouTubeApiKeyClient();

    const response = await youtube.channels.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: [channelId],
    });

    const channel = response.data.items?.[0];
    if (!channel) return null;

    return {
      id: channel.id!,
      title: channel.snippet?.title || '',
      description: channel.snippet?.description || '',
      customUrl: channel.snippet?.customUrl || '',
      publishedAt: channel.snippet?.publishedAt || '',
      thumbnailUrl: channel.snippet?.thumbnails?.high?.url || '',
      subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
      videoCount: parseInt(channel.statistics?.videoCount || '0'),
      viewCount: parseInt(channel.statistics?.viewCount || '0'),
    };
  } catch (error) {
    console.error('Error fetching channel data by ID:', error);
    throw error;
  }
}

// Get channel videos by channel ID (public data, no OAuth)
export async function getChannelVideosById(
  channelId: string,
  maxResults: number = 50
): Promise<YouTubeVideoData[]> {
  try {
    const youtube = getYouTubeApiKeyClient();

    // First get the uploads playlist ID
    const channelResponse = await youtube.channels.list({
      part: ['contentDetails'],
      id: [channelId],
    });

    const uploadsPlaylistId =
      channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) return [];

    const playlistResponse = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults,
    });

    const videoIds = playlistResponse.data.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter(Boolean) as string[];

    if (!videoIds.length) return [];

    const videosResponse = await youtube.videos.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: videoIds,
    });

    return (
      videosResponse.data.items?.map((video) => ({
        id: video.id!,
        title: video.snippet?.title || '',
        description: video.snippet?.description || '',
        publishedAt: video.snippet?.publishedAt || '',
        thumbnailUrl: video.snippet?.thumbnails?.high?.url || '',
        duration: video.contentDetails?.duration || '',
        viewCount: parseInt(video.statistics?.viewCount || '0'),
        likeCount: parseInt(video.statistics?.likeCount || '0'),
        commentCount: parseInt(video.statistics?.commentCount || '0'),
      })) || []
    );
  } catch (error) {
    console.error('Error fetching videos by channel ID:', error);
    throw error;
  }
}

// Get full analytics by channel ID (public data)
export async function getFullAnalyticsByChannelId(channelId: string): Promise<YouTubeAnalytics | null> {
  try {
    const channel = await getChannelDataById(channelId);
    if (!channel) return null;

    const videos = await getChannelVideosById(channelId, 50);

    const recentVideos = videos.slice(0, 10);
    const recentPerformance = {
      totalViews: recentVideos.reduce((sum, v) => sum + v.viewCount, 0),
      totalLikes: recentVideos.reduce((sum, v) => sum + v.likeCount, 0),
      totalComments: recentVideos.reduce((sum, v) => sum + v.commentCount, 0),
      avgViewsPerVideo: recentVideos.length
        ? Math.round(recentVideos.reduce((sum, v) => sum + v.viewCount, 0) / recentVideos.length)
        : 0,
    };

    const topVideos = [...videos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5);

    return {
      channel,
      videos,
      recentPerformance,
      topVideos,
    };
  } catch (error) {
    console.error('Error fetching analytics by channel ID:', error);
    throw error;
  }
}

export async function getChannelData(accessToken: string): Promise<YouTubeChannelData | null> {
  try {
    const youtube = await getYouTubeClient(accessToken);

    const response = await youtube.channels.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      mine: true,
    });

    const channel = response.data.items?.[0];
    if (!channel) return null;

    return {
      id: channel.id!,
      title: channel.snippet?.title || '',
      description: channel.snippet?.description || '',
      customUrl: channel.snippet?.customUrl || '',
      publishedAt: channel.snippet?.publishedAt || '',
      thumbnailUrl: channel.snippet?.thumbnails?.high?.url || '',
      subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
      videoCount: parseInt(channel.statistics?.videoCount || '0'),
      viewCount: parseInt(channel.statistics?.viewCount || '0'),
    };
  } catch (error) {
    console.error('Error fetching channel data:', error);
    throw error;
  }
}

export async function getChannelVideos(
  accessToken: string,
  maxResults: number = 50
): Promise<YouTubeVideoData[]> {
  try {
    const youtube = await getYouTubeClient(accessToken);

    const channelResponse = await youtube.channels.list({
      part: ['contentDetails'],
      mine: true,
    });

    const uploadsPlaylistId =
      channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) return [];

    const playlistResponse = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults,
    });

    const videoIds = playlistResponse.data.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter(Boolean) as string[];

    if (!videoIds.length) return [];

    const videosResponse = await youtube.videos.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: videoIds,
    });

    return (
      videosResponse.data.items?.map((video) => ({
        id: video.id!,
        title: video.snippet?.title || '',
        description: video.snippet?.description || '',
        publishedAt: video.snippet?.publishedAt || '',
        thumbnailUrl: video.snippet?.thumbnails?.high?.url || '',
        duration: video.contentDetails?.duration || '',
        viewCount: parseInt(video.statistics?.viewCount || '0'),
        likeCount: parseInt(video.statistics?.likeCount || '0'),
        commentCount: parseInt(video.statistics?.commentCount || '0'),
      })) || []
    );
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
}

export async function getFullAnalytics(accessToken: string): Promise<YouTubeAnalytics | null> {
  try {
    const channel = await getChannelData(accessToken);
    if (!channel) return null;

    const videos = await getChannelVideos(accessToken, 50);

    const recentVideos = videos.slice(0, 10);
    const recentPerformance = {
      totalViews: recentVideos.reduce((sum, v) => sum + v.viewCount, 0),
      totalLikes: recentVideos.reduce((sum, v) => sum + v.likeCount, 0),
      totalComments: recentVideos.reduce((sum, v) => sum + v.commentCount, 0),
      avgViewsPerVideo: recentVideos.length
        ? Math.round(recentVideos.reduce((sum, v) => sum + v.viewCount, 0) / recentVideos.length)
        : 0,
    };

    const topVideos = [...videos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5);

    return {
      channel,
      videos,
      recentPerformance,
      topVideos,
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
}
