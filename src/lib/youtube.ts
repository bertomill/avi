import { google } from 'googleapis';
import { YouTubeChannelData, YouTubeVideoData, YouTubeAnalytics } from '@/types';

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
