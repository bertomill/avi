'use client';

import { RecordedVideo, VideoCoachAnalysis, TimestampedNote } from '@/types/avi2';

interface VideoCoachPanelProps {
  recordedVideo: RecordedVideo | null;
  isAnalyzing: boolean;
  analysis: VideoCoachAnalysis | null;
  error: string | null;
  onAnalyze: () => void;
}

function ScoreCircle({ score, size = 'large' }: { score: number; size?: 'large' | 'small' }) {
  const percentage = (score / 10) * 100;
  const strokeWidth = size === 'large' ? 6 : 4;
  const radius = size === 'large' ? 40 : 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = (score: number) => {
    if (score >= 8) return 'text-green-500';
    if (score >= 6) return 'text-yellow-500';
    if (score >= 4) return 'text-orange-500';
    return 'text-red-500';
  };

  const getStrokeColor = (score: number) => {
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#eab308';
    if (score >= 4) return '#f97316';
    return '#ef4444';
  };

  if (size === 'small') {
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg className="transform -rotate-90" width="40" height="40">
          <circle
            cx="20"
            cy="20"
            r={radius}
            stroke="#374151"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx="20"
            cy="20"
            r={radius}
            stroke={getStrokeColor(score)}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <span className={`absolute text-xs font-bold ${getColor(score)}`}>{score}</span>
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90" width="100" height="100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#374151"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={getStrokeColor(score)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <span className={`absolute text-2xl font-bold ${getColor(score)}`}>{score}</span>
    </div>
  );
}

function CategoryCard({
  title,
  score,
  feedback,
  tips,
  timestamps,
}: {
  title: string;
  score: number;
  feedback: string;
  tips: string[];
  timestamps?: TimestampedNote[];
}) {
  return (
    <div className="bg-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-sm">{title}</h4>
        <ScoreCircle score={score} size="small" />
      </div>
      <p className="text-xs text-gray-300 mb-2">{feedback}</p>
      {tips.length > 0 && (
        <ul className="text-xs text-gray-400 space-y-1">
          {tips.slice(0, 2).map((tip, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-purple-400">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
      {timestamps && timestamps.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-600">
          <p className="text-xs text-gray-500 mb-1">Key moments:</p>
          {timestamps.slice(0, 2).map((ts, i) => (
            <div key={i} className="text-xs text-gray-400 flex gap-2">
              <span className="text-purple-400 font-mono">{ts.timestamp}</span>
              <span>{ts.note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VideoCoachPanel({
  recordedVideo,
  isAnalyzing,
  analysis,
  error,
  onAnalyze,
}: VideoCoachPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-sm">Video Coach</h2>
            <p className="text-xs text-gray-400">Gemini AI</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!recordedVideo ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Record a video to get feedback</p>
            <p className="text-xs mt-1">I'll analyze your delivery, pacing, and engagement</p>
          </div>
        ) : !analysis && !isAnalyzing && !error ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-gray-300 mb-2">Video ready for analysis!</p>
            <button
              onClick={onAnalyze}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
            >
              Get Feedback
            </button>
          </div>
        ) : isAnalyzing ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 mb-4 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
            <p className="text-sm text-gray-300">Analyzing your video...</p>
            <p className="text-xs text-gray-500 mt-1">This may take a moment</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-red-600/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm text-red-400 mb-2">{error}</p>
            <button
              onClick={onAnalyze}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Overall Score */}
            <div className="text-center py-4">
              <ScoreCircle score={analysis.overallScore} />
              <p className="text-sm text-gray-400 mt-2">Overall Score</p>
            </div>

            {/* Summary */}
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-sm text-gray-300">{analysis.summary}</p>
            </div>

            {/* Category Scores */}
            <div className="space-y-3">
              <CategoryCard
                title="Delivery"
                score={analysis.delivery.score}
                feedback={analysis.delivery.feedback}
                tips={analysis.delivery.tips}
                timestamps={analysis.delivery.timestamps}
              />
              <CategoryCard
                title="Pacing"
                score={analysis.pacing.score}
                feedback={analysis.pacing.feedback}
                tips={analysis.pacing.tips}
                timestamps={analysis.pacing.timestamps}
              />
              <CategoryCard
                title="Content"
                score={analysis.content.score}
                feedback={analysis.content.feedback}
                tips={analysis.content.tips}
                timestamps={analysis.content.timestamps}
              />
              <CategoryCard
                title="Engagement"
                score={analysis.engagement.score}
                feedback={analysis.engagement.feedback}
                tips={analysis.engagement.tips}
                timestamps={analysis.engagement.timestamps}
              />
            </div>

            {/* Strengths */}
            {analysis.strengths.length > 0 && (
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-3">
                <h4 className="font-medium text-sm text-green-400 mb-2">Strengths</h4>
                <ul className="text-xs text-gray-300 space-y-1">
                  {analysis.strengths.map((strength: string, i: number) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-green-400">+</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvements */}
            {analysis.improvements.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3">
                <h4 className="font-medium text-sm text-yellow-400 mb-2">Areas to Improve</h4>
                <ul className="text-xs text-gray-300 space-y-1">
                  {analysis.improvements.map((improvement: string, i: number) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-yellow-400">!</span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Moments */}
            {analysis.keyMoments && analysis.keyMoments.length > 0 && (
              <div className="bg-gray-700/50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">Key Moments</h4>
                <div className="space-y-2">
                  {analysis.keyMoments.map((moment: TimestampedNote, i: number) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="text-purple-400 font-mono whitespace-nowrap">
                        {moment.timestamp}
                      </span>
                      <span className="text-gray-300">{moment.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
