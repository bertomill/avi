'use client';

import { useState } from 'react';
import { RecordedVideo } from '@/types/avi2';

interface ExportModalProps {
  video: RecordedVideo;
  suggestedTitle: string;
  onClose: () => void;
}

export default function ExportModal({ video, suggestedTitle, onClose }: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<'download' | 'youtube'>('download');
  const [title, setTitle] = useState(suggestedTitle);
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'private' | 'unlisted' | 'public'>('private');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{ videoId: string; videoUrl: string } | null>(null);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = video.url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleYouTubeUpload = async () => {
    if (!title.trim()) {
      setUploadError('Title is required');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('video', video.blob, 'video.webm');
      formData.append('title', title);
      formData.append('description', description);
      formData.append('privacy', privacy);

      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadSuccess({
        videoId: result.videoId,
        videoUrl: result.videoUrl,
      });
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Export Video</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Upload Success State */}
        {uploadSuccess ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-600/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Upload Complete!</h3>
            <p className="text-gray-400 text-sm mb-4">Your video has been uploaded to YouTube</p>
            <a
              href={uploadSuccess.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                <path fill="white" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              View on YouTube
            </a>
            <button
              onClick={onClose}
              className="block w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setActiveTab('download')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'download'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </span>
              </button>
              <button
                onClick={() => setActiveTab('youtube')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'youtube'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                    <path fill="white" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  YouTube
                </span>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Video Preview */}
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={video.url}
                  className="w-full h-full object-contain"
                  controls
                />
              </div>

              {activeTab === 'download' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Filename
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <button
                    onClick={handleDownload}
                    className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Video
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                      placeholder="Enter video title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 resize-none"
                      placeholder="Enter video description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Privacy
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['private', 'unlisted', 'public'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPrivacy(p)}
                          className={`px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                            privacy === p
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:text-white'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {uploadError && (
                    <div className="bg-red-600/20 border border-red-500 rounded-lg p-3 text-sm text-red-400">
                      {uploadError}
                    </div>
                  )}

                  <button
                    onClick={handleYouTubeUpload}
                    disabled={isUploading}
                    className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                          <path fill="white" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                        Upload to YouTube
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
