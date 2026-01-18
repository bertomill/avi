import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: account } = await supabase
    .from('Account')
    .select('id, expires_at')
    .eq('userId', session.user.id)
    .eq('provider', 'google')
    .single();

  return NextResponse.json({
    connected: !!account,
    expired: account?.expires_at ? account.expires_at < Math.floor(Date.now() / 1000) : false,
  });
}
