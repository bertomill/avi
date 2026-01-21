import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const maxDuration = 60; // 60 seconds for video uploads

// GET - List user's videos
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: videos, error } = await supabase
      .from('Video')
      .select('*')
      .eq('userId', session.user.id)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('Error fetching videos:', error);
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
    }

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Videos GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Upload a new video
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const title = formData.get('title') as string;
    const duration = parseFloat(formData.get('duration') as string);
    const recordingSource = formData.get('recordingSource') as string;
    const analysisJson = formData.get('analysis') as string;

    if (!videoFile || !title) {
      return NextResponse.json({ error: 'Video file and title are required' }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${session.user.id}/${timestamp}_${sanitizedTitle}.webm`;

    // Upload to Supabase Storage
    const arrayBuffer = await videoFile.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, arrayBuffer, {
        contentType: 'video/webm',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      // Provide more helpful error messages
      let errorMessage = 'Failed to upload video';
      if (uploadError.message?.includes('Bucket not found')) {
        errorMessage = 'Storage bucket "videos" not found. Please run the migration SQL to create it.';
      } else if (uploadError.message?.includes('row-level security')) {
        errorMessage = 'Storage permission denied. Please run the migration SQL to set up storage policies.';
      } else if (uploadError.message) {
        errorMessage = `Upload failed: ${uploadError.message}`;
      }
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName);

    // Parse analysis if provided
    let analysis = null;
    if (analysisJson) {
      try {
        analysis = JSON.parse(analysisJson);
      } catch {
        // Ignore parsing errors
      }
    }

    // Save metadata to database
    const { data: video, error: dbError } = await supabase
      .from('Video')
      .insert({
        userId: session.user.id,
        title,
        duration,
        fileUrl: urlData.publicUrl,
        fileName,
        fileSize: videoFile.size,
        mimeType: videoFile.type || 'video/webm',
        recordingSource: recordingSource || null,
        analysis,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Try to clean up uploaded file
      await supabase.storage.from('videos').remove([fileName]);
      // Provide more helpful error message
      let errorMessage = 'Failed to save video metadata';
      if (dbError.message?.includes('relation') && dbError.message?.includes('does not exist')) {
        errorMessage = 'Video table not found. Please run the migration SQL to create it.';
      } else if (dbError.message?.includes('violates foreign key')) {
        errorMessage = 'User not found in database. Please ensure your account exists.';
      } else if (dbError.message) {
        errorMessage = `Database error: ${dbError.message}`;
      }
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    return NextResponse.json({ video });
  } catch (error) {
    console.error('Videos POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a video
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    // Get video to verify ownership and get filename
    const { data: video, error: fetchError } = await supabase
      .from('Video')
      .select('*')
      .eq('id', videoId)
      .eq('userId', session.user.id)
      .single();

    if (fetchError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('videos')
      .remove([video.fileName]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('Video')
      .delete()
      .eq('id', videoId)
      .eq('userId', session.user.id);

    if (dbError) {
      console.error('Database delete error:', dbError);
      return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Videos DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
