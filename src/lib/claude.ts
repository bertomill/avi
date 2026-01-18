import Anthropic from '@anthropic-ai/sdk';
import { AIContext, ChatMessage } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export function buildSystemPrompt(context: AIContext): string {
  // YouTube data
  const topVideosInfo = context.topPerformingVideos
    ?.map(
      (v, i) =>
        `${i + 1}. "${v.title}" - ${v.views.toLocaleString()} views, ${v.engagement.toFixed(1)}% engagement`
    )
    .join('\n');

  const recentContentInfo = context.recentContent
    ?.map(
      (v, i) =>
        `${i + 1}. "${v.title}" (${v.publishedAt}) - Performance score: ${v.performance}`
    )
    .join('\n');

  // Instagram data
  const topPostsInfo = context.topPerformingPosts
    ?.map(
      (p, i) =>
        `${i + 1}. "${p.caption?.substring(0, 50) || 'No caption'}..." - ${p.likes.toLocaleString()} likes, ${p.comments.toLocaleString()} comments, ${p.engagement.toFixed(1)}% engagement`
    )
    .join('\n');

  const recentPostsInfo = context.recentPosts
    ?.map(
      (p, i) =>
        `${i + 1}. "${p.caption?.substring(0, 50) || 'No caption'}..." (${p.timestamp}) - ${p.likes} likes, ${p.comments} comments`
    )
    .join('\n');

  // Medium data
  const recentArticlesInfo = context.recentArticles
    ?.map(
      (a, i) =>
        `${i + 1}. "${a.title}" (${a.publishedAt}) - Topics: ${a.categories.length > 0 ? a.categories.join(', ') : 'none'}`
    )
    .join('\n');

  const hasYouTube = context.channelStats && context.channelStats.subscribers > 0;
  const hasInstagram = context.instagramStats && context.instagramStats.followers > 0;
  const hasMedium = context.mediumStats && context.mediumStats.totalArticles > 0;

  let prompt = `You are an expert content strategist and AI assistant helping a creator optimize their social media presence. You have access to their analytics and should provide personalized, data-driven recommendations.

`;

  // YouTube section
  if (hasYouTube) {
    prompt += `## YouTube Channel Overview
- Subscribers: ${context.channelStats!.subscribers.toLocaleString()}
- Total Views: ${context.channelStats!.totalViews.toLocaleString()}
- Total Videos: ${context.channelStats!.videoCount}

## Top Performing YouTube Videos (by views)
${topVideosInfo || 'No video data available yet.'}

## Recent YouTube Content
${recentContentInfo || 'No recent content data available.'}

${context.audienceInsights ? `## YouTube Audience Insights
- Demographics: ${context.audienceInsights.demographics || 'Not available'}
- Watch Patterns: ${context.audienceInsights.watchPatterns || 'Not available'}` : ''}

`;
  }

  // Instagram section
  if (hasInstagram) {
    prompt += `## Instagram Account Overview
- Followers: ${context.instagramStats!.followers.toLocaleString()}
- Following: ${context.instagramStats!.following.toLocaleString()}
- Total Posts: ${context.instagramStats!.posts}
- Engagement Rate: ${context.instagramStats!.engagementRate.toFixed(2)}%

## Top Performing Instagram Posts (by engagement)
${topPostsInfo || 'No post data available yet.'}

## Recent Instagram Posts
${recentPostsInfo || 'No recent post data available.'}

`;
  }

  // Medium section
  if (hasMedium) {
    prompt += `## Medium Blog Overview
- Username: @${context.mediumStats!.username}
- Total Articles: ${context.mediumStats!.totalArticles}

## Recent Medium Articles
${recentArticlesInfo || 'No article data available yet.'}

`;
  }

  prompt += `## Your Capabilities
You can help with:
1. **Content Ideation**: Suggest content ideas based on what's performing well
2. **Caption Writing**: Craft compelling captions for posts
3. **Title Optimization**: Craft compelling, SEO-friendly video titles
4. **Description Writing**: Create engaging descriptions with proper keywords
5. **Script Assistance**: Help write or improve video scripts
6. **Hashtag Strategy**: Recommend effective hashtags for Instagram
7. **Visual Concepts**: Suggest thumbnail and post visual ideas
8. **Content Strategy**: Analyze gaps and opportunities across platforms
9. **Trend Analysis**: Identify patterns in successful content
10. **Posting Strategy**: Recommend optimal posting frequency and timing
11. **Blog Writing**: Help write or improve Medium articles
12. **Content Repurposing**: Suggest ways to turn blog posts into videos or social content

Always base your recommendations on the creator's actual data and performance patterns. Be specific, actionable, and encouraging while maintaining honesty about what's working and what could improve.`;

  return prompt;
}

export async function chatWithClaude(
  messages: ChatMessage[],
  context: AIContext
): Promise<string> {
  const systemPrompt = buildSystemPrompt(context);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : 'Unable to generate response.';
}

export async function generateContentIdeas(
  context: AIContext,
  count: number = 5
): Promise<string> {
  const prompt = `Based on my channel's performance data and what's working well, suggest ${count} video ideas that are likely to perform well. For each idea, include:
1. Title suggestion
2. Brief description
3. Why it might work based on my data
4. Estimated difficulty (Easy/Medium/Hard)`;

  return chatWithClaude([{ role: 'user', content: prompt }], context);
}

export async function optimizeTitle(
  context: AIContext,
  currentTitle: string
): Promise<string> {
  const prompt = `I'm working on a video with this title: "${currentTitle}"

Based on my channel's successful videos and current YouTube best practices, suggest 5 alternative titles that could perform better. Explain the strategy behind each suggestion.`;

  return chatWithClaude([{ role: 'user', content: prompt }], context);
}

export async function generateDescription(
  context: AIContext,
  videoTitle: string,
  keyPoints: string
): Promise<string> {
  const prompt = `Write a YouTube video description for a video titled: "${videoTitle}"

Key points to include: ${keyPoints}

The description should:
- Hook viewers in the first 2 lines (shown in preview)
- Include relevant keywords naturally
- Have clear sections with timestamps placeholder
- Include a call to action
- Match the style and tone of my successful content`;

  return chatWithClaude([{ role: 'user', content: prompt }], context);
}

export async function analyzeContentGaps(context: AIContext): Promise<string> {
  const prompt = `Analyze my channel's content and identify gaps or opportunities:
1. What topics am I missing that my audience might want?
2. What formats could I experiment with?
3. Are there trends in my niche I'm not covering?
4. How does my posting frequency compare to what's optimal?

Provide specific, actionable recommendations based on my data.`;

  return chatWithClaude([{ role: 'user', content: prompt }], context);
}
