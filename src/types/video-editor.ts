import { VideoAnalysis, TimestampedNote } from './index';

export type EditOperationType = 'trim-start' | 'trim-end' | 'cut' | 'highlight';

export interface EditSuggestion {
  id: string;
  type: EditOperationType;
  startTime: number;
  endTime?: number;
  reason: string;
  confidence: number;
  source: 'delivery' | 'pacing' | 'content' | 'engagement' | 'keyMoment';
  originalTimestamp?: string;
}

export interface HighlightClip {
  id: string;
  startTime: number;
  endTime: number;
  note: string;
  selected: boolean;
}

export interface VideoEditState {
  originalDuration: number;
  trimStart: number;
  trimEnd: number;
  cuts: { start: number; end: number }[];
  suggestions: EditSuggestion[];
  highlightClips: HighlightClip[];
}

export interface EditedVideoResult {
  blob: Blob;
  url: string;
  duration: number;
  editsApplied: string[];
}

export interface VideoEditorProps {
  video: {
    url: string;
    blob: Blob;
    title: string;
    duration: number;
  };
  analysis?: VideoAnalysis;
  onSave: (editedVideo: { url: string; blob: Blob; title: string; duration: number }) => void;
  onCancel: () => void;
}

export interface TimelineMarker {
  time: number;
  label: string;
  type: 'keyMoment' | 'suggestion' | 'cut';
  color: string;
}
