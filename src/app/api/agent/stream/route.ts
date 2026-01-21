import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getMediumAnalytics } from '@/lib/medium';

export const maxDuration = 120;

// Fetch connected channels for the user
async function getConnectedChannels(userId: string) {
  const connections: { platform: string; connected: boolean; details?: string }[] = [];

  // Check YouTube (stored in User table)
  const { data: user } = await supabase
    .from('User')
    .select('youtubeChannelId, mediumUsername')
    .eq('id', userId)
    .single();

  connections.push({
    platform: 'YouTube',
    connected: !!user?.youtubeChannelId,
    details: user?.youtubeChannelId ? `Channel ID: ${user.youtubeChannelId}` : undefined,
  });

  connections.push({
    platform: 'Medium',
    connected: !!user?.mediumUsername,
    details: user?.mediumUsername ? `Username: @${user.mediumUsername}` : undefined,
  });

  // Check Instagram, TikTok, X (stored in Account table)
  const { data: accounts } = await supabase
    .from('Account')
    .select('provider, providerAccountId')
    .eq('userId', userId)
    .in('provider', ['instagram', 'tiktok', 'x']);

  const accountMap = new Map(accounts?.map(a => [a.provider, a.providerAccountId]) || []);

  connections.push({
    platform: 'Instagram',
    connected: accountMap.has('instagram'),
  });

  connections.push({
    platform: 'TikTok',
    connected: accountMap.has('tiktok'),
  });

  connections.push({
    platform: 'X (Twitter)',
    connected: accountMap.has('x'),
  });

  return { connections, mediumUsername: user?.mediumUsername };
}

// Load Medium data for context
async function loadMediumData(username: string): Promise<string> {
  try {
    const analytics = await getMediumAnalytics(username);
    if (!analytics) return '{}';

    return JSON.stringify({
      username: analytics.username,
      totalArticles: analytics.recentActivity.totalArticles,
      latestPublishedAt: analytics.recentActivity.latestPublishedAt,
      categories: analytics.recentActivity.categories,
      recentArticles: analytics.articles.slice(0, 5).map(a => ({
        title: a.title,
        publishedAt: a.publishedAt,
        categories: a.categories,
        preview: a.contentPreview,
      })),
    }, null, 2);
  } catch (error) {
    console.error('Error loading Medium data:', error);
    return '{}';
  }
}

// Load YouTube data for context
function loadYouTubeData(): string {
  const dataPath = path.join(process.cwd(), 'data', 'youtube-content.json');
  if (existsSync(dataPath)) {
    try {
      const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
      // Return a condensed version for context
      return JSON.stringify({
        channel: data.channel,
        topVideos: data.topVideos,
        recentPerformance: data.recentPerformance,
        videoCount: data.videos?.length || 0,
      }, null, 2);
    } catch {
      return '{}';
    }
  }
  return '{}';
}

export async function POST(request: NextRequest) {
  const { prompt, messages: conversationHistory } = await request.json();

  if (!prompt && (!conversationHistory || conversationHistory.length === 0)) {
    return new Response(JSON.stringify({ error: 'Prompt or messages required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get user session for connection info
  const session = await getServerSession(authOptions);
  let connectionInfo = '';
  let mediumData = '{}';

  if (session?.user?.id) {
    const { connections, mediumUsername } = await getConnectedChannels(session.user.id);
    const connectedList = connections.filter(c => c.connected).map(c => c.platform);
    const notConnectedList = connections.filter(c => !c.connected).map(c => c.platform);

    connectionInfo = `
CONNECTED CHANNELS:
${connectedList.length > 0 ? connectedList.map(p => `✓ ${p}`).join('\n') : 'No channels connected yet'}

NOT YET CONNECTED:
${notConnectedList.length > 0 ? notConnectedList.map(p => `✗ ${p}`).join('\n') : 'All channels connected!'}
`;

    // Load Medium data if connected
    if (mediumUsername) {
      mediumData = await loadMediumData(mediumUsername);
    }
  }

  const youtubeData = loadYouTubeData();

  const systemPrompt = `You are Avi, a friendly AI content strategist helping a creator named Berto Mill who makes AI automation content.

${connectionInfo}

You have access to the creator's YouTube data:
${youtubeData}

You have access to the creator's Medium data:
${mediumData}

The YouTube data includes:
- channel: Channel info (title, description, subscribers, total views, video count)
- topVideos: Top 5 performing videos by views
- recentPerformance: Aggregated stats for recent videos
- videoCount: Total number of videos

The Medium data includes:
- username: Medium username
- totalArticles: Total number of articles published
- latestPublishedAt: When the most recent article was published
- categories: Topics/tags used across articles
- recentArticles: The 5 most recent articles with titles, dates, categories, and previews

When answering:
- Use the data above to provide accurate information
- Provide specific numbers, video titles, and article titles when relevant
- Be helpful, friendly and conversational
- Keep responses concise (2-3 sentences for simple questions, more for detailed analysis)
- IMPORTANT: When suggesting video ideas, ALWAYS use the show_video_ideas tool to display them as clickable options. Include 3-5 ideas.
- When asked about connected channels, refer to the CONNECTED CHANNELS section above and be specific about which are connected vs not connected
- When asked about Medium, use the Medium data to provide specific article information
- CRITICAL: After EVERY response, you MUST use the show_suggestions tool to provide 2-4 relevant follow-up suggestions the user might want to ask next. Make them contextual to what was just discussed.`;

  const client = new Anthropic();

  // Define tools for the agent
  const tools: Anthropic.Tool[] = [
    {
      name: 'show_video_ideas',
      description: 'Display clickable video idea options for the user to select from. Use this when suggesting video ideas so the user can easily pick one.',
      input_schema: {
        type: 'object' as const,
        properties: {
          ideas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'The video title' },
                description: { type: 'string', description: 'Brief description of the video concept' },
              },
              required: ['title', 'description'],
            },
            description: 'Array of video ideas with titles and descriptions',
          },
        },
        required: ['ideas'],
      },
    },
    {
      name: 'start_recording',
      description: 'Open the inline video recording interface so the user can record their video. Use this when the user says they want to start recording, are ready to record, or want to film their video. Include the video title and script/talking points.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'The video title' },
          script: { type: 'string', description: 'The script or talking points for the video, formatted with clear sections' },
        },
        required: ['title', 'script'],
      },
    },
    {
      name: 'show_suggestions',
      description: 'Display clickable follow-up suggestions for the user. ALWAYS use this after every response to help guide the conversation. Provide 2-4 contextual suggestions based on what was just discussed.',
      input_schema: {
        type: 'object' as const,
        properties: {
          suggestions: {
            type: 'array',
            items: {
              type: 'string',
              description: 'A short, actionable suggestion (e.g., "Show me my top videos", "Give me content ideas", "Analyze my engagement")',
            },
            description: 'Array of 2-4 follow-up suggestions',
            minItems: 2,
            maxItems: 4,
          },
        },
        required: ['suggestions'],
      },
    },
  ];

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Build messages array from conversation history or single prompt
        // Filter out the initial greeting (first assistant message) and empty messages
        const apiMessages = conversationHistory
          ? conversationHistory
              .filter((msg: { role: string; content: string }, index: number) => {
                // Skip first message if it's the greeting
                if (index === 0 && msg.role === 'assistant') return false;
                // Skip empty messages
                if (!msg.content || msg.content.trim() === '') return false;
                return true;
              })
              .map((msg: { role: string; content: string }) => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              }))
          : [{ role: 'user' as const, content: prompt }];

        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: apiMessages,
          tools,
          stream: true,
        });

        let currentToolName = '';
        let currentToolInput = '';

        for await (const event of response) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              currentToolName = event.content_block.name;
              currentToolInput = '';
            }
          } else if (event.type === 'content_block_delta') {
            const delta = event.delta;
            if ('text' in delta) {
              const data = JSON.stringify({ type: 'chunk', content: delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } else if ('partial_json' in delta) {
              currentToolInput += delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            // If we finished a tool call, send the tool data
            if (currentToolName && currentToolInput) {
              try {
                const toolData = JSON.parse(currentToolInput);
                const data = JSON.stringify({ type: 'tool', tool: currentToolName, data: toolData });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              } catch (e) {
                console.error('Failed to parse tool input:', e);
              }
              currentToolName = '';
              currentToolInput = '';
            }
          } else if (event.type === 'message_stop') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`));
          }
        }

        controller.close();
      } catch (error) {
        console.error('Streaming error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const data = JSON.stringify({ type: 'error', error: errorMessage });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
