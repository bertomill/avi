# Avi - Social Media Content Dashboard: Engineering Handoff

**Last Updated:** January 18, 2026
**Status:** YouTube Fully Working with Database Sync, Multi-Platform UI Ready
**Production URL:** https://flowv.site

---

## Project Overview

Avi is a Next.js application that connects to social media platforms for read-only analytics and integrates Claude AI for content ideation and editing assistance. Content creators can view engagement data across platforms and get AI-powered recommendations based on their historical performance data stored in Supabase.

---

## What's Been Built

### Tech Stack
- **Framework:** Next.js 16 with App Router + Turbopack
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Auth:** NextAuth.js (Credentials-based login)
- **Database:** Supabase PostgreSQL (moved from Prisma/SQLite)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Hosting:** Vercel

### Project Structure
```
avi/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page
│   │   ├── layout.tsx                  # Root layout with SessionProvider
│   │   ├── login/page.tsx              # Login page (username/password)
│   │   ├── dashboard/page.tsx          # Main dashboard (multi-platform tabs)
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts    # NextAuth handler
│   │       │   ├── link-youtube/             # YouTube OAuth (legacy, kept for reference)
│   │       │   ├── instagram/                # Instagram OAuth routes
│   │       │   ├── link-tiktok/              # TikTok OAuth routes
│   │       │   └── link-x/                   # X/Twitter OAuth routes
│   │       ├── signup/route.ts               # User registration
│   │       ├── youtube/
│   │       │   ├── route.ts                  # GET: fetch analytics, POST: sync to DB
│   │       │   ├── status/route.ts           # GET: check if connected
│   │       │   └── connect/route.ts          # POST: connect by username (no OAuth!)
│   │       ├── instagram/
│   │       │   ├── route.ts                  # Instagram analytics
│   │       │   └── status/route.ts           # Connection status
│   │       ├── tiktok/
│   │       │   ├── route.ts                  # TikTok analytics
│   │       │   └── status/route.ts           # Connection status
│   │       ├── x/
│   │       │   ├── route.ts                  # X/Twitter analytics
│   │       │   └── status/route.ts           # Connection status
│   │       ├── medium/
│   │       │   ├── route.ts                  # Medium analytics
│   │       │   ├── status/route.ts           # Connection status
│   │       │   └── connect/route.ts          # Connect by username
│   │       └── claude/route.ts               # AI chat (queries data from Supabase)
│   ├── components/
│   │   ├── ConnectButton.tsx           # Multi-platform connection status
│   │   ├── YouTubeAnalytics.tsx        # YouTube dashboard + username input
│   │   ├── InstagramAnalytics.tsx      # Instagram dashboard
│   │   ├── TikTokAnalytics.tsx         # TikTok dashboard
│   │   ├── XAnalytics.tsx              # X/Twitter dashboard
│   │   ├── MediumAnalytics.tsx         # Medium dashboard
│   │   ├── ContentAssistant.tsx        # AI chat interface
│   │   └── Providers.tsx               # NextAuth SessionProvider
│   ├── lib/
│   │   ├── supabase.ts                 # Supabase client
│   │   ├── auth.ts                     # NextAuth config
│   │   ├── youtube.ts                  # YouTube API (API key-based, no OAuth)
│   │   ├── instagram.ts                # Instagram API client
│   │   ├── tiktok.ts                   # TikTok API client
│   │   ├── x.ts                        # X/Twitter API client
│   │   ├── medium.ts                   # Medium RSS parser
│   │   └── claude.ts                   # Claude AI with database context
│   └── types/index.ts                  # TypeScript interfaces
├── supabase/
│   └── migrations/                     # SQL migration files
├── .env.local.example                  # Environment template
└── package.json
```

---

## Database Schema (Supabase)

### Core Tables
```sql
-- User accounts
"User" (id, username, password, name, email, image, youtubeChannelId, mediumUsername, createdAt)

-- OAuth account links (for platforms requiring OAuth)
"Account" (id, userId, type, provider, providerAccountId, access_token, refresh_token, expires_at, ...)

-- YouTube data (synced from API)
"YouTubeChannel" (id, userId, title, description, customUrl, thumbnailUrl, subscriberCount, videoCount, viewCount, lastSyncedAt)
"YouTubeVideo" (id, channelId, title, description, thumbnailUrl, publishedAt, duration, viewCount, likeCount, commentCount, lastSyncedAt)
```

### Key Indexes
```sql
CREATE INDEX "idx_youtube_channel_user" ON "YouTubeChannel"("userId");
CREATE INDEX "idx_youtube_video_channel" ON "YouTubeVideo"("channelId");
CREATE INDEX "idx_youtube_video_views" ON "YouTubeVideo"("viewCount" DESC);
```

---

## YouTube Integration (WORKING)

### How It Works (No OAuth Required!)
1. User enters `@username` or channel URL in dashboard
2. App uses YouTube Data API v3 with API key to look up channel
3. Channel ID stored in `User.youtubeChannelId`
4. All video data synced to `YouTubeChannel` and `YouTubeVideo` tables
5. AI agent queries data directly from Supabase

### Key Files
- `src/app/api/youtube/connect/route.ts` - Connects channel by username
- `src/app/api/youtube/route.ts` - Fetches analytics & syncs to DB
- `src/lib/youtube.ts` - API client with `getFullAnalyticsByChannelId()`
- `src/components/YouTubeAnalytics.tsx` - UI with username input form

### Environment Variables
```env
YOUTUBE_API_KEY=AIzaSy...  # YouTube Data API v3 key (not OAuth!)
```

---

## AI Agent Integration

### How It Works
1. Claude API queries YouTube data from Supabase (not live API)
2. Builds context with: channel stats, top videos, recent content
3. AI can analyze historical trends and make recommendations

### Key File: `src/app/api/claude/route.ts`
```typescript
// Queries database for AI context
async function buildAIContextFromDatabase(userId: string): Promise<AIContext> {
  const { data: channel } = await supabase
    .from('YouTubeChannel')
    .select('*')
    .eq('userId', userId)
    .single();

  const { data: topVideos } = await supabase
    .from('YouTubeVideo')
    .select('*')
    .eq('channelId', channel.id)
    .order('viewCount', { ascending: false })
    .limit(5);
  // ... builds context for Claude
}
```

---

## Authentication Flow

1. **Signup/Login:** Username + password (NextAuth CredentialsProvider)
2. **Connect Platforms:**
   - YouTube: Just enter @username (no OAuth!)
   - Others: OAuth flows (Instagram, TikTok, X)

### Key Files
- `src/lib/auth.ts` - NextAuth config
- `src/app/api/signup/route.ts` - User registration with bcrypt

---

## Current Status

### ✅ Fully Working
- User signup/login with credentials
- YouTube connection via username (no OAuth)
- YouTube analytics display
- YouTube data synced to Supabase
- AI assistant queries data from database
- Production deployment on Vercel (flowv.site)
- Works with ngrok for local testing

### 🔲 UI Ready, Needs Backend
- Instagram (OAuth flow stubbed)
- TikTok (OAuth flow stubbed)
- X/Twitter (OAuth flow stubbed)
- Medium (RSS-based, partially working)

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# NextAuth
NEXTAUTH_URL=https://flowv.site  # or http://localhost:3000
NEXTAUTH_SECRET=<generated>

# YouTube (API Key - NOT OAuth)
YOUTUBE_API_KEY=AIzaSy...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google OAuth (optional, kept for reference)
GOOGLE_CLIENT_ID=<optional>
GOOGLE_CLIENT_SECRET=<optional>

# Other platforms (for future)
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
X_CLIENT_ID=...
X_CLIENT_SECRET=...
```

---

## How to Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000

# For external testing (ngrok)
ngrok http 3000
```

### Database Setup (Supabase)
Run these SQL commands in Supabase SQL Editor:

```sql
-- Add youtubeChannelId to User table
ALTER TABLE "User" ADD COLUMN "youtubeChannelId" TEXT;

-- Create YouTube tables
CREATE TABLE "YouTubeChannel" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "customUrl" TEXT,
  "thumbnailUrl" TEXT,
  "subscriberCount" BIGINT DEFAULT 0,
  "videoCount" INTEGER DEFAULT 0,
  "viewCount" BIGINT DEFAULT 0,
  "publishedAt" TIMESTAMP WITH TIME ZONE,
  "lastSyncedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE "YouTubeVideo" (
  "id" TEXT PRIMARY KEY,
  "channelId" TEXT NOT NULL REFERENCES "YouTubeChannel"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "thumbnailUrl" TEXT,
  "publishedAt" TIMESTAMP WITH TIME ZONE,
  "duration" TEXT,
  "viewCount" BIGINT DEFAULT 0,
  "likeCount" BIGINT DEFAULT 0,
  "commentCount" BIGINT DEFAULT 0,
  "lastSyncedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client |
| `src/lib/youtube.ts` | YouTube API (API key, extracts channel from URL) |
| `src/lib/claude.ts` | Claude AI with system prompt |
| `src/app/api/youtube/connect/route.ts` | Connect YouTube by username |
| `src/app/api/youtube/route.ts` | Fetch & sync YouTube data |
| `src/app/api/claude/route.ts` | AI chat (queries Supabase) |
| `src/components/YouTubeAnalytics.tsx` | YouTube dashboard UI |
| `src/components/ContentAssistant.tsx` | AI chat UI |

---

## What's Next

### Phase 1: Instagram Integration
- [ ] Set up Meta Developer App
- [ ] Implement Instagram OAuth flow
- [ ] Fetch Instagram insights
- [ ] Save to Supabase tables
- [ ] Add to AI context

### Phase 2: Additional Platforms
- [ ] TikTok API integration
- [ ] X/Twitter API integration
- [ ] Unified cross-platform analytics

### Phase 3: Advanced AI Features
- [ ] Video editing suggestions
- [ ] Content calendar recommendations
- [ ] Trend analysis from historical data
- [ ] Automated content ideas based on performance

---

## Test Account

- **Username:** `berto`
- **YouTube Channel:** @bertovmill (Berto Mill)
- **Production:** https://flowv.site

---

## Contact

Project Owner: Bertmill19@gmail.com

---

*Good luck, next engineer!*
