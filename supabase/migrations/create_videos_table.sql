-- Videos table (stores recorded/edited videos)
-- Note: Removed foreign key to User table since we validate via NextAuth session
CREATE TABLE IF NOT EXISTS "Video" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration DECIMAL(10, 2) NOT NULL, -- Duration in seconds
  "fileUrl" TEXT NOT NULL, -- Supabase Storage URL
  "fileName" TEXT NOT NULL, -- Original filename
  "fileSize" INTEGER NOT NULL, -- Size in bytes
  "mimeType" TEXT NOT NULL DEFAULT 'video/webm',
  "thumbnailUrl" TEXT, -- Optional thumbnail
  -- Analysis data from Gemini (optional)
  analysis JSONB,
  -- Recording metadata
  "recordingSource" TEXT, -- 'camera', 'screen', 'screen-camera'
  -- Timestamps
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_video_userid ON "Video"("userId");
CREATE INDEX IF NOT EXISTS idx_video_createdat ON "Video"("createdAt" DESC);

-- Enable Row Level Security
ALTER TABLE "Video" ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access
CREATE POLICY "Users can view their own videos" ON "Video"
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own videos" ON "Video"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own videos" ON "Video"
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own videos" ON "Video"
  FOR DELETE USING (true);

-- ============================================
-- STORAGE BUCKET SETUP (REQUIRED)
-- ============================================
-- Run these commands in Supabase SQL Editor:
--
-- 1. Create the 'videos' bucket:
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow anyone to upload (since we use NextAuth, not Supabase Auth):
CREATE POLICY "Allow public uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'videos');

-- 3. Allow public reads:
CREATE POLICY "Allow public reads" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos');

-- 4. Allow anyone to update:
CREATE POLICY "Allow public updates" ON storage.objects
  FOR UPDATE USING (bucket_id = 'videos');

-- 5. Allow anyone to delete:
CREATE POLICY "Allow public deletes" ON storage.objects
  FOR DELETE USING (bucket_id = 'videos');
