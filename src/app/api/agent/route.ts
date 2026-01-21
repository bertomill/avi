import { Sandbox } from 'e2b';
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export const maxDuration = 120;

// In-memory store for warm sandboxes and sessions
const sandboxStore: Map<string, {
  sandbox: Sandbox;
  sessionId: string | null;
  lastUsed: number;
}> = new Map();

// Cleanup old sandboxes after 5 minutes of inactivity
const SANDBOX_TTL = 5 * 60 * 1000;

async function cleanupOldSandboxes() {
  const now = Date.now();
  for (const [userId, data] of sandboxStore.entries()) {
    if (now - data.lastUsed > SANDBOX_TTL) {
      console.log(`Cleaning up sandbox for user: ${userId}`);
      try {
        await data.sandbox.kill();
      } catch (e) {
        console.error('Error killing sandbox:', e);
      }
      sandboxStore.delete(userId);
    }
  }
}

setInterval(cleanupOldSandboxes, 60 * 1000);

async function getOrCreateSandbox(userId: string): Promise<{ sandbox: Sandbox; sessionId: string | null; isNew: boolean }> {
  const existing = sandboxStore.get(userId);

  if (existing) {
    try {
      await existing.sandbox.commands.run('echo "alive"', { timeoutMs: 5000 });
      existing.lastUsed = Date.now();
      console.log(`Reusing warm sandbox for user: ${userId}`);
      return { sandbox: existing.sandbox, sessionId: existing.sessionId, isNew: false };
    } catch (e) {
      console.log('Sandbox died, creating new one');
      sandboxStore.delete(userId);
    }
  }

  console.log(`Creating new sandbox for user: ${userId}`);
  const sandbox = await Sandbox.create('base', {
    envs: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    },
    timeoutMs: 300000,
  });

  console.log('Installing Claude Code CLI...');
  await sandbox.commands.run('npm install -g @anthropic-ai/claude-code', {
    timeoutMs: 60000,
  });

  const dataPath = path.join(process.cwd(), 'data', 'youtube-content.json');
  if (existsSync(dataPath)) {
    const youtubeData = readFileSync(dataPath, 'utf-8');
    await sandbox.files.write('/home/user/youtube-content.json', youtubeData);
  }

  sandboxStore.set(userId, {
    sandbox,
    sessionId: null,
    lastUsed: Date.now(),
  });

  return { sandbox, sessionId: null, isNew: true };
}

// Strip markdown formatting for cleaner TTS output
function stripMarkdownForSpeech(text: string): string {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove headers but keep text
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bullet points and numbers, keep text
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Generate speech from text using ElevenLabs
async function generateSpeech(text: string): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  // Clean markdown for natural speech
  const cleanText = stripMarkdownForSpeech(text);

  try {
    // Use a friendly, conversational voice - "Rachel" is good for assistants
    const voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Rachel voice

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: cleanText.substring(0, 2500), // Limit text length
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('ElevenLabs error:', await response.text());
      return null;
    }

    // Convert audio to base64
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    return `data:audio/mpeg;base64,${base64Audio}`;
  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    return null;
  }
}

async function runAgentWithRetry(userId: string, prompt: string, retryCount = 0): Promise<{ response: string; sessionId: string | null; isNew: boolean }> {
  const maxRetries = 1;

  try {
    const { sandbox, sessionId, isNew } = await getOrCreateSandbox(userId);

    const systemPrompt = `You are Avi, a friendly AI content strategist. You have access to the creator's YouTube data at /home/user/youtube-content.json.

The JSON file contains:
- channel: Channel info (title, description, subscribers, total views, video count)
- videos: Array of all videos with title, description, publishedAt, viewCount, likeCount, commentCount, duration
- recentPerformance: Aggregated stats for recent videos
- topVideos: Top 5 performing videos by views

When answering:
- Read the data file to get accurate information
- Provide specific numbers and video titles
- Be helpful, friendly and conversational
- Keep responses concise (2-3 sentences for simple questions, more for detailed analysis)

The creator is Berto Mill who makes AI automation content.`;

    const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;
    await sandbox.files.write('/home/user/prompt.txt', fullPrompt);

    const resumeFlag = sessionId ? `--resume ${sessionId}` : '';

    console.log(`Running agent${sessionId ? ' (resuming)' : ' (new)'}...`);
    const result = await sandbox.commands.run(
      `cat /home/user/prompt.txt | claude -p --allowedTools "Read,Glob,Grep" --dangerously-skip-permissions ${resumeFlag}`,
      {
        timeoutMs: 120000,
        cwd: '/home/user',
      }
    );

    const textResponse = (result.stdout || result.stderr || '').trim();

    if (!textResponse) {
      throw new Error('Empty response from agent');
    }

    return { response: textResponse, sessionId, isNew };
  } catch (error) {
    console.error(`Agent error (attempt ${retryCount + 1}):`, error);

    // Clear the cached sandbox on error
    sandboxStore.delete(userId);

    // Retry once with a fresh sandbox
    if (retryCount < maxRetries) {
      console.log('Retrying with fresh sandbox...');
      return runAgentWithRetry(userId, prompt, retryCount + 1);
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, userId = 'default', enableVoice = true } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const { response: textResponse, sessionId, isNew } = await runAgentWithRetry(userId, prompt);

    // Generate voice response if enabled
    let audioUrl: string | null = null;
    if (enableVoice && textResponse) {
      audioUrl = await generateSpeech(textResponse);
    }

    return NextResponse.json({
      response: textResponse,
      audioUrl,
      sessionId,
      isNewSession: isNew,
      success: true,
    });

  } catch (error) {
    console.error('Agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Agent failed';

    // Provide a more helpful error message
    const userMessage = errorMessage.includes('terminated')
      ? 'The AI agent timed out. Please try again with a simpler question.'
      : errorMessage;

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
