'use client';

import { useEffect, useState } from 'react';
import { TikTokAnalytics as TikTokAnalyticsType } from '@/types';

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

export default function TikTokAnalytics() {
  const [analytics, setAnalytics] = useState<TikTokAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/tiktok');
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
      await fetch('/api/tiktok', { method: 'POST' });
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
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    const isNotConnected = error.includes('No TikTok account connected');

    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="text-center py-12">
          {isNotConnected ? (
            <>
              <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Your TikTok Account</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Link your TikTok account to see your video analytics, performance metrics, and get AI-powered content suggestions.
              </p>
              <a
                href="/api/auth/link-tiktok"
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                </svg>
                Connect TikTok
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
          No analytics data available. Connect your TikTok account to get started.
        </p>
      </div>
    );
  }

  const { user, videos, recentPerformance, topVideos } = analytics;

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {user.avatar_url && (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="w-20 h-20 rounded-full"
              />
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user.display_name}</h2>
              {user.bio_description && (
                <p className="text-gray-500 mt-1 max-w-md">{user.bio_description}</p>
              )}
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
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Followers</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(user.follower_count || 0)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Following</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(user.following_count || 0)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Total Likes</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(user.likes_count || 0)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Videos</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(user.video_count || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Performance */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Performance (Last 10 Videos)
        </h3>
        <div className="grid grid-cols-5 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600">Total Views</p>
            <p className="text-xl font-bold text-blue-700">
              {formatNumber(recentPerformance.totalViews)}
            </p>
          </div>
          <div className="text-center p-4 bg-pink-50 rounded-lg">
            <p className="text-sm text-pink-600">Total Likes</p>
            <p className="text-xl font-bold text-pink-700">
              {formatNumber(recentPerformance.totalLikes)}
            </p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-600">Total Comments</p>
            <p className="text-xl font-bold text-purple-700">
              {formatNumber(recentPerformance.totalComments)}
            </p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Total Shares</p>
            <p className="text-xl font-bold text-green-700">
              {formatNumber(recentPerformance.totalShares)}
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
      {topVideos.length > 0 && (
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
                {video.cover_image_url && (
                  <img
                    src={video.cover_image_url}
                    alt={video.title || 'Video thumbnail'}
                    className="w-20 h-28 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">
                    {video.title || video.video_description || 'Untitled'}
                  </h4>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>{formatNumber(video.view_count || 0)} views</span>
                    <span>{formatNumber(video.like_count || 0)} likes</span>
                    <span>{formatNumber(video.comment_count || 0)} comments</span>
                    <span>{formatNumber(video.share_count || 0)} shares</span>
                    <span>{formatDuration(video.duration)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Engagement</p>
                  <p className="font-semibold text-gray-900">
                    {(video.view_count || 0) > 0
                      ? (
                          (((video.like_count || 0) + (video.comment_count || 0) + (video.share_count || 0)) /
                            (video.view_count || 1)) *
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
      )}

      {/* All Videos */}
      {videos.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            All Videos ({videos.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">Video</th>
                  <th className="pb-3 font-medium">Posted</th>
                  <th className="pb-3 font-medium text-right">Views</th>
                  <th className="pb-3 font-medium text-right">Likes</th>
                  <th className="pb-3 font-medium text-right">Comments</th>
                  <th className="pb-3 font-medium text-right">Shares</th>
                  <th className="pb-3 font-medium text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {videos.map((video) => (
                  <tr key={video.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {video.cover_image_url && (
                          <img
                            src={video.cover_image_url}
                            alt={video.title || 'Video thumbnail'}
                            className="w-12 h-16 object-cover rounded"
                          />
                        )}
                        <span className="font-medium text-gray-900 truncate max-w-xs">
                          {video.title || video.video_description || 'Untitled'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-gray-500">
                      {formatDate(video.create_time)}
                    </td>
                    <td className="py-3 text-right font-medium">
                      {formatNumber(video.view_count || 0)}
                    </td>
                    <td className="py-3 text-right">{formatNumber(video.like_count || 0)}</td>
                    <td className="py-3 text-right">{formatNumber(video.comment_count || 0)}</td>
                    <td className="py-3 text-right">{formatNumber(video.share_count || 0)}</td>
                    <td className="py-3 text-right text-gray-500">
                      {formatDuration(video.duration)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {videos.length === 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-gray-500 text-center py-8">
            No videos found. Start posting on TikTok to see your analytics here!
          </p>
        </div>
      )}
    </div>
  );
}
