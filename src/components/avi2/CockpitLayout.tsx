'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ContentMasterChat from './ContentMasterChat';
import VideoRecorder from './VideoRecorder';
import VideoCoachPanel from './VideoCoachPanel';
import ExportModal from './ExportModal';
import Teleprompter from './Teleprompter';
import {
  Avi2Message,
  VideoIdea,
  TeleprompterScript,
  RecordedVideo,
  VideoCoachAnalysis,
} from '@/types/avi2';

export default function CockpitLayout() {
  const router = useRouter();

  // Content Master state
  const [messages, setMessages] = useState<Avi2Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoIdeas, setVideoIdeas] = useState<VideoIdea[]>([]);

  // Video Recorder state
  const [recordedVideo, setRecordedVideo] = useState<RecordedVideo | null>(null);
  const [teleprompterScript, setTeleprompterScript] = useState<TeleprompterScript | null>(null);
  const [showTeleprompter, setShowTeleprompter] = useState(false);

  // Video Coach state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<VideoCoachAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);

  // Handle teleprompter script from Content Master
  const handleSetTeleprompter = useCallback((script: TeleprompterScript) => {
    setTeleprompterScript(script);
    setShowTeleprompter(true);
  }, []);

  // Handle video ideas from Content Master
  const handleVideoIdeas = useCallback((ideas: VideoIdea[]) => {
    setVideoIdeas(ideas);
  }, []);

  // Handle video recorded
  const handleVideoRecorded = useCallback((video: RecordedVideo) => {
    setRecordedVideo(video);
    setAnalysis(null);
    setAnalysisError(null);
  }, []);

  // Handle video analysis request
  const handleAnalyzeVideo = useCallback(async () => {
    if (!recordedVideo) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(recordedVideo.blob);
      const videoData = await base64Promise;

      const response = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoData,
          mimeType: recordedVideo.blob.type || 'video/webm',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze video');
      }

      const result = await response.json();
      setAnalysis(result);
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze video');
    } finally {
      setIsAnalyzing(false);
    }
  }, [recordedVideo]);

  // Handle export
  const handleExport = useCallback(() => {
    setShowExportModal(true);
  }, []);

  // Handle close cockpit
  const handleClose = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Avi2 Cockpit</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={!recordedVideo}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            Export
          </button>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Close cockpit"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content - Three Panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Content Master */}
        <aside className="w-80 border-r border-gray-700 flex flex-col bg-gray-800">
          <ContentMasterChat
            messages={messages}
            setMessages={setMessages}
            isStreaming={isStreaming}
            setIsStreaming={setIsStreaming}
            onVideoIdeas={handleVideoIdeas}
            onSetTeleprompter={handleSetTeleprompter}
            videoIdeas={videoIdeas}
          />
        </aside>

        {/* Center - Video Recorder */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <VideoRecorder
            onVideoRecorded={handleVideoRecorded}
            recordedVideo={recordedVideo}
            onClearVideo={() => setRecordedVideo(null)}
          />

          {/* Teleprompter Overlay */}
          {showTeleprompter && teleprompterScript && (
            <Teleprompter
              script={teleprompterScript}
              onClose={() => setShowTeleprompter(false)}
            />
          )}
        </main>

        {/* Right Panel - Video Coach */}
        <aside className="w-80 border-l border-gray-700 flex flex-col bg-gray-800">
          <VideoCoachPanel
            recordedVideo={recordedVideo}
            isAnalyzing={isAnalyzing}
            analysis={analysis}
            error={analysisError}
            onAnalyze={handleAnalyzeVideo}
          />
        </aside>
      </div>

      {/* Export Modal */}
      {showExportModal && recordedVideo && (
        <ExportModal
          video={recordedVideo}
          suggestedTitle={teleprompterScript?.title || 'My Video'}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
