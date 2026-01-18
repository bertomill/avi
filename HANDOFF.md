# Avi - Social Media Content Dashboard: Engineering Handoff

**Last Updated:** January 17, 2026
**Status:** YouTube Integration Complete, Ready for Instagram

---

## Project Overview

Avi is a Next.js application that connects to social media platforms for read-only analytics and integrates Claude AI for content ideation and editing assistance. The goal is to give content creators a dashboard to view engagement data and get AI-powered recommendations.

---

## What's Been Built

### Tech Stack
- **Framework:** Next.js 16 with App Router + Turbopack
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Auth:** NextAuth.js (Credentials + Google OAuth for YouTube linking)
- **Database:** SQLite with Prisma 6
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)

### Project Structure
```
avi/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page with hero + features
│   │   ├── layout.tsx                  # Root layout with SessionProvider
│   │   ├── login/page.tsx              # Login page (username/password)
│   │   ├── dashboard/page.tsx          # Main dashboard (analytics + AI tabs)
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts    # NextAuth handler
│   │       │   └── link-youtube/
│   │       │       ├── route.ts              # Initiates Google OAuth for linking
│   │       │       └── callback/route.ts     # Handles OAuth callback, saves tokens
│   │       ├── signup/route.ts               # User registration endpoint
│   │       ├── youtube/
│   │       │   ├── route.ts                  # GET: fetch analytics, POST: sync
│   │       │   └── status/route.ts           # GET: check if YouTube is connected
│   │       └── claude/route.ts               # POST: AI chat/ideas/analysis
│   ├── components/
│   │   ├── ConnectButton.tsx           # Shows user info + "Connect YouTube" button
│   │   ├── YouTubeAnalytics.tsx        # Full analytics dashboard component
│   │   ├── ContentAssistant.tsx        # AI chat interface with quick actions
│   │   └── Providers.tsx               # NextAuth SessionProvider wrapper
│   ├── lib/
│   │   ├── auth.ts                     # NextAuth config (Credentials + Google provider)
│   │   ├── youtube.ts                  # YouTube Data API v3 client
│   │   ├── claude.ts                   # Claude API client with context builder
│   │   └── prisma.ts                   # Prisma client singleton
│   └── types/index.ts                  # TypeScript interfaces
├── prisma/
│   ├── schema.prisma                   # Database schema
│   ├── migrations/                     # Migration files
│   └── dev.db                          # SQLite database
├── .env                                # Environment variables (has API keys)
├── .env.local.example                  # Template for new developers
└── package.json
```

### Database Schema (Prisma)
- **User** - User accounts (username, password hash, name, email)
- **Account** - OAuth account links (stores Google access/refresh tokens)
- **Session** - User sessions
- **VerificationToken** - Email verification
- **YouTubeChannel** - Cached channel data (subscribers, views, etc.)
- **YouTubeVideo** - Cached video data (views, likes, comments, duration)
- **Conversation** - AI chat history (for future use)
- **Message** - Individual chat messages (for future use)

---

## Authentication Flow

The app uses a **two-step authentication model**:

1. **Login/Signup:** Users create account with username/password (credentials provider)
2. **Link YouTube:** After logging in, users click "Connect YouTube" to OAuth with Google

This allows users to have a single Avi account and link multiple social platforms to it.

### Key Auth Files
- `src/lib/auth.ts` - NextAuth config with CredentialsProvider + GoogleProvider
- `src/app/api/signup/route.ts` - Creates new user with hashed password
- `src/app/api/auth/link-youtube/route.ts` - Redirects to Google OAuth
- `src/app/api/auth/link-youtube/callback/route.ts` - Exchanges code for tokens, links to user

### Google OAuth Redirect URI
```
http://localhost:3000/api/auth/link-youtube/callback
```
This must be added in Google Cloud Console under OAuth 2.0 Client > Authorized redirect URIs.

---

## Features Implemented

### 1. Landing Page (`/`)
- Hero section with gradient background
- "Get Started" button → login page
- Feature highlights (Analytics, AI Ideas, Growth Strategy)
- Auto-redirects to dashboard if authenticated

### 2. Login Page (`/login`)
- Username/password login form
- Link to signup
- Creates session via NextAuth credentials provider

### 3. Dashboard (`/dashboard`)
- Two tabs: YouTube Analytics and AI Assistant
- Protected route (redirects to `/` if not authenticated)
- Header shows "Connect YouTube" button if not linked, or "YouTube Connected" badge if linked

### 4. YouTube Analytics Tab
- Shows "Connect YouTube" prompt if not linked
- Once connected:
  - Channel header with profile image, title, subscriber count
  - Stats grid (subscribers, total views, video count)
  - Recent performance (last 10 videos aggregated)
  - Top 5 performing videos with engagement rates
  - Full video table with all videos
  - Refresh/sync button

### 5. AI Assistant Tab
- Chat interface with Claude
- Quick action buttons:
  - Content Ideas (generates 5 video ideas)
  - Analyze Gaps (identifies content opportunities)
  - Title Help (optimizes titles)
  - Strategy Review (overall recommendations)
- **Context-aware:** AI receives channel stats, top videos, recent content in system prompt
- Works even without YouTube connected (empty context)

### 6. API Routes
- `POST /api/signup` - Create new user account
- `GET /api/youtube/status` - Check if YouTube is connected
- `GET /api/youtube` - Fetch fresh analytics from YouTube API
- `POST /api/youtube` - Force sync data to database
- `POST /api/claude` - Chat with AI (actions: chat, ideas, optimize-title, analyze-gaps)

---

## Current Status

### Working (Tested & Verified)
- User signup with username/password
- User login with credentials
- YouTube account linking via OAuth
- YouTube analytics display (channel stats, videos, engagement)
- AI assistant with YouTube context
- All quick actions (Content Ideas, Analyze Gaps, etc.)

### Test Account
- Username: `berto`
- YouTube Channel: Berto Mill (@bertovmill)
- Stats: 165 subscribers, 21.4K views, 56 videos

---

## Environment Variables

All keys are in `.env` file:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generated>

# Google OAuth (for YouTube)
GOOGLE_CLIENT_ID=<configured>
GOOGLE_CLIENT_SECRET=<configured>

# Anthropic
ANTHROPIC_API_KEY=<configured>

# Other APIs (not yet integrated)
ELEVENLABS_API_KEY=<configured>
INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET
X_CLIENT_ID / X_CLIENT_SECRET / X_BEARER_TOKEN
TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
SUPABASE keys
```

---

## What's Next

### Phase 1: Instagram Integration (NEXT UP)
Instagram requires:
- Facebook App in Meta Developer Console
- Instagram Business or Creator account
- Facebook Page linked to Instagram account

Implementation tasks:
- [ ] Add Instagram OAuth flow (Meta/Facebook login)
- [ ] Create `/api/auth/link-instagram` routes
- [ ] Create `/api/instagram` routes for fetching insights
- [ ] Create `InstagramAnalytics.tsx` component
- [ ] Add Instagram tab to dashboard
- [ ] Pass Instagram data to AI context

### Phase 2: Enhance AI Features
- [ ] Save conversation history to database
- [ ] Stream AI responses for better UX
- [ ] Add markdown rendering in chat
- [ ] Cross-platform content recommendations

### Phase 3: Additional Platforms
- [ ] X/Twitter (Twitter API v2)
- [ ] TikTok (TikTok API)
- [ ] Platform selector/switcher in dashboard
- [ ] Unified analytics view across platforms

### Phase 4: Advanced Features
- [ ] Content calendar / scheduling
- [ ] A/B title testing suggestions
- [ ] Competitor analysis
- [ ] Trend detection
- [ ] Export reports

---

## How to Run

```bash
# Install dependencies
npm install

# Run database migrations (if needed)
npx prisma migrate dev

# Start development server
npm run dev

# Open http://localhost:3000
```

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | NextAuth config, Credentials + Google providers |
| `src/lib/youtube.ts` | YouTube API calls (channel, videos, analytics) |
| `src/lib/claude.ts` | Claude system prompt builder with channel context |
| `src/app/api/auth/link-youtube/` | YouTube OAuth linking flow |
| `src/components/YouTubeAnalytics.tsx` | Main analytics dashboard UI |
| `src/components/ContentAssistant.tsx` | AI chat interface |
| `src/components/ConnectButton.tsx` | Connect YouTube / user status |
| `prisma/schema.prisma` | Database models |

---

## Known Issues

1. **Token Refresh:** The current implementation doesn't handle OAuth token refresh. If tokens expire (1 hour for Google), users will need to re-link their YouTube account.

2. **BigInt Serialization:** YouTube view counts use BigInt in the database. May need JSON serialization handling if returning raw Prisma objects.

3. **Prisma Version:** Using Prisma 6 (not 7) because Prisma 7 requires adapter configuration that was causing build issues.

---

## Contact

Project Owner: Bertmill19@gmail.com

---

*Good luck, next engineer!*
