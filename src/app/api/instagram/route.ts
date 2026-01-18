import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFullAnalytics } from '@/lib/instagram';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: account } = await supabase
      .from('Account')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'instagram')
      .single();

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }

    const analytics = await getFullAnalytics(
      account.providerAccountId,
      account.access_token
    );

    if (!analytics) {
      return NextResponse.json(
        { error: 'Could not fetch Instagram data' },
        { status: 500 }
      );
    }

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Instagram API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Instagram data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: account } = await supabase
      .from('Account')
      .select('*')
      .eq('userId', session.user.id)
      .eq('provider', 'instagram')
      .single();

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Data synced' });
  } catch (error) {
    console.error('Instagram sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Instagram data' },
      { status: 500 }
    );
  }
}
