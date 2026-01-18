import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { chatWithClaude, generateContentIdeas, optimizeTitle, analyzeContentGaps } from '@/lib/claude';
import { getFullAnalytics } from '@/lib/youtube';
import { AIContext, ChatMessage } from '@/types';
import { supabase } from '@/lib/supabase';

function buildAIContext(analytics: Awaited<ReturnType<typeof getFullAnalytics>>): AIContext {
  if (!analytics) {
    return {
      channelStats: { subscribers: 0, totalViews: 0, videoCount: 0 },
      topPerformingVideos: [],
      recentContent: [],
    };
  }

  return {
    channelStats: {
      subscribers: analytics.channel.subscriberCount,
      totalViews: analytics.channel.viewCount,
      videoCount: analytics.channel.videoCount,
    },
    topPerformingVideos: analytics.topVideos.map((v) => ({
      title: v.title,
      views: v.viewCount,
      engagement:
        v.viewCount > 0
          ? ((v.likeCount + v.commentCount) / v.viewCount) * 100
          : 0,
    })),
    recentContent: analytics.videos.slice(0, 10).map((v) => ({
      title: v.title,
      publishedAt: new Date(v.publishedAt).toLocaleDateString(),
      performance: v.viewCount,
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

    // Get the user's Google account access token
    const { data: account } = await supabase
      .from('Account')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'google')
      .single();

    let context: AIContext;

    if (account?.access_token) {
      const analytics = await getFullAnalytics(account.access_token);
      context = buildAIContext(analytics);
    } else {
      // Allow AI chat even without YouTube connected, with empty context
      context = {
        channelStats: { subscribers: 0, totalViews: 0, videoCount: 0 },
        topPerformingVideos: [],
        recentContent: [],
      };
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
