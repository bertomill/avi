export interface YouTubeChannelData {
  id: string;
  title: string;
  description: string;
  customUrl: string;
  publishedAt: string;
  thumbnailUrl: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

export interface YouTubeVideoData {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface YouTubeAnalytics {
  channel: YouTubeChannelData;
  videos: YouTubeVideoData[];
  recentPerformance: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    avgViewsPerVideo: number;
  };
  topVideos: YouTubeVideoData[];
}

export interface InstagramAccountData {
  id: string;
  username: string;
  name: string;
  biography: string;
  profilePictureUrl: string;
  followerCount: number;
  followingCount: number;
  mediaCount: number;
}

export interface InstagramMediaData {
  id: string;
  caption: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl: string;
  thumbnailUrl: string;
  permalink: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
}

export interface InstagramAnalytics {
  account: InstagramAccountData;
  media: InstagramMediaData[];
  recentPerformance: {
    totalLikes: number;
    totalComments: number;
    avgLikesPerPost: number;
    avgCommentsPerPost: number;
    engagementRate: number;
  };
  topPosts: InstagramMediaData[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ContentSuggestion {
  type: 'title' | 'description' | 'idea' | 'script' | 'thumbnail';
  content: string;
}

export interface AIContext {
  // YouTube data
  channelStats?: {
    subscribers: number;
    totalViews: number;
    videoCount: number;
  };
  topPerformingVideos?: {
    title: string;
    views: number;
    engagement: number;
  }[];
  recentContent?: {
    title: string;
    publishedAt: string;
    performance: number;
  }[];
  audienceInsights?: {
    demographics?: string;
    watchPatterns?: string;
  };
  // Instagram data
  instagramStats?: {
    followers: number;
    following: number;
    posts: number;
    engagementRate: number;
  };
  topPerformingPosts?: {
    caption: string;
    likes: number;
    comments: number;
    engagement: number;
  }[];
  recentPosts?: {
    caption: string;
    timestamp: string;
    likes: number;
    comments: number;
  }[];
}
