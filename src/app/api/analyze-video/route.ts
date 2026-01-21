import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const maxDuration = 300; // 5 minutes for video processing

const ANALYSIS_PROMPT = `You are a professional video coach analyzing a creator's video recording.
Provide detailed, constructive feedback in JSON format with the following structure:

{
  "overallScore": <number 1-10>,
  "delivery": {
    "score": <number 1-10>,
    "feedback": "<1-2 sentence assessment>",
    "tips": ["<actionable tip 1>", "<actionable tip 2>"],
    "timestamps": [
      {"timestamp": "0:05", "note": "<what happened at this moment>"},
      {"timestamp": "0:12-0:18", "note": "<what happened in this range>"}
    ]
  },
  "pacing": {
    "score": <number 1-10>,
    "feedback": "<1-2 sentence assessment>",
    "tips": ["<actionable tip 1>", "<actionable tip 2>"],
    "timestamps": [
      {"timestamp": "0:08", "note": "<pacing observation>"}
    ]
  },
  "content": {
    "score": <number 1-10>,
    "feedback": "<1-2 sentence assessment>",
    "tips": ["<actionable tip 1>", "<actionable tip 2>"],
    "timestamps": [
      {"timestamp": "0:00-0:03", "note": "<content observation>"}
    ]
  },
  "engagement": {
    "score": <number 1-10>,
    "feedback": "<1-2 sentence assessment>",
    "tips": ["<actionable tip 1>", "<actionable tip 2>"],
    "timestamps": [
      {"timestamp": "0:15", "note": "<engagement observation>"}
    ]
  },
  "summary": "<2-3 sentence overall summary>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "keyMoments": [
    {"timestamp": "0:02", "note": "Strong opening hook"},
    {"timestamp": "0:10", "note": "Energy dip - consider re-recording"},
    {"timestamp": "0:25", "note": "Great call-to-action"}
  ]
}

IMPORTANT: Include specific timestamps (format: "M:SS" or "M:SS-M:SS" for ranges) for each category observation. Reference exact moments in the video where you noticed something noteworthy - both positive and areas for improvement.

Evaluate:
- DELIVERY: Eye contact, energy, confidence, vocal clarity, body language
- PACING: Speed, pauses, rhythm, transitions between points
- CONTENT: Structure, clarity of message, hook effectiveness, call-to-action
- ENGAGEMENT: Enthusiasm, authenticity, viewer connection, entertainment value

Be encouraging but honest. Give specific, actionable feedback with precise timestamps. Return ONLY valid JSON.`;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const contentType = request.headers.get('content-type') || '';

    let videoData: string;
    let mimeType: string = 'video/webm';

    if (contentType.includes('application/json')) {
      // Inline base64 video
      const body = await request.json();
      videoData = body.videoData;
      mimeType = body.mimeType || 'video/webm';
    } else if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData();
      const videoFile = formData.get('video') as File;

      if (!videoFile) {
        return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
      }

      // Convert to base64
      const arrayBuffer = await videoFile.arrayBuffer();
      videoData = Buffer.from(arrayBuffer).toString('base64');
      mimeType = videoFile.type || 'video/webm';
    } else {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    // Call Gemini with the video
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: videoData,
        },
      },
      { text: ANALYSIS_PROMPT },
    ]);

    const response = result.response;
    const text = response.text();

    // Parse JSON from response (handle markdown code blocks)
    let analysis;
    try {
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ||
                        text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      return NextResponse.json(
        { error: 'Failed to parse analysis response' },
        { status: 500 }
      );
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Video analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze video' },
      { status: 500 }
    );
  }
}
