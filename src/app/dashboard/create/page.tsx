'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type RecordingState = 'idle' | 'countdown' | 'recording' | 'preview';

function CreateVideoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const videoTitle = searchParams.get('title') || 'Untitled Video';
  const videoDescription = searchParams.get('description') || '';
  const videoScript = searchParams.get('script') || '';

  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [countdown, setCountdown] = useState(3);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize camera on mount
  useEffect(() => {
    initCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setError(null);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const startCountdown = () => {
    setRecordingState('countdown');
    setCountdown(3);

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          startRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp9',
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setRecordingState('preview');

      if (previewRef.current) {
        previewRef.current.src = URL.createObjectURL(blob);
      }
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setRecordingState('recording');
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const retakeVideo = () => {
    setRecordedBlob(null);
    setRecordingState('idle');
    setRecordingTime(0);
    if (previewRef.current) {
      previewRef.current.src = '';
    }
  };

  const saveVideo = () => {
    if (!recordedBlob) return;

    // Download the video for now
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_')}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{videoTitle}</h1>
              <p className="text-sm text-gray-500">Record your video</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {recordingState === 'preview' && (
              <>
                <button
                  onClick={retakeVideo}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Retake
                </button>
                <button
                  onClick={saveVideo}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                >
                  Save Video
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Recorder */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-2xl overflow-hidden relative aspect-video">
              {error ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center text-white p-6">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400 mb-4">{error}</p>
                    <button
                      onClick={initCamera}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : recordingState === 'preview' ? (
                <video
                  ref={previewRef}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover mirror"
                    autoPlay
                    muted
                    playsInline
                  />

                  {/* Countdown overlay */}
                  {recordingState === 'countdown' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-8xl font-bold text-white animate-pulse">
                        {countdown}
                      </div>
                    </div>
                  )}

                  {/* Recording indicator */}
                  {recordingState === 'recording' && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-full">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="font-medium">{formatTime(recordingTime)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Controls */}
            <div className="mt-4 flex justify-center">
              {recordingState === 'idle' && !error && (
                <button
                  onClick={startCountdown}
                  className="flex items-center gap-3 px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all hover:scale-105 shadow-lg"
                >
                  <div className="w-4 h-4 rounded-full bg-white" />
                  <span className="font-semibold text-lg">Start Recording</span>
                </button>
              )}

              {recordingState === 'recording' && (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-3 px-8 py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-full transition-all hover:scale-105 shadow-lg"
                >
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span className="font-semibold text-lg">Stop Recording</span>
                </button>
              )}

              {recordingState === 'countdown' && (
                <button
                  disabled
                  className="flex items-center gap-3 px-8 py-4 bg-gray-400 text-white rounded-full cursor-not-allowed"
                >
                  <span className="font-semibold text-lg">Get Ready...</span>
                </button>
              )}
            </div>
          </div>

          {/* Script/Notes Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Video Script
              </h2>

              {videoDescription && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Concept</h3>
                  <p className="text-gray-700">{videoDescription}</p>
                </div>
              )}

              {videoScript ? (
                <div className="prose prose-sm max-w-none">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Talking Points</h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">
                    {videoScript}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-gray-500 text-sm">
                    No script provided. You can freestyle or go back to Avi to generate one.
                  </p>
                  <Link
                    href="/dashboard"
                    className="inline-block mt-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                  >
                    Ask Avi for a script →
                  </Link>
                </div>
              )}

              {/* Tips */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Recording Tips</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500">•</span>
                    Look directly at the camera
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500">•</span>
                    Good lighting on your face
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500">•</span>
                    Speak clearly and with energy
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500">•</span>
                    Keep it concise - short videos perform better
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}

// Loading component for Suspense fallback
function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading video studio...</p>
      </div>
    </div>
  );
}

export default function CreateVideoPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CreateVideoContent />
    </Suspense>
  );
}
