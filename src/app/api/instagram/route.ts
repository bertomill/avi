import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFullAnalytics, syncAccountToDatabase, getCachedAnalytics } from '@/lib/instagram';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's Instagram account access token
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'instagram',
      },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }

    // Try to get fresh data from Instagram API
    const analytics = await getFullAnalytics(
      account.providerAccountId,
      account.access_token
    );

    if (!analytics) {
      // Fall back to cached data if API fails
      const cached = await getCachedAnalytics(session.user.id);
      if (cached) {
        return NextResponse.json(cached);
      }
      return NextResponse.json(
        { error: 'Could not fetch Instagram data' },
        { status: 500 }
      );
    }

    // Sync to database in the background
    syncAccountToDatabase(
      session.user.id,
      account.providerAccountId,
      account.access_token
    ).catch(console.error);

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

    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'instagram',
      },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }

    // Force sync to database
    await syncAccountToDatabase(
      session.user.id,
      account.providerAccountId,
      account.access_token
    );

    return NextResponse.json({ success: true, message: 'Data synced' });
  } catch (error) {
    console.error('Instagram sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Instagram data' },
      { status: 500 }
    );
  }
}
