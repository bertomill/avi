-- X Profile table (stores user profile data)
CREATE TABLE IF NOT EXISTS "XProfile" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  name TEXT,
  description TEXT,
  "profileImageUrl" TEXT,
  "followersCount" INTEGER DEFAULT 0,
  "followingCount" INTEGER DEFAULT 0,
  "tweetCount" INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "syncedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("userId")
);

-- X Tweet table (stores individual tweets)
CREATE TABLE IF NOT EXISTS "XTweet" (
  id TEXT PRIMARY KEY,
  "profileId" TEXT NOT NULL REFERENCES "XProfile"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE,
  "impressionCount" INTEGER DEFAULT 0,
  "likeCount" INTEGER DEFAULT 0,
  "retweetCount" INTEGER DEFAULT 0,
  "replyCount" INTEGER DEFAULT 0,
  "quoteCount" INTEGER DEFAULT 0,
  "syncedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_xprofile_userid ON "XProfile"("userId");
CREATE INDEX IF NOT EXISTS idx_xtweet_profileid ON "XTweet"("profileId");
CREATE INDEX IF NOT EXISTS idx_xtweet_userid ON "XTweet"("userId");
CREATE INDEX IF NOT EXISTS idx_xtweet_createdat ON "XTweet"("createdAt" DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE "XProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "XTweet" ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access
CREATE POLICY "Users can view their own X profile" ON "XProfile"
  FOR SELECT USING (true);

CREATE POLICY "Users can view their own X tweets" ON "XTweet"
  FOR SELECT USING (true);
