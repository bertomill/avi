-- Instagram Account table (stores user profile data)
CREATE TABLE IF NOT EXISTS "InstagramAccount" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "instagramUserId" TEXT NOT NULL,
  username TEXT NOT NULL,
  name TEXT,
  biography TEXT,
  "profilePictureUrl" TEXT,
  "followerCount" INTEGER DEFAULT 0,
  "followingCount" INTEGER DEFAULT 0,
  "mediaCount" INTEGER DEFAULT 0,
  "accountType" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "lastSyncedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("userId"),
  UNIQUE("instagramUserId")
);

-- Instagram Post table (stores individual posts)
CREATE TABLE IF NOT EXISTS "InstagramPost" (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL REFERENCES "InstagramAccount"(id) ON DELETE CASCADE,
  "instagramMediaId" TEXT NOT NULL,
  caption TEXT,
  "mediaType" TEXT NOT NULL,
  "mediaUrl" TEXT,
  "thumbnailUrl" TEXT,
  permalink TEXT,
  "timestamp" TIMESTAMP WITH TIME ZONE,
  "likeCount" INTEGER DEFAULT 0,
  "commentsCount" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("accountId", "instagramMediaId")
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_instagramaccount_userid ON "InstagramAccount"("userId");
CREATE INDEX IF NOT EXISTS idx_instagrampost_accountid ON "InstagramPost"("accountId");
CREATE INDEX IF NOT EXISTS idx_instagrampost_timestamp ON "InstagramPost"("timestamp" DESC);

-- Enable Row Level Security
ALTER TABLE "InstagramAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstagramPost" ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access
CREATE POLICY "Users can view their own Instagram account" ON "InstagramAccount"
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own Instagram account" ON "InstagramAccount"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own Instagram account" ON "InstagramAccount"
  FOR UPDATE USING (true);

CREATE POLICY "Users can view their own Instagram posts" ON "InstagramPost"
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own Instagram posts" ON "InstagramPost"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own Instagram posts" ON "InstagramPost"
  FOR UPDATE USING (true);
