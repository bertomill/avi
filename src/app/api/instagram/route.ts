import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFullAnalytics } from '@/lib/instagram';
import { supabase } from '@/lib/supabase';
import { InstagramAnalytics } from '@/types';

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Sync Instagram data to Supabase
async function syncInstagramToDatabase(
  userId: string,
  analytics: InstagramAnalytics
): Promise<void> {
  const { account, media } = analytics;

  // Upsert Instagram account data
  const { data: existingAccount } = await supabase
    .from('InstagramAccount')
    .select('id')
    .eq('userId', userId)
    .single();

  const accountId = existingAccount?.id || generateId();

  if (existingAccount) {
    await supabase
      .from('InstagramAccount')
      .update({
        username: account.username,
        name: account.name,
        biography: account.biography,
        profilePictureUrl: account.profilePictureUrl,
        followerCount: account.followerCount || 0,
        followingCount: account.followingCount || 0,
        mediaCount: account.mediaCount || 0,
        lastSyncedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', accountId);
  } else {
    await supabase.from('InstagramAccount').insert({
      id: accountId,
      userId,
      instagramUserId: account.id,
      username: account.username,
      name: account.name,
      biography: account.biography,
      profilePictureUrl: account.profilePictureUrl,
      followerCount: account.followerCount || 0,
      followingCount: account.followingCount || 0,
      mediaCount: account.mediaCount || 0,
      lastSyncedAt: new Date().toISOString(),
    });
  }

  // Upsert posts
  for (const post of media) {
    const { data: existingPost } = await supabase
      .from('InstagramPost')
      .select('id')
      .eq('accountId', accountId)
      .eq('instagramMediaId', post.id)
      .single();

    const postData = {
      caption: post.caption || '',
      mediaType: post.mediaType,
      mediaUrl: post.mediaUrl || '',
      thumbnailUrl: post.thumbnailUrl || '',
      permalink: post.permalink || '',
      timestamp: post.timestamp ? new Date(post.timestamp).toISOString() : null,
      likeCount: post.likeCount || 0,
      commentsCount: post.commentsCount || 0,
      updatedAt: new Date().toISOString(),
    };

    if (existingPost) {
      await supabase
        .from('InstagramPost')
        .update(postData)
        .eq('id', existingPost.id);
    } else {
      await supabase.from('InstagramPost').insert({
        id: generateId(),
        accountId,
        instagramMediaId: post.id,
        ...postData,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

// Get cached Instagram data from database
async function getCachedInstagramData(userId: string): Promise<InstagramAnalytics | null> {
  const { data: account } = await supabase
    .from('InstagramAccount')
    .select('*')
    .eq('userId', userId)
    .single();

  if (!account) return null;

  const { data: posts } = await supabase
    .from('InstagramPost')
    .select('*')
    .eq('accountId', account.id)
    .order('timestamp', { ascending: false });

  const mediaList = (posts || []).map((p) => ({
    id: p.instagramMediaId,
    caption: p.caption || '',
    mediaType: p.mediaType as 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM',
    mediaUrl: p.mediaUrl || '',
    thumbnailUrl: p.thumbnailUrl || '',
    permalink: p.permalink || '',
    timestamp: p.timestamp || '',
    likeCount: p.likeCount || 0,
    commentsCount: p.commentsCount || 0,
  }));

  const recentPosts = mediaList.slice(0, 10);
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

  const topPosts = [...mediaList]
    .sort((a, b) => (b.likeCount + b.commentsCount) - (a.likeCount + a.commentsCount))
    .slice(0, 5);

  return {
    account: {
      id: account.instagramUserId,
      username: account.username || '',
      name: account.name || '',
      biography: account.biography || '',
      profilePictureUrl: account.profilePictureUrl || '',
      followerCount: account.followerCount || 0,
      followingCount: account.followingCount || 0,
      mediaCount: account.mediaCount || 0,
    },
    media: mediaList,
    recentPerformance,
    topPosts,
  };
}

// Check if data needs refresh (older than 1 hour)
async function needsRefresh(userId: string): Promise<boolean> {
  const { data: account } = await supabase
    .from('InstagramAccount')
    .select('lastSyncedAt')
    .eq('userId', userId)
    .single();

  if (!account?.lastSyncedAt) return true;

  const lastSync = new Date(account.lastSyncedAt);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  return lastSync < oneHourAgo;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: oauthAccount } = await supabase
      .from('Account')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'instagram')
      .single();

    if (!oauthAccount?.access_token) {
      return NextResponse.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }

    // Check if we have cached data and if it's fresh enough
    const shouldRefresh = await needsRefresh(session.user.id);

    if (!shouldRefresh) {
      const cachedData = await getCachedInstagramData(session.user.id);
      if (cachedData) {
        return NextResponse.json(cachedData);
      }
    }

    // Fetch fresh data from Instagram API
    const analytics = await getFullAnalytics(
      oauthAccount.providerAccountId,
      oauthAccount.access_token
    );

    if (!analytics) {
      // Try to return cached data as fallback
      const cachedData = await getCachedInstagramData(session.user.id);
      if (cachedData) {
        return NextResponse.json(cachedData);
      }
      return NextResponse.json(
        { error: 'Could not fetch Instagram data' },
        { status: 500 }
      );
    }

    // Save to database
    await syncInstagramToDatabase(session.user.id, analytics);

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Instagram API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Instagram data' },
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

    const { data: oauthAccount } = await supabase
      .from('Account')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'instagram')
      .single();

    if (!oauthAccount?.access_token) {
      return NextResponse.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }

    // Force fetch fresh data
    const analytics = await getFullAnalytics(
      oauthAccount.providerAccountId,
      oauthAccount.access_token
    );

    if (!analytics) {
      return NextResponse.json(
        { error: 'Failed to fetch Instagram data' },
        { status: 500 }
      );
    }

    // Save to database
    await syncInstagramToDatabase(session.user.id, analytics);

    return NextResponse.json({
      success: true,
      message: 'Instagram data synced successfully',
      analytics,
    });
  } catch (error) {
    console.error('Instagram sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Instagram data' },
      { status: 500 }
    );
  }
}
