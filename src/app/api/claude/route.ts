import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { chatWithClaude, generateContentIdeas, optimizeTitle, analyzeContentGaps } from '@/lib/claude';
import { getMediumAnalytics } from '@/lib/medium';
import { getTikTokAnalytics } from '@/lib/tiktok';
import { AIContext, ChatMessage } from '@/types';
import { supabase } from '@/lib/supabase';

// Build AI context from Supabase database
async function buildAIContextFromDatabase(userId: string): Promise<AIContext> {
  // Get YouTube channel data from database
  const { data: channel } = await supabase
    .from('YouTubeChannel')
    .select('*')
    .eq('userId', userId)
    .single();

  if (!channel) {
    return {
      channelStats: { subscribers: 0, totalViews: 0, videoCount: 0 },
      topPerformingVideos: [],
      recentContent: [],
    };
  }

  // Get videos sorted by views (top performing)
  const { data: topVideos } = await supabase
    .from('YouTubeVideo')
    .select('*')
    .eq('channelId', channel.id)
    .order('viewCount', { ascending: false })
    .limit(5);

  // Get recent videos
  const { data: recentVideos } = await supabase
    .from('YouTubeVideo')
    .select('*')
    .eq('channelId', channel.id)
    .order('publishedAt', { ascending: false })
    .limit(10);

  return {
    channelStats: {
      subscribers: channel.subscriberCount || 0,
      totalViews: channel.viewCount || 0,
      videoCount: channel.videoCount || 0,
    },
    topPerformingVideos: (topVideos || []).map((v) => ({
      title: v.title,
      views: v.viewCount || 0,
      engagement:
        (v.viewCount || 0) > 0
          ? (((v.likeCount || 0) + (v.commentCount || 0)) / v.viewCount) * 100
          : 0,
    })),
    recentContent: (recentVideos || []).map((v) => ({
      title: v.title,
      publishedAt: v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : 'Unknown',
      performance: v.viewCount || 0,
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, messages, title, keyPoints } = body;

    // Get AI context from database (YouTube data)
    let context: AIContext = await buildAIContextFromDatabase(session.user.id);

    // Get Medium data if connected
    const { data: user } = await supabase
      .from('User')
      .select('mediumUsername')
      .eq('id', session.user.id)
      .single();

    if (user?.mediumUsername) {
      const mediumAnalytics = await getMediumAnalytics(user.mediumUsername);
      if (mediumAnalytics) {
        context.mediumStats = {
          username: mediumAnalytics.username,
          totalArticles: mediumAnalytics.articles.length,
        };
        context.recentArticles = mediumAnalytics.articles.slice(0, 10).map(a => ({
          title: a.title,
          publishedAt: new Date(a.publishedAt).toLocaleDateString(),
          categories: a.categories,
        }));
      }
    }

    // Get TikTok data if connected
    const { data: tiktokAccount } = await supabase
      .from('Account')
      .select('access_token')
      .eq('userId', session.user.id)
      .eq('provider', 'tiktok')
      .single();

    if (tiktokAccount?.access_token) {
      const tiktokAnalytics = await getTikTokAnalytics(tiktokAccount.access_token);
      if (tiktokAnalytics) {
        context.tiktokStats = {
          followers: tiktokAnalytics.user.follower_count || 0,
          following: tiktokAnalytics.user.following_count || 0,
          likes: tiktokAnalytics.user.likes_count || 0,
          videos: tiktokAnalytics.user.video_count || 0,
        };
        context.topTikTokVideos = tiktokAnalytics.topVideos.map(v => ({
          title: v.title || '',
          description: v.video_description || '',
          views: v.view_count || 0,
          likes: v.like_count || 0,
          comments: v.comment_count || 0,
          shares: v.share_count || 0,
          engagement: (v.view_count || 0) > 0
            ? (((v.like_count || 0) + (v.comment_count || 0) + (v.share_count || 0)) / (v.view_count || 1)) * 100
            : 0,
        }));
        context.recentTikTokVideos = tiktokAnalytics.videos.slice(0, 10).map(v => ({
          title: v.title || '',
          description: v.video_description || '',
          createdAt: new Date(v.create_time * 1000).toLocaleDateString(),
          views: v.view_count || 0,
          likes: v.like_count || 0,
        }));
      }
    }

    let response: string;

    switch (action) {
      case 'chat':
        if (!messages || !Array.isArray(messages)) {
          return NextResponse.json(
            { error: 'Messages array required' },
            { status: 400 }
          );
        }
        response = await chatWithClaude(messages as ChatMessage[], context);
        break;

      case 'ideas':
        response = await generateContentIdeas(context);
        break;

      case 'optimize-title':
        if (!title) {
          return NextResponse.json(
            { error: 'Title required' },
            { status: 400 }
          );
        }
        response = await optimizeTitle(context, title);
        break;

      case 'analyze-gaps':
        response = await analyzeContentGaps(context);
        break;

      default:
        // Default to chat if no action specified
        if (messages && Array.isArray(messages)) {
          response = await chatWithClaude(messages as ChatMessage[], context);
        } else {
          return NextResponse.json(
            { error: 'Invalid action or missing messages' },
            { status: 400 }
          );
        }
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Claude API error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
