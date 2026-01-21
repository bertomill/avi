'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RecordedVideo, RecordingSource, RecordingState } from '@/types/avi2';

interface VideoRecorderProps {
  onVideoRecorded: (video: RecordedVideo) => void;
  recordedVideo: RecordedVideo | null;
  onClearVideo: () => void;
}

export default function VideoRecorder({
  onVideoRecorded,
  recordedVideo,
  onClearVideo,
}: VideoRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingSource, setRecordingSource] = useState<RecordingSource>('camera');
  const [recordingTime, setRecordingTime] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [showSourceMenu, setShowSourceMenu] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Clean up streams
  const stopAllStreams = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Initialize media on mount
  useEffect(() => {
    if (recordingState === 'idle' && !recordedVideo) {
      initializeMedia();
    }
    return () => {
      stopAllStreams();
    };
  }, []);

  // Initialize camera/screen
  const initializeMedia = useCallback(async () => {
    setError(null);
    stopAllStreams();

    try {
      if (recordingSource === 'camera') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else if (recordingSource === 'screen') {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: true,
        });

        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const tracks = [
            ...screenStream.getVideoTracks(),
            ...micStream.getAudioTracks(),
          ];
          streamRef.current = new MediaStream(tracks);
          cameraStreamRef.current = micStream;
        } catch {
          streamRef.current = screenStream;
        }

        screenStreamRef.current = screenStream;

        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }

        screenStream.getVideoTracks()[0].onended = () => {
          if (recordingState === 'recording') {
            stopRecording();
          } else {
            stopAllStreams();
            setRecordingState('idle');
          }
        };
      } else if (recordingSource === 'screen-camera') {
        const [screenStream, cameraStream] = await Promise.all([
          navigator.mediaDevices.getDisplayMedia({
            video: { width: 1920, height: 1080 },
            audio: true,
          }),
          navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240 },
            audio: true,
          }),
        ]);

        screenStreamRef.current = screenStream;
        cameraStreamRef.current = cameraStream;

        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        canvasRef.current = canvas;

        const screenVideo = document.createElement('video');
        screenVideo.srcObject = screenStream;
        screenVideo.muted = true;
        await screenVideo.play();

        const cameraVideo = document.createElement('video');
        cameraVideo.srcObject = cameraStream;
        cameraVideo.muted = true;
        await cameraVideo.play();

        const drawFrame = () => {
          if (ctx) {
            ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
            const pipWidth = 320;
            const pipHeight = 240;
            const pipX = canvas.width - pipWidth - 20;
            const pipY = canvas.height - pipHeight - 20;
            ctx.drawImage(cameraVideo, pipX, pipY, pipWidth, pipHeight);
          }
          animationFrameRef.current = requestAnimationFrame(drawFrame);
        };
        drawFrame();

        const canvasStream = canvas.captureStream(30);
        const audioTracks = [
          ...cameraStream.getAudioTracks(),
          ...screenStream.getAudioTracks(),
        ];
        audioTracks.forEach(track => canvasStream.addTrack(track));

        streamRef.current = canvasStream;

        if (videoRef.current) {
          videoRef.current.srcObject = canvasStream;
        }

        screenStream.getVideoTracks()[0].onended = () => {
          if (recordingState === 'recording') {
            stopRecording();
          } else {
            stopAllStreams();
            setRecordingState('idle');
          }
        };
      }
    } catch (err) {
      console.error('Media initialization error:', err);
      setError('Failed to access camera/screen. Please check permissions.');
    }
  }, [recordingSource, recordingState, stopAllStreams]);

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);

      const video: RecordedVideo = {
        blob,
        url,
        duration: recordingTime,
        timestamp: new Date(),
      };

      onVideoRecorded(video);
      setRecordingState('preview');
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);

    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    setRecordingState('recording');
  }, [recordingTime, onVideoRecorded]);

  // Start countdown
  const startCountdown = useCallback(async () => {
    if (recordingState !== 'idle') return;
    await initializeMedia();
    setRecordingState('countdown');
    setCountdown(3);

    let count = 3;
    const countdownInterval = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countdownInterval);
        startRecording();
      }
    }, 1000);
  }, [recordingState, initializeMedia, startRecording]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopAllStreams();
  }, [stopAllStreams]);

  // Reset
  const resetRecording = useCallback(() => {
    stopAllStreams();
    onClearVideo();
    setRecordingState('idle');
    setRecordingTime(0);
    chunksRef.current = [];
    // Re-initialize camera
    setTimeout(() => initializeMedia(), 100);
  }, [stopAllStreams, onClearVideo, initializeMedia]);

  // Change source
  const changeSource = useCallback((source: RecordingSource) => {
    setRecordingSource(source);
    setShowSourceMenu(false);
    stopAllStreams();
    setTimeout(() => initializeMedia(), 100);
  }, [stopAllStreams, initializeMedia]);

  // Re-initialize when source changes
  useEffect(() => {
    if (recordingState === 'idle' && !recordedVideo) {
      initializeMedia();
    }
  }, [recordingSource]);

  const sourceLabels: Record<RecordingSource, string> = {
    camera: 'Camera',
    screen: 'Screen',
    'screen-camera': 'Screen + Camera',
  };

  const sourceIcons: Record<RecordingSource, React.ReactNode> = {
    camera: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    ),
    screen: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    ),
    'screen-camera': (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        <circle cx="16" cy="16" r="3" strokeWidth={2} />
      </>
    ),
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-900 relative">
      {/* Video Preview Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {/* Error Message */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-20">
            <div className="bg-red-600/20 border border-red-500 rounded-lg p-4 max-w-md text-center">
              <p className="text-red-400">{error}</p>
              <button
                onClick={initializeMedia}
                className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Live Video Preview */}
        {(recordingState === 'idle' || recordingState === 'countdown' || recordingState === 'recording') && !recordedVideo && (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="max-h-full max-w-full object-contain"
            style={{ transform: recordingSource === 'camera' ? 'scaleX(-1)' : 'none' }}
          />
        )}

        {/* Recorded Video Preview */}
        {recordedVideo && recordingState === 'preview' && (
          <video
            ref={previewRef}
            src={recordedVideo.url}
            controls
            className="max-h-full max-w-full object-contain"
          />
        )}

        {/* Countdown Overlay */}
        {recordingState === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="text-9xl font-bold text-white animate-pulse">
              {countdown}
            </div>
          </div>
        )}

        {/* Recording Indicator */}
        {recordingState === 'recording' && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-2 rounded-lg z-10">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white font-mono">{formatTime(recordingTime)}</span>
          </div>
        )}

        {/* No Stream Placeholder */}
        {!streamRef.current && recordingState === 'idle' && !recordedVideo && !error && (
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p>Click to enable camera</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-center gap-4">
          {/* Source Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSourceMenu(!showSourceMenu)}
              disabled={recordingState === 'recording' || recordingState === 'countdown'}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {sourceIcons[recordingSource]}
              </svg>
              <span className="text-sm">{sourceLabels[recordingSource]}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSourceMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-gray-700 rounded-lg shadow-lg overflow-hidden z-20">
                {(Object.keys(sourceLabels) as RecordingSource[]).map((source) => (
                  <button
                    key={source}
                    onClick={() => changeSource(source)}
                    className={`flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-gray-600 ${
                      source === recordingSource ? 'bg-purple-600' : ''
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {sourceIcons[source]}
                    </svg>
                    <span className="text-sm">{sourceLabels[source]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Record/Stop Button */}
          {recordingState === 'idle' && !recordedVideo && (
            <button
              onClick={startCountdown}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full font-medium transition-colors"
            >
              <div className="w-4 h-4 bg-white rounded-full" />
              Record
            </button>
          )}

          {recordingState === 'countdown' && (
            <button
              disabled
              className="flex items-center gap-2 px-6 py-3 bg-yellow-600 rounded-full font-medium cursor-not-allowed"
            >
              Starting...
            </button>
          )}

          {recordingState === 'recording' && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full font-medium transition-colors animate-pulse"
            >
              <div className="w-4 h-4 bg-white rounded" />
              Stop
            </button>
          )}

          {recordingState === 'preview' && recordedVideo && (
            <>
              <button
                onClick={resetRecording}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-record
              </button>
              <div className="text-gray-400 text-sm">
                Duration: {formatTime(recordedVideo.duration)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
