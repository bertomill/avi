'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TeleprompterScript } from '@/types/avi2';

interface TeleprompterProps {
  script: TeleprompterScript;
  onClose: () => void;
}

export default function Teleprompter({ script, onClose }: TeleprompterProps) {
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(50);
  const [fontSize, setFontSize] = useState(24);
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const contentRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const animate = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp;
    }

    const delta = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    if (contentRef.current && isScrolling) {
      const pixelsToScroll = (scrollSpeed * delta) / 1000;
      contentRef.current.scrollTop += pixelsToScroll;

      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      if (scrollTop + clientHeight >= scrollHeight) {
        setIsScrolling(false);
      }
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [isScrolling, scrollSpeed]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  const toggleScrolling = () => {
    setIsScrolling(!isScrolling);
    lastTimeRef.current = 0;
  };

  const resetScroll = () => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    setIsScrolling(false);
  };

  return (
    <div
      className={`absolute left-0 right-0 ${
        position === 'top' ? 'top-0' : 'bottom-0'
      } bg-black/80 backdrop-blur-sm z-10`}
      style={{ height: '35%' }}
    >
      {/* Controls */}
      <div className="absolute top-2 right-2 flex items-center gap-2 z-20">
        <button
          onClick={() => setPosition(position === 'top' ? 'bottom' : 'top')}
          className="p-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-xs"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {position === 'top' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            )}
          </svg>
        </button>

        <div className="flex items-center gap-1 bg-gray-800/80 rounded-lg px-2 py-1">
          <button onClick={() => setFontSize(Math.max(16, fontSize - 2))} className="text-xs hover:text-purple-400">A-</button>
          <span className="text-xs w-8 text-center">{fontSize}</span>
          <button onClick={() => setFontSize(Math.min(48, fontSize + 2))} className="text-xs hover:text-purple-400">A+</button>
        </div>

        <div className="flex items-center gap-1 bg-gray-800/80 rounded-lg px-2 py-1">
          <span className="text-xs text-gray-400">Speed:</span>
          <input type="range" min="10" max="150" value={scrollSpeed} onChange={(e) => setScrollSpeed(Number(e.target.value))} className="w-16 h-1" />
        </div>

        <button onClick={toggleScrolling} className={`p-2 rounded-lg ${isScrolling ? 'bg-yellow-600' : 'bg-green-600'}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isScrolling ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            )}
          </svg>
        </button>

        <button onClick={resetScroll} className="p-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button onClick={onClose} className="p-2 bg-red-600/80 hover:bg-red-700 rounded-lg">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Script Content */}
      <div ref={contentRef} className="h-full overflow-y-auto px-8 py-12 text-center">
        <h2 className="font-bold text-white mb-8" style={{ fontSize: fontSize + 8 }}>{script.title}</h2>
        {script.sections.map((section, index) => (
          <div key={index} className="mb-8">
            {section.heading && (
              <h3 className="font-semibold text-purple-400 mb-4" style={{ fontSize: fontSize + 2 }}>{section.heading}</h3>
            )}
            <p className="text-white leading-relaxed whitespace-pre-wrap" style={{ fontSize }}>{section.content}</p>
          </div>
        ))}
        <div className="py-8 text-gray-500 text-sm">--- End of Script ---</div>
      </div>
    </div>
  );
}
