import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMediumAnalytics } from '@/lib/medium';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's Medium username
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('mediumUsername')
      .eq('id', session.user.id)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }

    if (!user?.mediumUsername) {
      return NextResponse.json(
        { error: 'No Medium account connected' },
        { status: 400 }
      );
    }

    const analytics = await getMediumAnalytics(user.mediumUsername);

    if (!analytics) {
      return NextResponse.json(
        { error: 'Could not fetch Medium data' },
        { status: 500 }
      );
    }

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Medium API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Medium data' },
      { status: 500 }
    );
  }
}

export async function POST() {
  // Refresh endpoint - just re-fetches RSS
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabase
      .from('User')
      .select('mediumUsername')
      .eq('id', session.user.id)
      .single();

    if (!user?.mediumUsername) {
      return NextResponse.json(
        { error: 'No Medium account connected' },
        { status: 400 }
      );
    }

    const analytics = await getMediumAnalytics(user.mediumUsername);

    if (!analytics) {
      return NextResponse.json(
        { error: 'Could not refresh Medium data' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, ...analytics });
  } catch (error) {
    console.error('Medium refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh Medium data' },
      { status: 500 }
    );
  }
}
