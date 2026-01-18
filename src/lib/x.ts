import { XUserData, XTweetData, XAnalytics } from '@/types';
import { supabase } from './supabase';

const X_API_BASE = 'https://api.twitter.com/2';

// PKCE Helper: Generate a random code verifier (43-128 chars, URL-safe)
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// PKCE Helper: Generate code challenge from verifier (SHA-256 hash, base64url encoded)
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

function base64URLEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Fetch user profile data
export async function getUserData(accessToken: string): Promise<XUserData | null> {
  try {
    const response = await fetch(
      `${X_API_BASE}/users/me?user.fields=id,username,name,description,profile_image_url,public_metrics,created_at,verified`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('X API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const user = data.data;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      description: user.description || '',
      profileImageUrl: user.profile_image_url || '',
      followersCount: user.public_metrics?.followers_count || 0,
      followingCount: user.public_metrics?.following_count || 0,
      tweetCount: user.public_metrics?.tweet_count || 0,
      createdAt: user.created_at,
      verified: user.verified || false,
    };
  } catch (error) {
    console.error('Error fetching X user data:', error);
    return null;
  }
}

// Fetch user's tweets
export async function getUserTweets(
  accessToken: string,
  userId: string,
  maxResults: number = 100
): Promise<XTweetData[]> {
  try {
    const url = `${X_API_BASE}/users/${userId}/tweets?max_results=${Math.min(maxResults, 100)}&tweet.fields=id,text,created_at,public_metrics`;
    console.log('Fetching tweets from:', url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const responseText = await response.text();
    console.log('X API tweets response status:', response.status);
    console.log('X API tweets response:', responseText);

    if (!response.ok) {
      console.error('X API error fetching tweets:', responseText);
      return [];
    }

    const data = JSON.parse(responseText);

    if (!data.data) {
      console.log('No tweets data in response');
      return [];
    }

    return data.data.map((tweet: {
      id: string;
      text: string;
      created_at: string;
      public_metrics?: {
        retweet_count?: number;
        reply_count?: number;
        like_count?: number;
        quote_count?: number;
        impression_count?: number;
      };
    }) => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      publicMetrics: {
        retweetCount: tweet.public_metrics?.retweet_count || 0,
        replyCount: tweet.public_metrics?.reply_count || 0,
        likeCount: tweet.public_metrics?.like_count || 0,
        quoteCount: tweet.public_metrics?.quote_count || 0,
        impressionCount: tweet.public_metrics?.impression_count || 0,
      },
    }));
  } catch (error) {
    console.error('Error fetching X tweets:', error);
    return [];
  }
}

// Get full analytics data
export async function getFullAnalytics(accessToken: string): Promise<XAnalytics | null> {
  const user = await getUserData(accessToken);

  if (!user) {
    return null;
  }

  const tweets = await getUserTweets(accessToken, user.id);

  // Calculate recent performance (from fetched tweets)
  const recentTweets = tweets.slice(0, 10);
  const totalImpressions = recentTweets.reduce((sum, t) => sum + t.publicMetrics.impressionCount, 0);
  const totalLikes = recentTweets.reduce((sum, t) => sum + t.publicMetrics.likeCount, 0);
  const totalRetweets = recentTweets.reduce((sum, t) => sum + t.publicMetrics.retweetCount, 0);
  const totalReplies = recentTweets.reduce((sum, t) => sum + t.publicMetrics.replyCount, 0);

  // Calculate average engagement rate
  const avgEngagementRate = totalImpressions > 0
    ? ((totalLikes + totalRetweets + totalReplies) / totalImpressions) * 100
    : 0;

  // Get top tweets by engagement (likes + retweets + replies)
  const topTweets = [...tweets]
    .sort((a, b) => {
      const engagementA = a.publicMetrics.likeCount + a.publicMetrics.retweetCount + a.publicMetrics.replyCount;
      const engagementB = b.publicMetrics.likeCount + b.publicMetrics.retweetCount + b.publicMetrics.replyCount;
      return engagementB - engagementA;
    })
    .slice(0, 5);

  return {
    user,
    tweets,
    recentPerformance: {
      totalImpressions,
      totalLikes,
      totalRetweets,
      totalReplies,
      avgEngagementRate,
    },
    topTweets,
  };
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  try {
    const credentials = Buffer.from(
      `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
    ).toString('base64');

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('X token refresh failed:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error refreshing X token:', error);
    return null;
  }
}

// ============================================
// Supabase Sync Functions
// ============================================

// Sync X profile to Supabase
export async function syncProfileToSupabase(
  userId: string,
  userData: XUserData
): Promise<void> {
  try {
    const { error } = await supabase
      .from('XProfile')
      .upsert({
        id: userData.id,
        userId,
        username: userData.username,
        name: userData.name,
        description: userData.description,
        profileImageUrl: userData.profileImageUrl,
        followersCount: userData.followersCount,
        followingCount: userData.followingCount,
        tweetCount: userData.tweetCount,
        verified: userData.verified,
        updatedAt: new Date().toISOString(),
        syncedAt: new Date().toISOString(),
      }, {
        onConflict: 'userId',
      });

    if (error) {
      console.error('Error syncing X profile to Supabase:', error);
      throw error;
    }

    console.log('X profile synced to Supabase for user:', userId);
  } catch (error) {
    console.error('Error in syncProfileToSupabase:', error);
    throw error;
  }
}

// Sync X tweets to Supabase
export async function syncTweetsToSupabase(
  userId: string,
  profileId: string,
  tweets: XTweetData[]
): Promise<void> {
  try {
    // Prepare tweet data for upsert
    const tweetRecords = tweets.map(tweet => ({
      id: tweet.id,
      profileId,
      userId,
      text: tweet.text,
      createdAt: tweet.createdAt,
      impressionCount: tweet.publicMetrics.impressionCount,
      likeCount: tweet.publicMetrics.likeCount,
      retweetCount: tweet.publicMetrics.retweetCount,
      replyCount: tweet.publicMetrics.replyCount,
      quoteCount: tweet.publicMetrics.quoteCount,
      syncedAt: new Date().toISOString(),
    }));

    // Upsert tweets in batches of 50
    const batchSize = 50;
    for (let i = 0; i < tweetRecords.length; i += batchSize) {
      const batch = tweetRecords.slice(i, i + batchSize);
      const { error } = await supabase
        .from('XTweet')
        .upsert(batch, {
          onConflict: 'id',
        });

      if (error) {
        console.error('Error syncing X tweets batch to Supabase:', error);
        throw error;
      }
    }

    console.log(`Synced ${tweets.length} X tweets to Supabase for user:`, userId);
  } catch (error) {
    console.error('Error in syncTweetsToSupabase:', error);
    throw error;
  }
}

// Sync all X data (profile + tweets) to Supabase
export async function syncXDataToSupabase(
  userId: string,
  analytics: XAnalytics
): Promise<void> {
  await syncProfileToSupabase(userId, analytics.user);
  await syncTweetsToSupabase(userId, analytics.user.id, analytics.tweets);
}

// Get X profile from Supabase
export async function getProfileFromSupabase(userId: string) {
  const { data, error } = await supabase
    .from('XProfile')
    .select('*')
    .eq('userId', userId)
    .single();

  if (error) {
    console.error('Error fetching X profile from Supabase:', error);
    return null;
  }

  return data;
}

// Get X tweets from Supabase
export async function getTweetsFromSupabase(userId: string, limit: number = 100) {
  const { data, error } = await supabase
    .from('XTweet')
    .select('*')
    .eq('userId', userId)
    .order('createdAt', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching X tweets from Supabase:', error);
    return [];
  }

  return data || [];
}
