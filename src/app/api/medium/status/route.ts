import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user, error } = await supabase
      .from('User')
      .select('mediumUsername')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return NextResponse.json({ connected: false, username: null });
    }

    return NextResponse.json({
      connected: !!user?.mediumUsername,
      username: user?.mediumUsername || null,
    });
  } catch (error) {
    console.error('Medium status error:', error);
    return NextResponse.json({ connected: false, username: null });
  }
}
