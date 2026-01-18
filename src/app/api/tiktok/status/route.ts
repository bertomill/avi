import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ connected: false });
    }

    // Check if user has a TikTok account linked
    const { data: account } = await supabase
      .from('Account')
      .select('id, providerAccountId')
      .eq('userId', session.user.id)
      .eq('provider', 'tiktok')
      .single();

    return NextResponse.json({
      connected: !!account,
      accountId: account?.providerAccountId || null,
    });
  } catch (error) {
    console.error('Error checking TikTok status:', error);
    return NextResponse.json({ connected: false });
  }
}
