import prisma from './prisma';
import { InstagramAccountData, InstagramMediaData, InstagramAnalytics } from '@/types';

const INSTAGRAM_GRAPH_URL = 'https://graph.facebook.com/v19.0';

/**
 * Get the Instagram Business Account ID from a Facebook Page
 * Flow: Access Token -> /me/accounts -> Page -> instagram_business_account
 */
export async function getInstagramAccountId(accessToken: string): Promise<string | null> {
  try {
    // Get Facebook Pages linked to this user
    const pagesResponse = await fetch(
      `${INSTAGRAM_GRAPH_URL}/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`
    );

    if (!pagesResponse.ok) {
      console.error('Failed to fetch Facebook pages:', await pagesResponse.text());
      return null;
    }

    const pagesData = await pagesResponse.json();

    // Find a page with an Instagram business account
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

/**
 * Fetch Instagram Business Account profile data
 */
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

/**
 * Fetch recent media with engagement metrics
 */
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

/**
 * Get full analytics for an Instagram account
 */
export async function getFullAnalytics(
  accountId: string,
  accessToken: string
): Promise<InstagramAnalytics | null> {
  try {
    const account = await getAccountData(accountId, accessToken);
    if (!account) return null;

    const media = await getMediaData(accountId, accessToken, 25);

    // Calculate recent performance (last 10 posts)
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

    // Get top posts by engagement (likes + comments)
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

/**
 * Sync Instagram account and media to the database
 */
export async function syncAccountToDatabase(
  userId: string,
  accountId: string,
  accessToken: string
): Promise<void> {
  const analytics = await getFullAnalytics(accountId, accessToken);
  if (!analytics) return;

  const { account, media } = analytics;

  // Upsert Instagram account
  const dbAccount = await prisma.instagramAccount.upsert({
    where: { accountId: account.id },
    update: {
      username: account.username,
      name: account.name,
      biography: account.biography,
      profilePictureUrl: account.profilePictureUrl,
      followerCount: account.followerCount,
      followingCount: account.followingCount,
      mediaCount: account.mediaCount,
      lastSyncedAt: new Date(),
    },
    create: {
      accountId: account.id,
      username: account.username,
      name: account.name,
      biography: account.biography,
      profilePictureUrl: account.profilePictureUrl,
      followerCount: account.followerCount,
      followingCount: account.followingCount,
      mediaCount: account.mediaCount,
      userId,
    },
  });

  // Upsert media items
  for (const item of media) {
    await prisma.instagramMedia.upsert({
      where: { mediaId: item.id },
      update: {
        caption: item.caption,
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
        thumbnailUrl: item.thumbnailUrl,
        permalink: item.permalink,
        timestamp: item.timestamp ? new Date(item.timestamp) : null,
        likeCount: item.likeCount,
        commentsCount: item.commentsCount,
      },
      create: {
        mediaId: item.id,
        caption: item.caption,
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
        thumbnailUrl: item.thumbnailUrl,
        permalink: item.permalink,
        timestamp: item.timestamp ? new Date(item.timestamp) : null,
        likeCount: item.likeCount,
        commentsCount: item.commentsCount,
        accountId: dbAccount.id,
      },
    });
  }
}

/**
 * Get cached analytics from database
 */
export async function getCachedAnalytics(userId: string): Promise<InstagramAnalytics | null> {
  const account = await prisma.instagramAccount.findUnique({
    where: { userId },
    include: {
      media: {
        orderBy: { timestamp: 'desc' },
        take: 25,
      },
    },
  });

  if (!account) return null;

  const recentPosts = account.media.slice(0, 10);
  const totalLikes = recentPosts.reduce((sum, m) => sum + (m.likeCount || 0), 0);
  const totalComments = recentPosts.reduce((sum, m) => sum + (m.commentsCount || 0), 0);

  return {
    account: {
      id: account.accountId,
      username: account.username,
      name: account.name || '',
      biography: account.biography || '',
      profilePictureUrl: account.profilePictureUrl || '',
      followerCount: account.followerCount || 0,
      followingCount: account.followingCount || 0,
      mediaCount: account.mediaCount || 0,
    },
    media: account.media.map((m) => ({
      id: m.mediaId,
      caption: m.caption || '',
      mediaType: m.mediaType as 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM',
      mediaUrl: m.mediaUrl || '',
      thumbnailUrl: m.thumbnailUrl || '',
      permalink: m.permalink || '',
      timestamp: m.timestamp?.toISOString() || '',
      likeCount: m.likeCount || 0,
      commentsCount: m.commentsCount || 0,
    })),
    recentPerformance: {
      totalLikes,
      totalComments,
      avgLikesPerPost: recentPosts.length ? Math.round(totalLikes / recentPosts.length) : 0,
      avgCommentsPerPost: recentPosts.length ? Math.round(totalComments / recentPosts.length) : 0,
      engagementRate: (account.followerCount || 0) > 0
        ? Number((((totalLikes + totalComments) / recentPosts.length / (account.followerCount || 1)) * 100).toFixed(2))
        : 0,
    },
    topPosts: [...account.media]
      .sort((a, b) => ((b.likeCount || 0) + (b.commentsCount || 0)) - ((a.likeCount || 0) + (a.commentsCount || 0)))
      .slice(0, 5)
      .map((m) => ({
        id: m.mediaId,
        caption: m.caption || '',
        mediaType: m.mediaType as 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM',
        mediaUrl: m.mediaUrl || '',
        thumbnailUrl: m.thumbnailUrl || '',
        permalink: m.permalink || '',
        timestamp: m.timestamp?.toISOString() || '',
        likeCount: m.likeCount || 0,
        commentsCount: m.commentsCount || 0,
      })),
  };
}
