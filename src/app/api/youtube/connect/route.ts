import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { extractChannelIdentifier, resolveChannelId, getChannelDataById } from '@/lib/youtube';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelInput } = await request.json();

    if (!channelInput || typeof channelInput !== 'string') {
      return NextResponse.json(
        { error: 'Channel URL or username is required' },
        { status: 400 }
      );
    }

    // Extract channel identifier from input
    const identifier = extractChannelIdentifier(channelInput);
    if (!identifier) {
      return NextResponse.json(
        { error: 'Invalid YouTube channel URL or username' },
        { status: 400 }
      );
    }

    // Resolve to channel ID
    const channelId = await resolveChannelId(identifier);
    if (!channelId) {
      return NextResponse.json(
        { error: 'Could not find YouTube channel. Please check the URL or username.' },
        { status: 404 }
      );
    }

    // Verify the channel exists and get basic info
    const channelData = await getChannelDataById(channelId);
    if (!channelData) {
      return NextResponse.json(
        { error: 'Could not fetch channel data' },
        { status: 404 }
      );
    }

    // Store the YouTube channel ID in the user record
    const { error: updateError } = await supabase
      .from('User')
      .update({
        youtubeChannelId: channelId,
      })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json(
        { error: 'Failed to save channel connection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      channel: {
        id: channelData.id,
        title: channelData.title,
        thumbnailUrl: channelData.thumbnailUrl,
        subscriberCount: channelData.subscriberCount,
      },
    });
  } catch (error) {
    console.error('Error connecting YouTube channel:', error);
    return NextResponse.json(
      { error: 'Failed to connect YouTube channel' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Remove the YouTube channel ID from user record
    const { error: updateError } = await supabase
      .from('User')
      .update({
        youtubeChannelId: null,
      })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json(
        { error: 'Failed to disconnect channel' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting YouTube channel:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect YouTube channel' },
      { status: 500 }
    );
  }
}
