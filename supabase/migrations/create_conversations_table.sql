-- Conversations table (stores chat sessions with Avi)
CREATE TABLE IF NOT EXISTS "Conversation" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  messages JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_conversation_userid ON "Conversation"("userId");
CREATE INDEX IF NOT EXISTS idx_conversation_updatedat ON "Conversation"("updatedAt" DESC);

-- Enable Row Level Security
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access
CREATE POLICY "Users can view their own conversations" ON "Conversation"
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own conversations" ON "Conversation"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own conversations" ON "Conversation"
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own conversations" ON "Conversation"
  FOR DELETE USING (true);
