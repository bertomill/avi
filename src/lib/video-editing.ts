import { VideoAnalysis } from '@/types';
import { EditSuggestion, HighlightClip } from '@/types/video-editor';

// Parse timestamp string to seconds
// Handles: "0:05", "1:30", "0:12-0:18"
export function parseTimestamp(ts: string): { start: number; end?: number } {
  if (ts.includes('-')) {
    const [startStr, endStr] = ts.split('-').map(s => s.trim());
    return {
      start: parseTimeToSeconds(startStr),
      end: parseTimeToSeconds(endStr),
    };
  }
  return { start: parseTimeToSeconds(ts) };
}

function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

// Format seconds to timestamp string
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Generate edit suggestions from Gemini analysis
export function generateEditSuggestions(
  analysis: VideoAnalysis,
  duration: number
): EditSuggestion[] {
  const suggestions: EditSuggestion[] = [];
  let idCounter = 0;

  // Check for weak opening - suggest trim start
  if (analysis.delivery && analysis.delivery.score < 7) {
    // Look for first strong keyMoment
    const firstGoodMoment = analysis.keyMoments?.find(m => {
      const note = m.note.toLowerCase();
      return note.includes('hook') ||
             note.includes('strong') ||
             note.includes('energy') ||
             note.includes('engaging') ||
             note.includes('good');
    });

    if (firstGoodMoment) {
      const { start } = parseTimestamp(firstGoodMoment.timestamp);
      if (start > 1 && start < duration * 0.3) {
        suggestions.push({
          id: `suggestion-${idCounter++}`,
          type: 'trim-start',
          startTime: Math.max(0, start - 0.5), // Start slightly before the hook
          reason: `Start at "${firstGoodMoment.note}"`,
          confidence: 0.8,
          source: 'keyMoment',
          originalTimestamp: firstGoodMoment.timestamp,
        });
      }
    }
  }

  // Check for weak ending - suggest trim end
  const lastKeyMoment = analysis.keyMoments?.filter(m => {
    const note = m.note.toLowerCase();
    return note.includes('call-to-action') ||
           note.includes('cta') ||
           note.includes('ending') ||
           note.includes('close');
  }).pop();

  if (lastKeyMoment) {
    const { start, end } = parseTimestamp(lastKeyMoment.timestamp);
    const endTime = end || start + 3;
    if (endTime < duration - 2) {
      suggestions.push({
        id: `suggestion-${idCounter++}`,
        type: 'trim-end',
        startTime: endTime + 1,
        reason: 'End after your strong closing',
        confidence: 0.7,
        source: 'keyMoment',
        originalTimestamp: lastKeyMoment.timestamp,
      });
    }
  }

  // Find sections to cut based on low scores and negative timestamps
  const categories = ['pacing', 'engagement', 'delivery', 'content'] as const;

  for (const category of categories) {
    const data = analysis[category];
    if (data && data.timestamps && data.score < 6) {
      for (const ts of data.timestamps) {
        const note = ts.note.toLowerCase();
        if (
          note.includes('dip') ||
          note.includes('awkward') ||
          note.includes('slow') ||
          note.includes('pause') ||
          note.includes('hesitat') ||
          note.includes('drop') ||
          note.includes('weak')
        ) {
          const { start, end } = parseTimestamp(ts.timestamp);
          suggestions.push({
            id: `suggestion-${idCounter++}`,
            type: 'cut',
            startTime: start,
            endTime: end || start + 3,
            reason: ts.note,
            confidence: (10 - data.score) / 10,
            source: category,
            originalTimestamp: ts.timestamp,
          });
        }
      }
    }
  }

  // Sort by confidence (highest first)
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// Generate highlight clips from keyMoments
export function generateHighlightClips(
  analysis: VideoAnalysis,
  duration: number
): HighlightClip[] {
  if (!analysis.keyMoments || analysis.keyMoments.length === 0) {
    return [];
  }

  const clips: HighlightClip[] = [];
  let idCounter = 0;

  // Score each keyMoment based on positive/negative sentiment
  const scoredMoments = analysis.keyMoments.map(moment => {
    const note = moment.note.toLowerCase();
    let score = 0;

    // Positive indicators
    if (note.includes('strong')) score += 3;
    if (note.includes('hook')) score += 3;
    if (note.includes('energy')) score += 2;
    if (note.includes('engaging')) score += 2;
    if (note.includes('good')) score += 2;
    if (note.includes('great')) score += 3;
    if (note.includes('call-to-action') || note.includes('cta')) score += 2;
    if (note.includes('authentic')) score += 2;

    // Negative indicators (lower priority)
    if (note.includes('dip')) score -= 2;
    if (note.includes('weak')) score -= 2;
    if (note.includes('awkward')) score -= 2;
    if (note.includes('consider re-recording')) score -= 3;

    return { moment, score };
  });

  // Sort by score (highest first) and take top moments
  const topMoments = scoredMoments
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const { moment } of topMoments) {
    const { start, end } = parseTimestamp(moment.timestamp);
    const clipDuration = end ? end - start : 5; // Default 5 second clips

    clips.push({
      id: `highlight-${idCounter++}`,
      startTime: Math.max(0, start - 0.5), // Include 0.5s before
      endTime: Math.min(duration, (end || start) + clipDuration + 0.5),
      note: moment.note,
      selected: true, // Selected by default
    });
  }

  // Sort clips by start time
  return clips.sort((a, b) => a.startTime - b.startTime);
}

// Calculate new duration after applying edits
export function calculateEditedDuration(
  originalDuration: number,
  trimStart: number,
  trimEnd: number,
  cuts: { start: number; end: number }[]
): number {
  let duration = trimEnd - trimStart;

  // Subtract cut sections that fall within trim range
  for (const cut of cuts) {
    const cutStart = Math.max(cut.start, trimStart);
    const cutEnd = Math.min(cut.end, trimEnd);
    if (cutStart < cutEnd) {
      duration -= (cutEnd - cutStart);
    }
  }

  return Math.max(0, duration);
}
