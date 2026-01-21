'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { formatTime } from '@/lib/video-editing';
import { TimelineMarker } from '@/types/video-editor';

interface TimelineTrackProps {
  duration: number;
  trimStart: number;
  trimEnd: number;
  markers: TimelineMarker[];
  currentTime: number;
  onTrimStartChange: (time: number) => void;
  onTrimEndChange: (time: number) => void;
  onSeek: (time: number) => void;
}

export default function TimelineTrack({
  duration,
  trimStart,
  trimEnd,
  markers,
  currentTime,
  onTrimStartChange,
  onTrimEndChange,
  onSeek,
}: TimelineTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'playhead' | null>(null);

  const getPositionFromTime = (time: number) => {
    return (time / duration) * 100;
  };

  const getTimeFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * duration;
  }, [duration]);

  const handleMouseDown = (type: 'start' | 'end' | 'playhead') => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(type);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;

    const time = getTimeFromPosition(e.clientX);

    if (dragging === 'start') {
      onTrimStartChange(Math.min(time, trimEnd - 0.5));
    } else if (dragging === 'end') {
      onTrimEndChange(Math.max(time, trimStart + 0.5));
    } else if (dragging === 'playhead') {
      onSeek(time);
    }
  }, [dragging, trimStart, trimEnd, getTimeFromPosition, onTrimStartChange, onTrimEndChange, onSeek]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const handleTrackClick = (e: React.MouseEvent) => {
    if (dragging) return;
    const time = getTimeFromPosition(e.clientX);
    onSeek(time);
  };

  return (
    <div className="w-full py-4">
      {/* Time labels */}
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>{formatTime(0)}</span>
        <span>{formatTime(duration / 2)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Timeline track */}
      <div
        ref={trackRef}
        className="relative h-12 bg-gray-800 rounded-lg cursor-pointer overflow-hidden"
        onClick={handleTrackClick}
      >
        {/* Excluded regions (before trim start, after trim end) */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-gray-900/80"
          style={{ width: `${getPositionFromTime(trimStart)}%` }}
        />
        <div
          className="absolute top-0 bottom-0 right-0 bg-gray-900/80"
          style={{ width: `${100 - getPositionFromTime(trimEnd)}%` }}
        />

        {/* Active region */}
        <div
          className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-600/30 to-purple-600/30"
          style={{
            left: `${getPositionFromTime(trimStart)}%`,
            width: `${getPositionFromTime(trimEnd) - getPositionFromTime(trimStart)}%`,
          }}
        />

        {/* Markers */}
        {markers.map((marker, index) => (
          <div
            key={index}
            className="absolute top-1 bottom-1 w-1 rounded-full cursor-pointer transition-transform hover:scale-150"
            style={{
              left: `${getPositionFromTime(marker.time)}%`,
              backgroundColor: marker.color,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSeek(marker.time);
            }}
            title={`${formatTime(marker.time)} - ${marker.label}`}
          />
        ))}

        {/* Trim start handle */}
        <div
          className="absolute top-0 bottom-0 w-3 bg-blue-500 cursor-ew-resize flex items-center justify-center hover:bg-blue-400 transition-colors z-10"
          style={{ left: `calc(${getPositionFromTime(trimStart)}% - 6px)` }}
          onMouseDown={handleMouseDown('start')}
        >
          <div className="w-0.5 h-6 bg-white rounded-full" />
        </div>

        {/* Trim end handle */}
        <div
          className="absolute top-0 bottom-0 w-3 bg-purple-500 cursor-ew-resize flex items-center justify-center hover:bg-purple-400 transition-colors z-10"
          style={{ left: `calc(${getPositionFromTime(trimEnd)}% - 6px)` }}
          onMouseDown={handleMouseDown('end')}
        >
          <div className="w-0.5 h-6 bg-white rounded-full" />
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-20 cursor-ew-resize"
          style={{ left: `${getPositionFromTime(currentTime)}%` }}
          onMouseDown={handleMouseDown('playhead')}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-white" />
        </div>
      </div>

      {/* Trim info */}
      <div className="flex justify-between items-center mt-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-blue-400">Start: {formatTime(trimStart)}</span>
        </div>
        <div className="text-gray-400">
          Duration: {formatTime(trimEnd - trimStart)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-purple-400">End: {formatTime(trimEnd)}</span>
        </div>
      </div>

      {/* Markers legend */}
      {markers.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {markers.slice(0, 4).map((marker, index) => (
            <button
              key={index}
              onClick={() => onSeek(marker.time)}
              className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors"
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: marker.color }}
              />
              <span className="text-gray-300">{formatTime(marker.time)}</span>
              <span className="text-gray-500 max-w-[100px] truncate">{marker.label}</span>
            </button>
          ))}
          {markers.length > 4 && (
            <span className="text-gray-500 text-xs flex items-center">
              +{markers.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
