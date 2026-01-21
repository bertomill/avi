'use client';

import { useState, useRef, useCallback } from 'react';

interface FFmpegInstance {
  load: (options?: { coreURL?: string; wasmURL?: string; workerURL?: string }) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  writeFile: (name: string, data: Uint8Array | string) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array>;
  deleteFile: (name: string) => Promise<void>;
  on: (event: string, callback: (data: { progress: number }) => void) => void;
  loaded: boolean;
}

declare global {
  interface Window {
    FFmpegWASM?: {
      FFmpeg: new () => FFmpegInstance;
    };
    FFmpegUtil?: {
      fetchFile: (input: Blob | string) => Promise<Uint8Array>;
    };
  }
}

// Load script and wait for it
function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// Initialize FFmpeg from local UMD files
async function initFFmpeg(): Promise<{
  FFmpeg: new () => FFmpegInstance;
  fetchFile: (input: Blob | string) => Promise<Uint8Array>;
}> {
  // Load UMD scripts which attach to window
  await loadScript('/ffmpeg/ffmpeg.min.js', 'ffmpeg-script');
  await loadScript('/ffmpeg/util.min.js', 'ffmpeg-util-script');

  // Wait a tick for globals to be set
  await new Promise(resolve => setTimeout(resolve, 100));

  if (!window.FFmpegWASM || !window.FFmpegUtil) {
    throw new Error('FFmpeg failed to initialize');
  }

  return {
    FFmpeg: window.FFmpegWASM.FFmpeg,
    fetchFile: window.FFmpegUtil.fetchFile,
  };
}

export function useFFmpeg() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ffmpegRef = useRef<FFmpegInstance | null>(null);
  const fetchFileRef = useRef<((input: Blob | string) => Promise<Uint8Array>) | null>(null);

  const load = useCallback(async () => {
    if (ffmpegRef.current?.loaded || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const { FFmpeg, fetchFile } = await initFFmpeg();

      const ffmpeg = new FFmpeg();
      fetchFileRef.current = fetchFile;

      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(Math.round(p * 100));
      });

      // Load FFmpeg WASM core from local public folder
      await ffmpeg.load({
        coreURL: '/ffmpeg/ffmpeg-core.js',
        wasmURL: '/ffmpeg/ffmpeg-core.wasm',
        workerURL: '/ffmpeg/ffmpeg-worker.js',
      });

      ffmpegRef.current = ffmpeg;
      setIsLoaded(true);
    } catch (err) {
      console.error('Failed to load FFmpeg:', err);
      setError(err instanceof Error ? err.message : 'Failed to load FFmpeg');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const trim = useCallback(async (
    inputBlob: Blob,
    startTime: number,
    endTime: number
  ): Promise<Blob> => {
    if (!ffmpegRef.current || !fetchFileRef.current) {
      throw new Error('FFmpeg not loaded');
    }

    const ffmpeg = ffmpegRef.current;
    const fetchFile = fetchFileRef.current;

    setProgress(0);

    // Write input file
    const inputData = await fetchFile(inputBlob);
    await ffmpeg.writeFile('input.webm', inputData);

    // Run trim command (using -c copy for fast operation, no re-encoding)
    const exitCode = await ffmpeg.exec([
      '-i', 'input.webm',
      '-ss', startTime.toFixed(3),
      '-to', endTime.toFixed(3),
      '-c:v', 'copy',
      '-c:a', 'copy',
      'output.webm'
    ]);

    if (exitCode !== 0) {
      throw new Error('FFmpeg trim operation failed');
    }

    // Read output file
    const data = await ffmpeg.readFile('output.webm');

    // Clean up
    await ffmpeg.deleteFile('input.webm');
    await ffmpeg.deleteFile('output.webm');

    setProgress(100);

    return new Blob([new Uint8Array(data)], { type: 'video/webm' });
  }, []);

  const concatenateClips = useCallback(async (
    inputBlob: Blob,
    clips: { start: number; end: number }[]
  ): Promise<Blob> => {
    if (!ffmpegRef.current || !fetchFileRef.current) {
      throw new Error('FFmpeg not loaded');
    }

    if (clips.length === 0) {
      throw new Error('No clips to concatenate');
    }

    const ffmpeg = ffmpegRef.current;
    const fetchFile = fetchFileRef.current;
    setProgress(0);

    // Extract each clip
    const clipFiles: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const duration = clip.end - clip.start;
      const fileName = `clip${i}.webm`;

      const inputData = await fetchFile(inputBlob);
      await ffmpeg.writeFile('input.webm', inputData);

      await ffmpeg.exec([
        '-i', 'input.webm',
        '-ss', clip.start.toFixed(3),
        '-t', duration.toFixed(3),
        '-c:v', 'copy',
        '-c:a', 'copy',
        fileName
      ]);

      await ffmpeg.deleteFile('input.webm');
      clipFiles.push(fileName);
      setProgress(Math.round(((i + 1) / clips.length) * 50));
    }

    // Create concat list
    const concatList = clipFiles.map(f => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('concat.txt', concatList);

    // Concatenate clips
    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat.txt',
      '-c', 'copy',
      'highlight.webm'
    ]);

    setProgress(90);

    // Read output
    const data = await ffmpeg.readFile('highlight.webm');

    // Clean up
    await ffmpeg.deleteFile('concat.txt');
    await ffmpeg.deleteFile('highlight.webm');
    for (const f of clipFiles) {
      try {
        await ffmpeg.deleteFile(f);
      } catch {
        // File may already be deleted
      }
    }

    setProgress(100);

    return new Blob([new Uint8Array(data)], { type: 'video/webm' });
  }, []);

  return {
    load,
    isLoaded,
    isLoading,
    progress,
    error,
    trim,
    concatenateClips,
  };
}
