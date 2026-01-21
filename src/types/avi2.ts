// Avi2 Cockpit Types

// Chat message types
export interface Avi2Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  data: unknown;
}

// Video idea from Content Master
export interface VideoIdea {
  title: string;
  description: string;
  hook?: string;
  targetAudience?: string;
}

// Teleprompter script
export interface TeleprompterScript {
  title: string;
  sections: ScriptSection[];
}

export interface ScriptSection {
  heading?: string;
  content: string;
  duration?: number; // estimated seconds
}

// Recording states
export type RecordingState = 'idle' | 'countdown' | 'recording' | 'preview';
export type RecordingSource = 'camera' | 'screen' | 'screen-camera';

// Recorded video
export interface RecordedVideo {
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
}

// Video Coach analysis (from Gemini)
export interface VideoCoachAnalysis {
  overallScore: number;
  delivery: AnalysisCategory;
  pacing: AnalysisCategory;
  content: AnalysisCategory;
  engagement: AnalysisCategory;
  summary: string;
  strengths: string[];
  improvements: string[];
  keyMoments?: TimestampedNote[];
}

export interface AnalysisCategory {
  score: number;
  feedback: string;
  tips: string[];
  timestamps?: TimestampedNote[];
}

export interface TimestampedNote {
  timestamp: string;
  note: string;
}

// Platform stats
export interface PlatformStats {
  platform: 'youtube' | 'instagram' | 'tiktok' | 'x' | 'medium';
  connected: boolean;
  stats?: Record<string, number | string>;
  error?: string;
}

// Content Master tool definitions
export type ContentMasterTool =
  | 'get_youtube_stats'
  | 'get_instagram_stats'
  | 'get_tiktok_stats'
  | 'get_x_stats'
  | 'get_medium_stats'
  | 'show_video_ideas'
  | 'set_teleprompter';

// Export modal options
export interface ExportOptions {
  format: 'download' | 'youtube';
  title: string;
  description: string;
  privacy?: 'private' | 'unlisted' | 'public';
}

// Video Coach panel state
export interface VideoCoachState {
  isAnalyzing: boolean;
  analysis: VideoCoachAnalysis | null;
  error: string | null;
}

// Cockpit overall state
export interface CockpitState {
  // Left panel - Content Master
  messages: Avi2Message[];
  isStreaming: boolean;
  videoIdeas: VideoIdea[];

  // Center - Video Recorder
  recordingState: RecordingState;
  recordingSource: RecordingSource;
  recordedVideo: RecordedVideo | null;
  teleprompterScript: TeleprompterScript | null;

  // Right panel - Video Coach
  videoCoach: VideoCoachState;

  // Modals
  showExportModal: boolean;
}
