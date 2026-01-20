# Avi Agent Architecture

## Overview
Avi uses a multi-agent system where specialized agents collaborate to help content creators produce better content.

## The Three Agents

### 1. Frontline Agent (ElevenLabs)
The voice and audio interface for creator interactions.

**Purpose**: Handle voice-based interactions and audio content generation
**Powered by**: ElevenLabs
**Capabilities**:
- Voice cloning for consistent creator voice
- Text-to-speech for script previews
- Audio content generation
- Voice-based commands and responses
- Podcast/voiceover creation assistance

---

### 2. Researcher Agent (Claude Code)
The analytical brain that gathers insights and information.

**Purpose**: Deep research, analysis, and content strategy
**Powered by**: Claude Code (Claude Agent SDK)
**Capabilities**:
- Analyze trending topics across platforms
- Research competitor content strategies
- Gather data from connected social channels
- Identify content gaps and opportunities
- Generate detailed content briefs
- SEO and keyword research

---

### 3. Audience Agent (Ideal Client Profile)
Represents and embodies the creator's target audience.

**Purpose**: Provide audience perspective and feedback
**Powered by**: Claude with custom persona
**Capabilities**:
- Simulate audience reactions to content ideas
- Predict engagement based on audience preferences
- Provide feedback from the audience's point of view
- Help refine messaging and tone
- Identify what resonates with target demographics
- Answer "Would my audience like this?"

---

## Agent Collaboration Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Creator Request                       │
│            "Help me create a video about X"             │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Frontline Agent (ElevenLabs)               │
│         Receives voice command, routes request          │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌──────────────────────┐    ┌──────────────────────┐
│   Researcher Agent   │    │   Audience Agent     │
│    (Claude Code)     │    │ (Ideal Client)       │
│                      │    │                      │
│ • Research topic     │    │ • "Would I watch     │
│ • Find trends        │    │    this?"            │
│ • Analyze data       │    │ • "What hooks me?"   │
│ • Draft strategy     │    │ • "What's missing?"  │
└──────────┬───────────┘    └──────────┬───────────┘
           │                           │
           └─────────────┬─────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Combined Recommendation                     │
│   Research-backed idea validated by audience persona    │
└─────────────────────────────────────────────────────────┘
```

## Example Interaction

**Creator**: "What should my next YouTube video be about?"

**Researcher Agent**: "Based on your channel analytics, videos about [topic] get 2x more engagement. Trending searches show interest in [subtopic]. Your competitors haven't covered [angle] yet."

**Audience Agent**: "As your ideal viewer, I'd click on a video about [topic] if it promised [specific outcome]. I'd scroll past if it seemed too basic—I want advanced tips."

**Frontline Agent**: "Here's a script outline combining these insights. Want me to read it back to you?"
