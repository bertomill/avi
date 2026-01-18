import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { validateMediumUsername, getMediumAnalytics } from '@/lib/medium';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username } = await request.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Medium username is required' },
        { status: 400 }
      );
    }

    // Clean username (remove @ if present, trim whitespace)
    const cleanUsername = username.trim().replace(/^@/, '');

    if (!cleanUsername) {
      return NextResponse.json(
        { error: 'Invalid username' },
        { status: 400 }
      );
    }

    // Validate username exists by fetching feed
    const isValid = await validateMediumUsername(cleanUsername);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Could not find Medium profile. Please check the username.' },
        { status: 404 }
      );
    }

    // Store username in User table
    const { error: updateError } = await supabase
      .from('User')
      .update({ mediumUsername: cleanUsername })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json(
        { error: 'Failed to save Medium connection' },
        { status: 500 }
      );
    }

    // Return initial data
    const analytics = await getMediumAnalytics(cleanUsername);

    return NextResponse.json({
      success: true,
      username: cleanUsername,
      articleCount: analytics?.articles.length || 0,
    });
  } catch (error) {
    console.error('Error connecting Medium:', error);
    return NextResponse.json(
      { error: 'Failed to connect Medium account' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Remove Medium username from User table
    const { error: updateError } = await supabase
      .from('User')
      .update({ mediumUsername: null })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Error disconnecting Medium:', updateError);
      return NextResponse.json(
        { error: 'Failed to disconnect Medium account' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Medium:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Medium account' },
      { status: 500 }
    );
  }
}
