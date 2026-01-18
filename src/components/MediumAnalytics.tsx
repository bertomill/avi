'use client';

import { useEffect, useState } from 'react';
import { MediumAnalytics as MediumAnalyticsType } from '@/types';

function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown date';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MediumAnalytics() {
  const [analytics, setAnalytics] = useState<MediumAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/medium');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch Medium data');
        return;
      }

      setAnalytics(data);
    } catch (err) {
      setError('Failed to load Medium data');
      console.error('Error fetching Medium analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/medium', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error syncing Medium data:', err);
    } finally {
      setSyncing(false);
    }
  };

  const connectUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    try {
      setConnecting(true);
      setConnectError(null);

      const response = await fetch('/api/medium/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setConnectError(data.error || 'Failed to connect Medium account');
        return;
      }

      // Refresh analytics
      await fetchAnalytics();
      setUsernameInput('');
    } catch (err) {
      setConnectError('Failed to connect Medium account');
      console.error('Error connecting Medium:', err);
    } finally {
      setConnecting(false);
    }
  };

  const disconnectMedium = async () => {
    if (!confirm('Are you sure you want to disconnect your Medium account?')) {
      return;
    }

    try {
      const response = await fetch('/api/medium/connect', { method: 'DELETE' });

      if (response.ok) {
        setAnalytics(null);
        setError('No Medium account connected');
      }
    } catch (err) {
      console.error('Error disconnecting Medium:', err);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-6 w-48 bg-gray-200 rounded"></div>
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Not connected state - show username input form
  if (error?.includes('No Medium account connected')) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm">
        <div className="text-center max-w-md mx-auto">
          {/* Medium Logo */}
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Medium Account</h2>
          <p className="text-gray-600 mb-6">
            Enter your Medium username to view your articles and get AI-powered writing insights.
          </p>

          <form onSubmit={connectUsername} className="space-y-4">
            <div>
              <label htmlFor="medium-username" className="sr-only">Medium Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">@</span>
                <input
                  id="medium-username"
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="username"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  disabled={connecting}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Example: bertomill or @bertomill
              </p>
            </div>

            {connectError && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                {connectError}
              </div>
            )}

            <button
              type="submit"
              disabled={connecting || !usernameInput.trim()}
              className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {connecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
                  </svg>
                  Connect Medium
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center">
        <div className="text-red-500 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // No analytics available
  if (!analytics) {
    return null;
  }

  // Connected state - display articles
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">@{analytics.username}</h2>
              <a
                href={`https://medium.com/@${analytics.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-green-600 text-sm"
              >
                View on Medium
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={syncData}
              disabled={syncing}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={disconnectMedium}
              className="text-gray-400 hover:text-red-500 p-2 rounded-lg transition-colors"
              title="Disconnect Medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Total Articles</p>
            <p className="text-2xl font-bold text-gray-900">{analytics.recentActivity.totalArticles}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Latest Article</p>
            <p className="text-lg font-semibold text-gray-900">
              {analytics.recentActivity.latestPublishedAt
                ? formatDate(analytics.recentActivity.latestPublishedAt)
                : 'No articles'
              }
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Topics Covered</p>
            <p className="text-2xl font-bold text-gray-900">{analytics.recentActivity.categories.length}</p>
          </div>
        </div>
      </div>

      {/* Categories/Topics */}
      {analytics.recentActivity.categories.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Topics You Write About</h3>
          <div className="flex flex-wrap gap-2">
            {analytics.recentActivity.categories.map((cat) => (
              <span
                key={cat}
                className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Articles List */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4">
          Your Articles ({analytics.articles.length})
        </h3>
        {analytics.articles.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No articles found. Start writing on Medium!</p>
        ) : (
          <div className="space-y-4">
            {analytics.articles.map((article) => (
              <a
                key={article.id}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 group-hover:text-green-600 transition-colors">
                      {article.title}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(article.publishedAt)}</p>
                    {article.contentPreview && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{article.contentPreview}</p>
                    )}
                    {article.categories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {article.categories.slice(0, 4).map((cat) => (
                          <span
                            key={cat}
                            className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded"
                          >
                            {cat}
                          </span>
                        ))}
                        {article.categories.length > 4 && (
                          <span className="text-xs text-gray-500">+{article.categories.length - 4} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
