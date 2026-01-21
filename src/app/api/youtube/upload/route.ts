import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const maxDuration = 300; // 5 minutes for video uploads

// Refresh access token if expired
async function refreshAccessToken(accountId: string, refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const tokens = await response.json();

    // Update the access token in the database
    await supabase
      .from('Account')
      .update({
        access_token: tokens.access_token,
        expires_at: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : null,
      })
      .eq('id', accountId);

    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// Get valid access token (refresh if needed)
async function getValidAccessToken(userId: string): Promise<{ token: string; error?: string } | null> {
  const { data: account, error } = await supabase
    .from('Account')
    .select('*')
    .eq('userId', userId)
    .eq('provider', 'google')
    .single();

  if (error || !account) {
    return { token: '', error: 'YouTube account not connected. Please connect your YouTube account first.' };
  }

  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at < now) {
    if (account.refresh_token) {
      const newToken = await refreshAccessToken(account.id, account.refresh_token);
      if (newToken) {
        return { token: newToken };
      }
    }
    return { token: '', error: 'YouTube session expired. Please reconnect your YouTube account.' };
  }

  // Check if scope includes upload
  if (account.scope && !account.scope.includes('youtube.upload')) {
    return { token: '', error: 'YouTube upload permission not granted. Please reconnect your YouTube account to grant upload access.' };
  }

  return { token: account.access_token };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get valid access token
    const tokenResult = await getValidAccessToken(session.user.id);
    if (!tokenResult || tokenResult.error) {
      return NextResponse.json(
        { error: tokenResult?.error || 'Failed to get YouTube access' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';
    const privacy = (formData.get('privacy') as string) || 'private'; // private, unlisted, public

    if (!videoFile || !title) {
      return NextResponse.json(
        { error: 'Video file and title are required' },
        { status: 400 }
      );
    }

    // Step 1: Initialize resumable upload
    const metadata = {
      snippet: {
        title,
        description,
        categoryId: '22', // People & Blogs
      },
      status: {
        privacyStatus: privacy,
        selfDeclaredMadeForKids: false,
      },
    };

    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': videoFile.size.toString(),
          'X-Upload-Content-Type': videoFile.type || 'video/webm',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error('YouTube upload init failed:', errorText);

      // Parse specific errors
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          return NextResponse.json({ error: errorJson.error.message }, { status: 400 });
        }
      } catch {
        // Use generic error
      }

      return NextResponse.json(
        { error: 'Failed to initialize YouTube upload' },
        { status: 500 }
      );
    }

    // Get the upload URL from the Location header
    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      return NextResponse.json(
        { error: 'Failed to get upload URL from YouTube' },
        { status: 500 }
      );
    }

    // Step 2: Upload the video file
    const videoBuffer = await videoFile.arrayBuffer();
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': videoFile.type || 'video/webm',
        'Content-Length': videoFile.size.toString(),
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('YouTube video upload failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to upload video to YouTube' },
        { status: 500 }
      );
    }

    const uploadResult = await uploadResponse.json();

    return NextResponse.json({
      success: true,
      videoId: uploadResult.id,
      videoUrl: `https://www.youtube.com/watch?v=${uploadResult.id}`,
      title: uploadResult.snippet?.title,
      status: uploadResult.status?.uploadStatus,
    });
  } catch (error) {
    console.error('YouTube upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload video to YouTube' },
      { status: 500 }
    );
  }
}
