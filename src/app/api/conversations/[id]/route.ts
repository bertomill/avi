import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET - Get a specific conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from('Conversation')
      .select('*')
      .eq('id', id)
      .eq('userId', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching conversation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ conversation: data });
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

// PUT - Update a conversation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { title, messages } = await request.json();

    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) updateData.title = title;
    if (messages !== undefined) updateData.messages = messages;

    const { data, error } = await supabase
      .from('Conversation')
      .update(updateData)
      .eq('id', id)
      .eq('userId', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating conversation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversation: data });
  } catch (error) {
    console.error('Update conversation error:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}

// DELETE - Delete a conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from('Conversation')
      .delete()
      .eq('id', id)
      .eq('userId', session.user.id);

    if (error) {
      console.error('Error deleting conversation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
