import { InstagramAccountData, InstagramMediaData, InstagramAnalytics } from '@/types';

const INSTAGRAM_GRAPH_URL = 'https://graph.facebook.com/v19.0';

export async function getInstagramAccountId(accessToken: string): Promise<string | null> {
  try {
    const pagesResponse = await fetch(
      `${INSTAGRAM_GRAPH_URL}/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`
    );

    if (!pagesResponse.ok) {
      console.error('Failed to fetch Facebook pages:', await pagesResponse.text());
      return null;
    }

    const pagesData = await pagesResponse.json();

    for (const page of pagesData.data || []) {
      if (page.instagram_business_account?.id) {
        return page.instagram_business_account.id;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting Instagram account ID:', error);
    return null;
  }
}

export async function getAccountData(
  accountId: string,
  accessToken: string
): Promise<InstagramAccountData | null> {
  try {
    const response = await fetch(
      `${INSTAGRAM_GRAPH_URL}/${accountId}?fields=id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.error('Failed to fetch Instagram account:', await response.text());
      return null;
    }

    const data = await response.json();

    return {
      id: data.id,
      username: data.username || '',
      name: data.name || '',
      biography: data.biography || '',
      profilePictureUrl: data.profile_picture_url || '',
      followerCount: data.followers_count || 0,
      followingCount: data.follows_count || 0,
      mediaCount: data.media_count || 0,
    };
  } catch (error) {
    console.error('Error fetching Instagram account data:', error);
    return null;
  }
}

export async function getMediaData(
  accountId: string,
  accessToken: string,
  limit: number = 25
): Promise<InstagramMediaData[]> {
  try {
    const response = await fetch(
      `${INSTAGRAM_GRAPH_URL}/${accountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${limit}&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.error('Failed to fetch Instagram media:', await response.text());
      return [];
    }

    const data = await response.json();

    return (data.data || []).map((item: {
      id: string;
      caption?: string;
      media_type: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
      timestamp?: string;
      like_count?: number;
      comments_count?: number;
    }) => ({
      id: item.id,
      caption: item.caption || '',
      mediaType: item.media_type as 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM',
      mediaUrl: item.media_url || '',
      thumbnailUrl: item.thumbnail_url || item.media_url || '',
      permalink: item.permalink || '',
      timestamp: item.timestamp || '',
      likeCount: item.like_count || 0,
      commentsCount: item.comments_count || 0,
    }));
  } catch (error) {
    console.error('Error fetching Instagram media:', error);
    return [];
  }
}

export async function getFullAnalytics(
  accountId: string,
  accessToken: string
): Promise<InstagramAnalytics | null> {
  try {
    const account = await getAccountData(accountId, accessToken);
    if (!account) return null;

    const media = await getMediaData(accountId, accessToken, 25);

    const recentPosts = media.slice(0, 10);
    const totalLikes = recentPosts.reduce((sum, m) => sum + m.likeCount, 0);
    const totalComments = recentPosts.reduce((sum, m) => sum + m.commentsCount, 0);

    const recentPerformance = {
      totalLikes,
      totalComments,
      avgLikesPerPost: recentPosts.length ? Math.round(totalLikes / recentPosts.length) : 0,
      avgCommentsPerPost: recentPosts.length ? Math.round(totalComments / recentPosts.length) : 0,
      engagementRate: account.followerCount > 0
        ? Number((((totalLikes + totalComments) / recentPosts.length / account.followerCount) * 100).toFixed(2))
        : 0,
    };

    const topPosts = [...media]
      .sort((a, b) => (b.likeCount + b.commentsCount) - (a.likeCount + a.commentsCount))
      .slice(0, 5);

    return {
      account,
      media,
      recentPerformance,
      topPosts,
    };
  } catch (error) {
    console.error('Error fetching full analytics:', error);
    return null;
  }
}
