import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ audioUrl: null });
    }

    // Clean markdown for natural speech
    const cleanText = stripMarkdownForSpeech(text);

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
      return NextResponse.json({ audioUrl: null });
    }

    // Convert audio to base64
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

    return NextResponse.json({ audioUrl });
  } catch (error) {
    console.error('Voice generation error:', error);
    return NextResponse.json({ audioUrl: null });
  }
}
