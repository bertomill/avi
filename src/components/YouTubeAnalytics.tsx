'use client';

import { useEffect, useState } from 'react';
import { YouTubeAnalytics as YouTubeAnalyticsType } from '@/types';

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

function formatDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;

  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function YouTubeAnalytics() {
  const [analytics, setAnalytics] = useState<YouTubeAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/youtube');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch analytics');
      }
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    try {
      setSyncing(true);
      await fetch('/api/youtube', { method: 'POST' });
      await fetchAnalytics();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    const isNotConnected = error.includes('No YouTube account connected');

    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="text-center py-12">
          {isNotConnected ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Your YouTube Channel</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Link your YouTube account to see your channel analytics, video performance, and get AI-powered content suggestions.
              </p>
              <a
                href="/api/auth/link-youtube"
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                Connect YouTube Account
              </a>
            </>
          ) : (
            <>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchAnalytics}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500 text-center py-8">
          No analytics data available. Connect your YouTube account to get started.
        </p>
      </div>
    );
  }

  const { channel, videos, recentPerformance, topVideos } = analytics;

  return (
    <div className="space-y-6">
      {/* Channel Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {channel.thumbnailUrl && (
              <img
                src={channel.thumbnailUrl}
                alt={channel.title}
                className="w-20 h-20 rounded-full"
              />
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{channel.title}</h2>
              <p className="text-gray-500">{channel.customUrl}</p>
            </div>
          </div>
          <button
            onClick={syncData}
            disabled={syncing}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Subscribers</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(channel.subscriberCount)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Total Views</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(channel.viewCount)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Videos</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(channel.videoCount)}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Performance */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Performance (Last 10 Videos)
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600">Total Views</p>
            <p className="text-xl font-bold text-blue-700">
              {formatNumber(recentPerformance.totalViews)}
            </p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Total Likes</p>
            <p className="text-xl font-bold text-green-700">
              {formatNumber(recentPerformance.totalLikes)}
            </p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-600">Total Comments</p>
            <p className="text-xl font-bold text-purple-700">
              {formatNumber(recentPerformance.totalComments)}
            </p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-orange-600">Avg Views/Video</p>
            <p className="text-xl font-bold text-orange-700">
              {formatNumber(recentPerformance.avgViewsPerVideo)}
            </p>
          </div>
        </div>
      </div>

      {/* Top Performing Videos */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Top Performing Videos
        </h3>
        <div className="space-y-4">
          {topVideos.map((video, index) => (
            <div
              key={video.id}
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-2xl font-bold text-gray-300 w-8">
                {index + 1}
              </span>
              {video.thumbnailUrl && (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-32 h-18 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">
                  {video.title}
                </h4>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span>{formatNumber(video.viewCount)} views</span>
                  <span>{formatNumber(video.likeCount)} likes</span>
                  <span>{formatNumber(video.commentCount)} comments</span>
                  <span>{formatDuration(video.duration)}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Engagement</p>
                <p className="font-semibold text-gray-900">
                  {video.viewCount > 0
                    ? (
                        ((video.likeCount + video.commentCount) / video.viewCount) *
                        100
                      ).toFixed(2)
                    : 0}
                  %
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Videos */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          All Videos ({videos.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3 font-medium">Video</th>
                <th className="pb-3 font-medium">Published</th>
                <th className="pb-3 font-medium text-right">Views</th>
                <th className="pb-3 font-medium text-right">Likes</th>
                <th className="pb-3 font-medium text-right">Comments</th>
                <th className="pb-3 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {videos.map((video) => (
                <tr key={video.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      {video.thumbnailUrl && (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-20 h-12 object-cover rounded"
                        />
                      )}
                      <span className="font-medium text-gray-900 truncate max-w-xs">
                        {video.title}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-gray-500">
                    {new Date(video.publishedAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right font-medium">
                    {formatNumber(video.viewCount)}
                  </td>
                  <td className="py-3 text-right">{formatNumber(video.likeCount)}</td>
                  <td className="py-3 text-right">{formatNumber(video.commentCount)}</td>
                  <td className="py-3 text-right text-gray-500">
                    {formatDuration(video.duration)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
