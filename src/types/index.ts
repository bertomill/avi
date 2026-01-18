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

export interface XUserData {
  id: string;
  username: string;
  name: string;
  description: string;
  profileImageUrl: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  createdAt: string;
  verified: boolean;
}

export interface XTweetData {
  id: string;
  text: string;
  createdAt: string;
  publicMetrics: {
    retweetCount: number;
    replyCount: number;
    likeCount: number;
    quoteCount: number;
    impressionCount: number;
  };
}

export interface XAnalytics {
  user: XUserData;
  tweets: XTweetData[];
  recentPerformance: {
    totalImpressions: number;
    totalLikes: number;
    totalRetweets: number;
    totalReplies: number;
    avgEngagementRate: number;
  };
  topTweets: XTweetData[];
}

export interface TikTokUserData {
  open_id: string;
  union_id?: string;
  display_name: string;
  avatar_url: string;
  bio_description?: string;
  profile_deep_link?: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
}

export interface TikTokVideoData {
  id: string;
  title: string;
  cover_image_url: string;
  video_description?: string;
  duration: number;
  create_time: number;
  share_url: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

export interface TikTokAnalytics {
  user: TikTokUserData;
  videos: TikTokVideoData[];
  recentPerformance: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    avgViewsPerVideo: number;
  };
  topVideos: TikTokVideoData[];
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
  // X data
  xStats?: {
    followers: number;
    following: number;
    tweets: number;
    engagementRate: number;
  };
  topPerformingTweets?: {
    text: string;
    impressions: number;
    likes: number;
    retweets: number;
    engagement: number;
  }[];
  recentTweets?: {
    text: string;
    createdAt: string;
    likes: number;
    retweets: number;
  }[];
  // Medium data
  mediumStats?: {
    username: string;
    totalArticles: number;
  };
  recentArticles?: {
    title: string;
    publishedAt: string;
    categories: string[];
  }[];
}

// Medium Article data from RSS feed
export interface MediumArticleData {
  id: string;
  title: string;
  link: string;
  publishedAt: string;
  contentPreview: string;
  categories: string[];
  author: string;
}

// Medium analytics structure
export interface MediumAnalytics {
  username: string;
  articles: MediumArticleData[];
  recentActivity: {
    totalArticles: number;
    latestPublishedAt: string | null;
    categories: string[];
  };
}
