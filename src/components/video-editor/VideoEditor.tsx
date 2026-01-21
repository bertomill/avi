'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useFFmpeg } from '@/hooks/useFFmpeg';
import { generateEditSuggestions, generateHighlightClips, formatTime, parseTimestamp } from '@/lib/video-editing';
import { VideoEditorProps, EditSuggestion, HighlightClip, TimelineMarker } from '@/types/video-editor';
import TimelineTrack from './TimelineTrack';

export default function VideoEditor({ video, analysis, onSave, onCancel }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { load, isLoaded, isLoading, progress, error, trim, concatenateClips } = useFFmpeg();

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(video.duration);
  const [currentTime, setCurrentTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'trim' | 'highlight'>('trim');

  // Generate suggestions from analysis
  const suggestions = useMemo(() => {
    if (!analysis) return [];
    return generateEditSuggestions(analysis, video.duration);
  }, [analysis, video.duration]);

  // Generate highlight clips from analysis
  const [highlightClips, setHighlightClips] = useState<HighlightClip[]>([]);

  useEffect(() => {
    if (analysis) {
      setHighlightClips(generateHighlightClips(analysis, video.duration));
    }
  }, [analysis, video.duration]);

  // Create timeline markers from analysis
  const markers: TimelineMarker[] = useMemo(() => {
    if (!analysis) return [];

    const m: TimelineMarker[] = [];

    // Add keyMoments
    analysis.keyMoments?.forEach(km => {
      const { start } = parseTimestamp(km.timestamp);
      const isPositive = !km.note.toLowerCase().includes('dip') &&
                         !km.note.toLowerCase().includes('weak');
      m.push({
        time: start,
        label: km.note,
        type: 'keyMoment',
        color: isPositive ? '#22c55e' : '#eab308',
      });
    });

    // Add suggestion points
    suggestions.forEach(s => {
      if (s.type === 'cut' && s.startTime) {
        m.push({
          time: s.startTime,
          label: s.reason,
          type: 'suggestion',
          color: '#ef4444',
        });
      }
    });

    return m;
  }, [analysis, suggestions]);

  // Video time sync
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleTimeUpdate = () => {
      setCurrentTime(v.currentTime);
    };

    v.addEventListener('timeupdate', handleTimeUpdate);
    return () => v.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const applySuggestion = (suggestion: EditSuggestion) => {
    if (suggestion.type === 'trim-start' && suggestion.startTime !== undefined) {
      setTrimStart(suggestion.startTime);
      handleSeek(suggestion.startTime);
    } else if (suggestion.type === 'trim-end' && suggestion.startTime !== undefined) {
      setTrimEnd(suggestion.startTime);
    }
  };

  const toggleHighlightClip = (id: string) => {
    setHighlightClips(clips =>
      clips.map(c => c.id === id ? { ...c, selected: !c.selected } : c)
    );
  };

  const handleSaveTrim = async () => {
    if (!isLoaded) {
      await load();
    }

    setIsProcessing(true);
    setProcessError(null);

    try {
      const trimmedBlob = await trim(video.blob, trimStart, trimEnd);
      const url = URL.createObjectURL(trimmedBlob);

      onSave({
        url,
        blob: trimmedBlob,
        title: video.title,
        duration: trimEnd - trimStart,
      });
    } catch (err) {
      console.error('Trim failed:', err);
      setProcessError(err instanceof Error ? err.message : 'Failed to trim video');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateHighlight = async () => {
    const selectedClips = highlightClips.filter(c => c.selected);
    if (selectedClips.length === 0) {
      setProcessError('Select at least one clip for the highlight');
      return;
    }

    if (!isLoaded) {
      await load();
    }

    setIsProcessing(true);
    setProcessError(null);

    try {
      const clips = selectedClips.map(c => ({
        start: c.startTime,
        end: c.endTime,
      }));

      const highlightBlob = await concatenateClips(video.blob, clips);
      const url = URL.createObjectURL(highlightBlob);

      const totalDuration = selectedClips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0);

      onSave({
        url,
        blob: highlightBlob,
        title: `${video.title} (Highlight)`,
        duration: totalDuration,
      });
    } catch (err) {
      console.error('Highlight generation failed:', err);
      setProcessError(err instanceof Error ? err.message : 'Failed to generate highlight');
    } finally {
      setIsProcessing(false);
    }
  };

  const previewTrim = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = trimStart;
      videoRef.current.play();
    }
  };

  return (
    <div className="mt-4 p-4 bg-gray-900/50 rounded-xl border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-white font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Video Editor
        </h4>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('trim')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'trim'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Trim Video
        </button>
        <button
          onClick={() => setActiveTab('highlight')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'highlight'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
          disabled={highlightClips.length === 0}
        >
          Generate Highlight
          {highlightClips.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">
              {highlightClips.length}
            </span>
          )}
        </button>
      </div>

      {/* Video Preview */}
      <div className="relative rounded-lg overflow-hidden bg-black mb-4">
        <video
          ref={videoRef}
          src={video.url}
          className="w-full aspect-video object-contain"
          controls
          playsInline
        />
      </div>

      {/* Timeline */}
      <TimelineTrack
        duration={video.duration}
        trimStart={trimStart}
        trimEnd={trimEnd}
        markers={markers}
        currentTime={currentTime}
        onTrimStartChange={setTrimStart}
        onTrimEndChange={setTrimEnd}
        onSeek={handleSeek}
      />

      {/* Tab Content */}
      {activeTab === 'trim' ? (
        <>
          {/* AI Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
              <h5 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Suggestions
              </h5>
              <div className="space-y-2">
                {suggestions.slice(0, 3).map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => applySuggestion(suggestion)}
                    className="w-full flex items-center gap-3 p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-left transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      suggestion.type === 'trim-start' ? 'bg-blue-400' :
                      suggestion.type === 'trim-end' ? 'bg-purple-400' :
                      'bg-red-400'
                    }`} />
                    <div className="flex-1">
                      <span className="text-sm text-white">{suggestion.reason}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {suggestion.originalTimestamp && `at ${suggestion.originalTimestamp}`}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {Math.round(suggestion.confidence * 100)}% confidence
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual Controls */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Start:</label>
              <input
                type="number"
                value={trimStart.toFixed(1)}
                onChange={(e) => setTrimStart(Math.max(0, Math.min(parseFloat(e.target.value) || 0, trimEnd - 0.5)))}
                step="0.1"
                min="0"
                max={trimEnd - 0.5}
                className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">End:</label>
              <input
                type="number"
                value={trimEnd.toFixed(1)}
                onChange={(e) => setTrimEnd(Math.max(trimStart + 0.5, Math.min(parseFloat(e.target.value) || video.duration, video.duration)))}
                step="0.1"
                min={trimStart + 0.5}
                max={video.duration}
                className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              />
            </div>
          </div>
        </>
      ) : (
        /* Highlight Clips Selection */
        <div className="mt-4 space-y-2">
          <h5 className="text-sm font-medium text-gray-300 mb-2">
            Select moments for your highlight reel:
          </h5>
          {highlightClips.map((clip) => (
            <button
              key={clip.id}
              onClick={() => toggleHighlightClip(clip.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                clip.selected
                  ? 'bg-purple-500/20 border border-purple-500/50'
                  : 'bg-gray-800/50 border border-transparent hover:bg-gray-700/50'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center ${
                clip.selected ? 'bg-purple-500' : 'bg-gray-700'
              }`}>
                {clip.selected && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <span className="text-sm text-white">{clip.note}</span>
                <span className="text-xs text-gray-400 ml-2">
                  {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {formatTime(clip.endTime - clip.startTime)}
              </span>
            </button>
          ))}
          {highlightClips.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">
              No highlight moments detected. Get AI Feedback first to analyze your video.
            </p>
          )}
        </div>
      )}

      {/* FFmpeg Loading Status */}
      {isLoading && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-blue-400 text-sm">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading video editor...
          </div>
        </div>
      )}

      {/* Processing Progress */}
      {isProcessing && (
        <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-400 text-sm">Processing video...</span>
            <span className="text-purple-400 text-sm">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {(error || processError) && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{error || processError}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          onClick={previewTrim}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          disabled={isProcessing}
        >
          Preview
        </button>
        <button
          onClick={activeTab === 'trim' ? handleSaveTrim : handleGenerateHighlight}
          disabled={isProcessing || isLoading}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isProcessing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </>
          ) : activeTab === 'trim' ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Trim
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Highlight
            </>
          )}
        </button>
      </div>
    </div>
  );
}
