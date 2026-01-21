'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage, VideoAnalysis } from '@/types';
import VideoEditor from './video-editor/VideoEditor';
import AnimatedAvatar from './AnimatedAvatar';

// Conversation type
interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

// Helper to extract video ideas from a message
function extractVideoIdeas(content: string): string[] {
  const ideas: string[] = [];

  // Match various formats:
  // 1. "Title Here" description
  // 1. **Title Here** description
  // 1. Title Here - description
  const lines = content.split('\n');

  for (const line of lines) {
    // Check if line starts with a number
    const numberMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberMatch) {
      let title = numberMatch[2];

      // Extract quoted title: "Title Here"
      const quotedMatch = title.match(/^[""]([^""]+)[""]/);
      if (quotedMatch) {
        title = quotedMatch[1];
      } else {
        // Extract bold title: **Title Here**
        const boldMatch = title.match(/^\*\*([^*]+)\*\*/);
        if (boldMatch) {
          title = boldMatch[1];
        } else {
          // Take text before description markers (-, :, or just first part)
          const dashIndex = title.indexOf(' - ');
          const colonIndex = title.indexOf(': ');
          if (dashIndex > 0 && dashIndex < 100) {
            title = title.substring(0, dashIndex);
          } else if (colonIndex > 0 && colonIndex < 100) {
            title = title.substring(0, colonIndex);
          }
        }
      }

      title = title.trim().replace(/^\*\*|\*\*$/g, '').replace(/^["'"]|["'"]$/g, '');

      if (title.length > 5 && title.length < 200) {
        ideas.push(title);
      }
    }
  }

  return ideas;
}

// Check if message looks like it contains video ideas
function hasVideoIdeas(content: string): boolean {
  const lowerContent = content.toLowerCase();
  const hasIdeasKeywords = lowerContent.includes('video idea') ||
                           lowerContent.includes('content idea') ||
                           lowerContent.includes('here are') ||
                           lowerContent.includes('suggestions') ||
                           lowerContent.includes('topics') ||
                           lowerContent.includes('concepts');
  const hasNumberedList = /^\d+\.\s+/m.test(content);
  const extractedIdeas = extractVideoIdeas(content);

  // Show buttons if we have numbered items with at least 3 ideas
  return hasNumberedList && extractedIdeas.length >= 3;
}

// Platform configurations with colors
const platforms = [
  { id: 'youtube', name: 'YouTube', color: '#FF0000', icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
  { id: 'instagram', name: 'Instagram', color: '#E4405F', icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z' },
  { id: 'tiktok', name: 'TikTok', color: '#000000', icon: 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z' },
  { id: 'x', name: 'X', color: '#000000', icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
  { id: 'medium', name: 'Medium', color: '#00AB6C', icon: 'M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z' },
];

const initialGreeting = `Hey! 👋

I have access to your **YouTube**, **Instagram**, **TikTok**, **X**, and **Medium** channels. I can see your video performance, engagement metrics, posting history, and audience data.

I can help you:
- **Ideate** new content based on what's working
- **Build** scripts, titles, and descriptions
- **Schedule** and plan your content calendar

What would you like to work on?`;

export default function AviAgent() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: initialGreeting }
  ]);
  const [input, setInput] = useState('');
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const [videoIdeas, setVideoIdeas] = useState<{ title: string; description: string }[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Inline recording state
  const [recordingMode, setRecordingMode] = useState(false);
  const [recordingData, setRecordingData] = useState<{ title: string; script: string } | null>(null);
  const [recordingState, setRecordingState] = useState<'idle' | 'countdown' | 'recording' | 'preview'>('idle');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [countdown, setCountdown] = useState(3);

  // Completed videos displayed in chat
  const [completedVideos, setCompletedVideos] = useState<{ url: string; blob: Blob; title: string; duration: number }[]>([]);
  // Video analysis state
  const [analyzingVideo, setAnalyzingVideo] = useState<number | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<Record<number, VideoAnalysis>>({});
  const [analysisError, setAnalysisError] = useState<Record<number, string>>({});
  // Video editing state
  const [editingVideoIndex, setEditingVideoIndex] = useState<number | null>(null);
  // Cloud save state
  const [savingToCloud, setSavingToCloud] = useState<number | null>(null);
  const [cloudSaveError, setCloudSaveError] = useState<Record<number, string>>({});
  const [savedToCloud, setSavedToCloud] = useState<Record<number, boolean>>({});
  // YouTube export state
  const [exportingToYouTube, setExportingToYouTube] = useState<number | null>(null);
  const [youtubeExportError, setYoutubeExportError] = useState<Record<number, string>>({});
  const [showYouTubeExportModal, setShowYouTubeExportModal] = useState<number | null>(null);
  const [youtubeExportForm, setYoutubeExportForm] = useState<{
    title: string;
    description: string;
    privacy: 'private' | 'unlisted' | 'public';
  }>({ title: '', description: '', privacy: 'private' });
  const [youtubeExportSuccess, setYoutubeExportSuccess] = useState<Record<number, { videoId: string; videoUrl: string }>>({});
  // Cloud videos (loaded from Supabase)
  const [cloudVideos, setCloudVideos] = useState<{
    id: string;
    title: string;
    fileUrl: string;
    duration: number;
    createdAt: string;
    analysis?: VideoAnalysis;
  }[]>([]);
  const [loadingCloudVideos, setLoadingCloudVideos] = useState(false);
  // Quick record modal
  const [showQuickRecordModal, setShowQuickRecordModal] = useState(false);
  const [quickRecordTitle, setQuickRecordTitle] = useState('');
  // Recording source: 'camera' | 'screen' | 'screen-camera' (picture-in-picture)
  const [recordingSource, setRecordingSource] = useState<'camera' | 'screen' | 'screen-camera'>('camera');
  const recordingVideoRef = useRef<HTMLVideoElement>(null);
  const recordingPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [activePlatform, setActivePlatform] = useState(0);
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [pendingVoiceMessage, setPendingVoiceMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Conversation history state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['socials']);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Prompt categories for the right sidebar
  const promptCategories = [
    {
      id: 'socials',
      label: 'Summarize Socials',
      icon: '📊',
      prompts: [
        { label: 'YouTube', prompt: 'Give me a summary of my YouTube channel performance', icon: '🔴' },
        { label: 'Instagram', prompt: 'Give me a summary of my Instagram account performance', icon: '📸' },
        { label: 'TikTok', prompt: 'Give me a summary of my TikTok account performance', icon: '🎵' },
        { label: 'X (Twitter)', prompt: 'Give me a summary of my X account performance', icon: '🐦' },
        { label: 'Medium', prompt: 'Give me a summary of my Medium articles performance', icon: '📝' },
      ],
    },
    {
      id: 'content',
      label: 'Content Ideas',
      icon: '💡',
      prompts: [
        { label: 'Video ideas', prompt: 'Give me 5 video ideas based on my channel performance', icon: '🎬' },
        { label: 'Trending topics', prompt: 'What trending topics should I cover next?', icon: '🔥' },
        { label: 'Content gaps', prompt: 'Analyze my content gaps and opportunities', icon: '🎯' },
      ],
    },
    {
      id: 'strategy',
      label: 'Strategy & Growth',
      icon: '📈',
      prompts: [
        { label: 'Growth tips', prompt: 'Give me tips to grow my audience', icon: '🚀' },
        { label: 'Posting schedule', prompt: 'What is the best posting schedule for my content?', icon: '📅' },
        { label: 'Compare platforms', prompt: 'Compare my performance across all platforms', icon: '⚖️' },
      ],
    },
    {
      id: 'create',
      label: 'Create Content',
      icon: '✏️',
      prompts: [
        { label: 'Write a script', prompt: 'Help me write a video script', icon: '📜' },
        { label: 'Title ideas', prompt: 'Generate catchy title ideas for my next video', icon: '🏷️' },
        { label: 'Description', prompt: 'Write a YouTube description for my video', icon: '📋' },
      ],
    },
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Load conversations and cloud videos on mount
  useEffect(() => {
    loadConversations();
    loadCloudVideos();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      if (response.ok) {
        setConversations(data.conversations || []);
      } else {
        console.error('Failed to load conversations:', data.error);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadCloudVideos = async () => {
    setLoadingCloudVideos(true);
    try {
      const response = await fetch('/api/videos');
      const data = await response.json();
      if (response.ok) {
        setCloudVideos(data.videos || []);
      } else {
        console.error('Failed to load cloud videos:', data.error);
      }
    } catch (error) {
      console.error('Failed to load cloud videos:', error);
    } finally {
      setLoadingCloudVideos(false);
    }
  };

  // Auto-save conversation when messages change (debounced)
  const saveConversation = useCallback(async (msgs: ChatMessage[], convId: string | null) => {
    if (msgs.length <= 1) return; // Don't save if only greeting

    try {
      // Generate title from first user message
      const firstUserMsg = msgs.find(m => m.role === 'user');
      const title = firstUserMsg?.content.slice(0, 50) || 'New conversation';

      if (convId) {
        // Update existing conversation
        await fetch(`/api/conversations/${convId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: msgs, title }),
        });
      } else {
        // Create new conversation
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: msgs, title }),
        });
        const data = await response.json();
        if (response.ok) {
          setCurrentConversationId(data.conversation.id);
          loadConversations(); // Refresh list
        } else {
          console.error('Failed to create conversation:', data.error);
        }
      }
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }, []);

  // Debounced save effect
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveConversation(messages, currentConversationId);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, currentConversationId, saveConversation]);

  // Load a specific conversation
  const loadConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.conversation.messages || [{ role: 'assistant', content: initialGreeting }]);
        setCurrentConversationId(id);
        setSelectedIdea(null);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  // Start a new conversation
  const startNewConversation = () => {
    setMessages([{ role: 'assistant', content: initialGreeting }]);
    setCurrentConversationId(null);
    setSelectedIdea(null);
  };

  // Delete a conversation
  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        startNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
          setInput(transcript);

          // If this is a final result, queue the message to be sent
          if (event.results[event.results.length - 1].isFinal) {
            setIsListening(false);
            if (transcript.trim()) {
              setPendingVoiceMessage(transcript);
            }
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Stop any playing audio first
      if (audioRef.current) {
        audioRef.current.pause();
        setIsSpeaking(false);
      }
      setInput('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Blink animation
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(blinkInterval);
  }, []);

  // Platform scanning animation
  useEffect(() => {
    if (!isScanning) return;
    const scanInterval = setInterval(() => {
      setActivePlatform((prev) => (prev + 1) % platforms.length);
    }, 2000);
    return () => clearInterval(scanInterval);
  }, [isScanning]);

  // Eye follows active platform
  useEffect(() => {
    const angles = [
      { x: -15, y: -5 },
      { x: 15, y: -5 },
      { x: -15, y: 5 },
      { x: 15, y: 5 },
      { x: 0, y: 10 },
    ];
    setEyePosition(angles[activePlatform]);
  }, [activePlatform]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Stop/interrupt the current streaming response
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setIsScanning(true);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    setIsScanning(false);
    setVideoIdeas([]); // Clear previous video ideas
    setSuggestions([]); // Clear previous suggestions
    const userMessage: ChatMessage = { role: 'user', content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // Add a placeholder for the streaming response
    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMessage]);

    try {
      const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: content,
          messages: newMessages,
          enableVoice: voiceEnabled
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'chunk') {
                  fullContent += data.content;
                  // Update the message in real-time
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: fullContent };
                    return updated;
                  });
                } else if (data.type === 'tool' && data.tool === 'show_video_ideas') {
                  // Handle video ideas tool call
                  setVideoIdeas(data.data.ideas || []);
                } else if (data.type === 'tool' && data.tool === 'start_recording') {
                  // Handle start recording tool call
                  setRecordingData({ title: data.data.title, script: data.data.script });
                  setRecordingMode(true);
                  setRecordingState('idle');
                } else if (data.type === 'tool' && data.tool === 'show_suggestions') {
                  // Handle suggestions tool call
                  setSuggestions(data.data.suggestions || []);
                } else if (data.type === 'done') {
                  fullContent = data.content;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: fullContent };
                    return updated;
                  });
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (e) {
                // Skip non-JSON lines
              }
            }
          }
        }
      }

      // Generate voice for the complete response if enabled
      if (voiceEnabled && fullContent) {
        try {
          const voiceResponse = await fetch('/api/agent/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: fullContent }),
          });
          if (voiceResponse.ok) {
            const voiceData = await voiceResponse.json();
            if (voiceData.audioUrl) {
              setIsSpeaking(true);
              const audio = new Audio(voiceData.audioUrl);
              audioRef.current = audio;
              audio.onended = () => setIsSpeaking(false);
              audio.onerror = () => setIsSpeaking(false);
              audio.play().catch(() => setIsSpeaking(false));
            }
          }
        } catch (e) {
          console.error('Voice generation error:', e);
        }
      }
    } catch (error) {
      // Handle abort separately - don't show error for user-initiated stop
      if (error instanceof Error && error.name === 'AbortError') {
        // Keep whatever content was streamed so far
        return;
      }

      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const friendlyMessage = errorMessage.includes('timed out')
        ? 'I took too long to respond. Let me try a simpler approach - could you ask that again?'
        : 'Sorry, I encountered an error. Please try again in a moment.';
      setMessages([
        ...newMessages,
        { role: 'assistant', content: friendlyMessage },
      ]);
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
      setTimeout(() => setIsScanning(true), 1000);
    }
  };

  // Handle voice message after speech recognition completes
  useEffect(() => {
    if (pendingVoiceMessage && !loading) {
      sendMessage(pendingVoiceMessage);
      setPendingVoiceMessage(null);
    }
  }, [pendingVoiceMessage, loading]);

  const quickActions = [
    { label: 'Analyze my content', prompt: 'Tell me about my YouTube posts and what\'s working well' },
    { label: 'Content ideas', prompt: 'Give me 5 video ideas based on my channel performance' },
    { label: 'Find gaps', prompt: 'Analyze my content gaps and opportunities' },
    { label: 'Growth strategy', prompt: 'Review my content strategy and suggest improvements' },
  ];

  // Handle selecting a video idea to create
  const handleSelectVideoIdea = (idea: string) => {
    setSelectedIdea(idea);
    // Ask Avi to create a script for this video
    sendMessage(`I want to create a video about: "${idea}". Can you give me a brief script outline with key talking points?`);
  };

  // Navigate to create page with the selected idea and script
  const handleCreateVideo = (title: string, script: string = '') => {
    const params = new URLSearchParams({
      title,
      script,
    });
    router.push(`/dashboard/create?${params.toString()}`);
  };

  // Inline recording functions
  const initRecordingCamera = async () => {
    try {
      if (recordingSource === 'camera') {
        // Camera only
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: true,
        });
        recordingStreamRef.current = stream;
        if (recordingVideoRef.current) {
          recordingVideoRef.current.srcObject = stream;
        }
      } else if (recordingSource === 'screen') {
        // Screen only
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: true, // System audio if available
        });
        // Also get mic audio
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Combine screen video with mic audio
          const tracks = [
            ...screenStream.getVideoTracks(),
            ...micStream.getAudioTracks(),
          ];
          // If screen has audio, include it too
          if (screenStream.getAudioTracks().length > 0) {
            tracks.push(...screenStream.getAudioTracks());
          }
          recordingStreamRef.current = new MediaStream(tracks);
          screenStreamRef.current = screenStream;
        } catch {
          // No mic, just use screen
          recordingStreamRef.current = screenStream;
          screenStreamRef.current = screenStream;
        }
        if (recordingVideoRef.current) {
          recordingVideoRef.current.srcObject = recordingStreamRef.current;
        }
        // Handle screen share stop
        screenStream.getVideoTracks()[0].onended = () => {
          if (recordingState === 'recording') {
            stopVideoRecording();
          }
        };
      } else if (recordingSource === 'screen-camera') {
        // Screen + Camera Picture-in-Picture
        const [screenStream, cameraStream] = await Promise.all([
          navigator.mediaDevices.getDisplayMedia({
            video: { width: 1920, height: 1080 },
            audio: true,
          }),
          navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: 'user' },
            audio: true,
          }),
        ]);

        screenStreamRef.current = screenStream;
        cameraStreamRef.current = cameraStream;

        // Create canvas for compositing
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        canvasRef.current = canvas;
        const ctx = canvas.getContext('2d')!;

        // Create video elements for streams
        const screenVideo = document.createElement('video');
        screenVideo.srcObject = screenStream;
        screenVideo.muted = true;
        screenVideo.play();

        const cameraVideo = document.createElement('video');
        cameraVideo.srcObject = cameraStream;
        cameraVideo.muted = true;
        cameraVideo.play();

        // Composite loop
        const drawFrame = () => {
          // Draw screen (scaled to fit)
          ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

          // Draw camera PiP in bottom-right corner
          const pipWidth = 240;
          const pipHeight = 180;
          const pipX = canvas.width - pipWidth - 20;
          const pipY = canvas.height - pipHeight - 20;

          // Draw rounded border for PiP
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(pipX - 4, pipY - 4, pipWidth + 8, pipHeight + 8, 12);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(pipX, pipY, pipWidth, pipHeight, 8);
          ctx.clip();
          ctx.drawImage(cameraVideo, pipX, pipY, pipWidth, pipHeight);
          ctx.restore();

          animationFrameRef.current = requestAnimationFrame(drawFrame);
        };
        drawFrame();

        // Create stream from canvas + audio
        const canvasStream = canvas.captureStream(30);
        const audioTracks = cameraStream.getAudioTracks();
        audioTracks.forEach(track => canvasStream.addTrack(track));

        recordingStreamRef.current = canvasStream;

        if (recordingVideoRef.current) {
          recordingVideoRef.current.srcObject = canvasStream;
        }

        // Handle screen share stop
        screenStream.getVideoTracks()[0].onended = () => {
          if (recordingState === 'recording') {
            stopVideoRecording();
          }
        };
      }
    } catch (err) {
      console.error('Recording init error:', err);
    }
  };

  const stopRecordingCamera = () => {
    // Stop animation frame for canvas compositing
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    // Stop all streams
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    canvasRef.current = null;
  };

  const startRecordingCountdown = () => {
    setRecordingState('countdown');
    setCountdown(3);

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          startVideoRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startVideoRecording = () => {
    if (!recordingStreamRef.current) return;

    recordingChunksRef.current = [];
    const mediaRecorder = new MediaRecorder(recordingStreamRef.current, {
      mimeType: 'video/webm;codecs=vp9',
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setRecordingState('preview');

      if (recordingPreviewRef.current) {
        recordingPreviewRef.current.src = URL.createObjectURL(blob);
      }
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setRecordingState('recording');
    setRecordingTime(0);

    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const retakeRecording = () => {
    setRecordedBlob(null);
    setRecordingState('idle');
    setRecordingTime(0);
    if (recordingPreviewRef.current) {
      recordingPreviewRef.current.src = '';
    }
  };

  const saveRecording = () => {
    if (!recordedBlob || !recordingData) return;

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recordingData.title.replace(/[^a-z0-9]/gi, '_')}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const closeRecording = () => {
    stopRecordingCamera();
    setRecordingMode(false);
    setRecordingData(null);
    setRecordingState('idle');
    setRecordedBlob(null);
    setRecordingTime(0);
  };

  // Finish recording and add video to chat
  const finishRecording = () => {
    if (recordedBlob && recordingData) {
      const url = URL.createObjectURL(recordedBlob);
      setCompletedVideos(prev => [...prev, {
        url,
        blob: recordedBlob,
        title: recordingData.title,
        duration: recordingTime,
      }]);
    }
    closeRecording();
  };

  // Helper to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Analyze video with Gemini
  const analyzeVideo = async (videoIndex: number) => {
    const video = completedVideos[videoIndex];
    if (!video) return;

    setAnalyzingVideo(videoIndex);
    setAnalysisError(prev => {
      const newState = { ...prev };
      delete newState[videoIndex];
      return newState;
    });

    try {
      const blob = video.blob;
      const base64Data = await blobToBase64(blob);

      const response = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoData: base64Data,
          mimeType: 'video/webm',
          title: video.title,
          duration: video.duration,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const analysis = await response.json();
      setVideoAnalysis(prev => ({
        ...prev,
        [videoIndex]: analysis,
      }));
    } catch (error) {
      console.error('Video analysis error:', error);
      setAnalysisError(prev => ({
        ...prev,
        [videoIndex]: error instanceof Error ? error.message : 'Analysis failed. Please try again.',
      }));
    } finally {
      setAnalyzingVideo(null);
    }
  };

  // Quick record - bypass agent and start recording immediately
  const startQuickRecord = () => {
    if (!quickRecordTitle.trim()) return;
    setRecordingData({
      title: quickRecordTitle.trim(),
      script: 'Quick recording - no script provided. Just speak naturally!',
    });
    setRecordingMode(true);
    setRecordingState('idle');
    setShowQuickRecordModal(false);
    setQuickRecordTitle('');
  };

  // Save video to Supabase cloud storage
  const saveToCloud = async (videoIndex: number) => {
    const video = completedVideos[videoIndex];
    if (!video) return;

    setSavingToCloud(videoIndex);
    setCloudSaveError(prev => {
      const newState = { ...prev };
      delete newState[videoIndex];
      return newState;
    });

    try {
      const formData = new FormData();
      formData.append('video', video.blob, `${video.title}.webm`);
      formData.append('title', video.title);
      formData.append('duration', video.duration.toString());
      formData.append('recordingSource', recordingSource);

      // Include analysis if available
      if (videoAnalysis[videoIndex]) {
        formData.append('analysis', JSON.stringify(videoAnalysis[videoIndex]));
      }

      const response = await fetch('/api/videos', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save video');
      }

      setSavedToCloud(prev => ({ ...prev, [videoIndex]: true }));
      // Refresh cloud videos list
      loadCloudVideos();
    } catch (error) {
      console.error('Cloud save error:', error);
      setCloudSaveError(prev => ({
        ...prev,
        [videoIndex]: error instanceof Error ? error.message : 'Failed to save to cloud',
      }));
    } finally {
      setSavingToCloud(null);
    }
  };

  // Export video to YouTube
  const exportToYouTube = async (videoIndex: number) => {
    const video = completedVideos[videoIndex];
    if (!video) return;

    setExportingToYouTube(videoIndex);
    setYoutubeExportError(prev => {
      const newState = { ...prev };
      delete newState[videoIndex];
      return newState;
    });

    try {
      const formData = new FormData();
      formData.append('video', video.blob, `${youtubeExportForm.title || video.title}.webm`);
      formData.append('title', youtubeExportForm.title || video.title);
      formData.append('description', youtubeExportForm.description);
      formData.append('privacy', youtubeExportForm.privacy);

      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload to YouTube');
      }

      setYoutubeExportSuccess(prev => ({
        ...prev,
        [videoIndex]: { videoId: data.videoId, videoUrl: data.videoUrl },
      }));
      setShowYouTubeExportModal(null);
    } catch (error) {
      console.error('YouTube export error:', error);
      setYoutubeExportError(prev => ({
        ...prev,
        [videoIndex]: error instanceof Error ? error.message : 'Failed to upload to YouTube',
      }));
    } finally {
      setExportingToYouTube(null);
    }
  };

  // Open YouTube export modal with video title pre-filled
  const openYouTubeExportModal = (videoIndex: number) => {
    const video = completedVideos[videoIndex];
    if (!video) return;
    setYoutubeExportForm({
      title: video.title,
      description: '',
      privacy: 'private',
    });
    setShowYouTubeExportModal(videoIndex);
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize camera when recording mode is enabled
  useEffect(() => {
    if (recordingMode) {
      initRecordingCamera();
    }
    return () => {
      if (recordingMode) {
        stopRecordingCamera();
      }
    };
  }, [recordingMode]);

  return (
    <div className="flex" style={{ minHeight: '700px' }}>
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden flex-shrink-0`}>
        <div className="w-64 h-full bg-gray-50 border-r border-gray-200 flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={startNewConversation}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loadingConversations ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No conversations yet
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      currentConversationId === conv.id
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="flex-1 truncate text-sm">{conv.title}</span>
                    <button
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                    >
                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-gray-200 text-xs text-gray-400 text-center">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 relative bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
        {/* Toggle Sidebar Buttons */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-10 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          title="Toggle conversation history"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {sidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <button
          onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
          className="absolute top-4 right-4 z-10 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          title="Toggle sample prompts"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {rightSidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            )}
          </svg>
        </button>

        {/* Subtle background gradient */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              background: `radial-gradient(circle at 50% 30%, ${platforms[activePlatform].color} 0%, transparent 50%)`,
              transition: 'background 1s ease-in-out',
            }}
          />
        </div>

        {/* Header with Agent visualization */}
      <div className="relative p-6 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
        <div className="flex items-start gap-6">
          {/* Bot Avatar - Enhanced with Motion */}
          <AnimatedAvatar
            isLoading={loading}
            isSpeaking={isSpeaking}
            platformColor={platforms[activePlatform].color}
            size="md"
          />

          {/* Agent info and scanning visualization */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-gray-900">Avi</h2>
              <span
                className="px-2 py-0.5 text-xs font-medium rounded-full"
                style={{
                  backgroundColor: isSpeaking ? '#EDE9FE' : loading ? '#FEF3C7' : '#D1FAE5',
                  color: isSpeaking ? '#7C3AED' : loading ? '#D97706' : '#059669',
                }}
              >
                {isSpeaking ? 'Speaking...' : loading ? 'Thinking...' : 'Online'}
              </span>
              {/* Voice toggle */}
              <button
                onClick={() => {
                  if (isSpeaking && audioRef.current) {
                    audioRef.current.pause();
                    setIsSpeaking(false);
                  }
                  setVoiceEnabled(!voiceEnabled);
                }}
                className={`p-1.5 rounded-lg transition-all ${
                  voiceEnabled
                    ? 'bg-violet-100 text-violet-600 border border-violet-200'
                    : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
                title={voiceEnabled ? 'Voice enabled' : 'Voice disabled'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {voiceEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zm11.414-8.828l.707.707a8 8 0 010 11.314l-.707.707m-1.414-10.607l.707.707a5 5 0 010 7.072l-.707.707" />
                  )}
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Your AI content strategist • Analyzing your social presence
            </p>

            {/* Platform scanning visualization */}
            <div className="flex items-center gap-2">
              {platforms.map((platform, index) => (
                <div key={platform.id} className="relative group">
                  {/* Scan beam */}
                  {isScanning && activePlatform === index && (
                    <div
                      className="absolute -inset-1.5 rounded-lg animate-pulse"
                      style={{
                        background: `radial-gradient(circle, ${platform.color}30 0%, transparent 70%)`,
                      }}
                    />
                  )}

                  <div
                    className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-500 ${
                      activePlatform === index ? 'scale-110 shadow-md' : 'opacity-50'
                    }`}
                    style={{
                      backgroundColor: activePlatform === index ? `${platform.color}15` : '#F3F4F6',
                      borderWidth: '1px',
                      borderColor: activePlatform === index ? platform.color : '#E5E7EB',
                    }}
                  >
                    <svg
                      className="w-4 h-4 transition-colors duration-500"
                      viewBox="0 0 24 24"
                      fill={activePlatform === index ? platform.color : '#9CA3AF'}
                    >
                      <path d={platform.icon} />
                    </svg>
                  </div>

                  {/* Platform name tooltip */}
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {platform.name}
                  </div>
                </div>
              ))}

              {/* Scanning text */}
              <div className="ml-3 flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-400">
                  {isScanning ? `Scanning ${platforms[activePlatform].name}...` : 'Ready'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-col" style={{ height: 'calc(700px - 160px)' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
          <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
                delay: index === messages.length - 1 ? 0 : 0,
              }}
            >
              <div
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <motion.div
                    className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mr-3 flex-shrink-0 shadow-sm"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <motion.div
                      className="w-2 h-2 rounded-full bg-emerald-500"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </motion.div>
                )}
                <motion.div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-200'
                  }`}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  {message.role === 'user' ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                  ) : message.content === '' && loading ? (
                    // Show loading dots inside empty message bubble
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={stopGeneration}
                        className="ml-2 px-2 py-1 text-xs font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        Stop
                      </button>
                    </div>
                  ) : (
                    <div className="prose prose-sm prose-gray max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-gray-900">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-semibold mb-2 text-gray-900">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 text-gray-900">{children}</h3>,
                          p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="text-sm">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          code: ({ children }) => (
                            <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-gray-100 rounded-lg p-3 overflow-x-auto mb-2">{children}</pre>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-3 border-emerald-500 pl-3 italic text-gray-600 mb-2">{children}</blockquote>
                          ),
                          a: ({ href, children }) => (
                            <a href={href} className="text-emerald-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Show quick actions after the initial greeting */}
              {index === 0 && messages.length === 1 && message.role === 'assistant' && (
                <motion.div
                  className="flex flex-wrap gap-2 mt-4 ml-11"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                >
                  {quickActions.map((action, actionIndex) => (
                    <motion.button
                      key={actionIndex}
                      onClick={() => sendMessage(action.prompt)}
                      disabled={loading}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-600 shadow-sm disabled:opacity-50"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 20,
                        delay: actionIndex * 0.1,
                      }}
                    >
                      {action.label}
                    </motion.button>
                  ))}
                </motion.div>
              )}

              {/* Show video idea action buttons from tool call */}
              {message.role === 'assistant' && index === messages.length - 1 && videoIdeas.length > 0 && !loading && (
                <motion.div
                  className="mt-4 ml-11 p-4 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl border border-emerald-100"
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Select a video idea to create:
                  </p>
                  <div className="space-y-2">
                    {videoIdeas.map((idea, ideaIndex) => (
                      <motion.button
                        key={ideaIndex}
                        onClick={() => handleSelectVideoIdea(idea.title)}
                        className="group w-full flex items-start gap-3 px-4 py-3 bg-white rounded-lg text-left text-gray-700 border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 shadow-sm"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 25,
                          delay: ideaIndex * 0.1,
                        }}
                      >
                        <motion.span
                          className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-sm font-bold group-hover:bg-emerald-500 group-hover:text-white"
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.3 }}
                        >
                          {ideaIndex + 1}
                        </motion.span>
                        <div>
                          <div className="font-medium text-gray-900">{idea.title}</div>
                          <div className="text-sm text-gray-500 mt-0.5">{idea.description}</div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Show "Start Recording" button when we have a script/selected idea */}
              {message.role === 'assistant' && selectedIdea && index === messages.length - 1 && videoIdeas.length === 0 && !loading && (
                <motion.div
                  className="mt-4 ml-11"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <motion.button
                    onClick={() => handleCreateVideo(selectedIdea, message.content)}
                    className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium shadow-lg"
                    whileHover={{ scale: 1.05, boxShadow: '0 20px 25px -5px rgba(16, 185, 129, 0.3)' }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <motion.svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </motion.svg>
                    Start Recording This Video
                  </motion.button>
                </motion.div>
              )}

              {/* Show follow-up suggestions */}
              {message.role === 'assistant' && index === messages.length - 1 && suggestions.length > 0 && !loading && (
                <motion.div
                  className="mt-4 ml-11 flex flex-wrap gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {suggestions.map((suggestion, suggestionIndex) => (
                    <motion.button
                      key={suggestionIndex}
                      onClick={() => sendMessage(suggestion)}
                      className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 shadow-sm"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 20,
                        delay: suggestionIndex * 0.08,
                      }}
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </motion.div>
          ))}
          </AnimatePresence>

          {/* Completed Videos in Chat */}
          {completedVideos.map((video, videoIndex) => (
            <div key={videoIndex} className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mr-3 flex-shrink-0 shadow-sm">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="max-w-[75%] rounded-2xl overflow-hidden shadow-lg bg-gray-900 border border-gray-700">
                {/* Video Player */}
                <div className="relative aspect-video bg-black">
                  <video
                    src={video.url}
                    className="w-full h-full object-cover"
                    controls
                    playsInline
                  />
                </div>
                {/* Video Info */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-emerald-400 text-xs font-medium">Video Recorded</span>
                  </div>
                  <h4 className="text-white font-semibold text-sm mb-1">{video.title}</h4>
                  <p className="text-gray-400 text-xs">Duration: {formatRecordingTime(video.duration)}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <a
                      href={video.url}
                      download={`${video.title.replace(/[^a-z0-9]/gi, '_')}.webm`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                    <button
                      onClick={() => {
                        setCompletedVideos(prev => prev.filter((_, i) => i !== videoIndex));
                        URL.revokeObjectURL(video.url);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                    {/* Get AI Feedback Button */}
                    {!videoAnalysis[videoIndex] && (
                      <button
                        onClick={() => analyzeVideo(videoIndex)}
                        disabled={analyzingVideo === videoIndex}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          analyzingVideo === videoIndex
                            ? 'bg-purple-500/20 text-purple-400 cursor-wait'
                            : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400'
                        }`}
                      >
                        {analyzingVideo === videoIndex ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Get AI Feedback
                          </>
                        )}
                      </button>
                    )}
                    {/* Edit Video Button */}
                    <button
                      onClick={() => setEditingVideoIndex(videoIndex)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                      </svg>
                      Edit Video
                    </button>
                    {/* Save to Cloud Button */}
                    {!savedToCloud[videoIndex] ? (
                      <button
                        onClick={() => saveToCloud(videoIndex)}
                        disabled={savingToCloud === videoIndex}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          savingToCloud === videoIndex
                            ? 'bg-green-500/20 text-green-400 cursor-wait'
                            : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                        }`}
                      >
                        {savingToCloud === videoIndex ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Saving...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Save to Cloud
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Saved
                      </span>
                    )}
                    {/* YouTube Export Button */}
                    {youtubeExportSuccess[videoIndex] ? (
                      <a
                        href={youtubeExportSuccess[videoIndex].videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                        View on YouTube
                      </a>
                    ) : (
                      <button
                        onClick={() => openYouTubeExportModal(videoIndex)}
                        disabled={exportingToYouTube === videoIndex}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          exportingToYouTube === videoIndex
                            ? 'bg-red-500/20 text-red-400 cursor-wait'
                            : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                        }`}
                      >
                        {exportingToYouTube === videoIndex ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                            </svg>
                            Post to YouTube
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {/* Cloud Save Error */}
                  {cloudSaveError[videoIndex] && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-400 text-xs">{cloudSaveError[videoIndex]}</p>
                    </div>
                  )}
                  {/* YouTube Export Error */}
                  {youtubeExportError[videoIndex] && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-400 text-xs">{youtubeExportError[videoIndex]}</p>
                    </div>
                  )}

                  {/* Video Editor */}
                  {editingVideoIndex === videoIndex && (
                    <VideoEditor
                      video={video}
                      analysis={videoAnalysis[videoIndex]}
                      onSave={(editedVideo) => {
                        // Replace original video with edited version
                        setCompletedVideos(prev =>
                          prev.map((v, i) => i === videoIndex ? editedVideo : v)
                        );
                        // Clear analysis for edited video since it changed
                        setVideoAnalysis(prev => {
                          const newState = { ...prev };
                          delete newState[videoIndex];
                          return newState;
                        });
                        setEditingVideoIndex(null);
                      }}
                      onCancel={() => setEditingVideoIndex(null)}
                    />
                  )}

                  {/* Analyzing Progress Animation */}
                  {analyzingVideo === videoIndex && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/30 animate-pulse">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          </div>
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-ping" />
                        </div>
                        <div>
                          <h5 className="text-white font-semibold text-sm">Gemini is analyzing your video</h5>
                          <p className="text-gray-400 text-xs">This may take 15-30 seconds</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <span className="text-gray-300 text-xs">Uploading video to Gemini</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                          <span className="text-gray-300 text-xs">Analyzing delivery & body language</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-600" />
                          <span className="text-gray-500 text-xs">Evaluating pacing & content structure</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-600" />
                          <span className="text-gray-500 text-xs">Generating personalized feedback</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error Display */}
                  {analysisError[videoIndex] && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-red-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm">{analysisError[videoIndex]}</span>
                      </div>
                      <button
                        onClick={() => {
                          setAnalysisError(prev => {
                            const newState = { ...prev };
                            delete newState[videoIndex];
                            return newState;
                          });
                          analyzeVideo(videoIndex);
                        }}
                        className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                      >
                        Retry Analysis
                      </button>
                    </div>
                  )}

                  {/* Analysis Results */}
                  {videoAnalysis[videoIndex] && (
                    <div className="mt-4 p-4 bg-gray-800 rounded-xl border border-gray-700">
                      {/* Overall Score */}
                      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-700">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${
                          videoAnalysis[videoIndex].overallScore >= 8 ? 'bg-green-500/20 text-green-400' :
                          videoAnalysis[videoIndex].overallScore >= 6 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {videoAnalysis[videoIndex].overallScore}/10
                        </div>
                        <div>
                          <h5 className="text-white font-semibold">Overall Score</h5>
                          <p className="text-gray-400 text-sm">{videoAnalysis[videoIndex].summary}</p>
                        </div>
                      </div>

                      {/* Key Moments Timeline */}
                      {videoAnalysis[videoIndex].keyMoments && videoAnalysis[videoIndex].keyMoments.length > 0 && (
                        <div className="mb-4 pb-4 border-b border-gray-700">
                          <h6 className="text-purple-400 text-sm font-medium mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Key Moments
                          </h6>
                          <div className="space-y-2">
                            {videoAnalysis[videoIndex].keyMoments.map((moment, i) => (
                              <div key={i} className="flex items-start gap-2 bg-gray-900/50 rounded-lg p-2">
                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-mono whitespace-nowrap">
                                  {moment.timestamp}
                                </span>
                                <span className="text-gray-300 text-xs">{moment.note}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Category Scores */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {(['delivery', 'pacing', 'content', 'engagement'] as const).map((category) => {
                          const data = videoAnalysis[videoIndex][category];
                          return (
                            <div key={category} className="bg-gray-900 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-300 text-sm capitalize">{category}</span>
                                <span className="text-white font-medium">{data.score}/10</span>
                              </div>
                              <p className="text-gray-400 text-xs mb-2">{data.feedback}</p>
                              {/* Timestamps for this category */}
                              {data.timestamps && data.timestamps.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-800 space-y-1">
                                  {data.timestamps.map((ts, i) => (
                                    <div key={i} className="flex items-start gap-1.5">
                                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-mono whitespace-nowrap">
                                        {ts.timestamp}
                                      </span>
                                      <span className="text-gray-400 text-[10px] leading-relaxed">{ts.note}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Strengths & Improvements */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <h6 className="text-green-400 text-sm font-medium mb-2 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Strengths
                          </h6>
                          <ul className="space-y-1">
                            {videoAnalysis[videoIndex].strengths.map((s, i) => (
                              <li key={i} className="text-gray-300 text-xs">{s}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h6 className="text-yellow-400 text-sm font-medium mb-2 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Areas to Improve
                          </h6>
                          <ul className="space-y-1">
                            {videoAnalysis[videoIndex].improvements.map((s, i) => (
                              <li key={i} className="text-gray-300 text-xs">{s}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Inline Recording UI */}
          {recordingMode && recordingData && (
            <div className="mt-4 p-4 bg-gray-900 rounded-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold">{recordingData.title}</h3>
                  <p className="text-gray-400 text-sm">Recording Studio</p>
                </div>
                <button
                  onClick={closeRecording}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Video Preview */}
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                  {recordingState === 'preview' ? (
                    <video
                      ref={recordingPreviewRef}
                      className="w-full h-full object-cover"
                      controls
                      autoPlay
                    />
                  ) : (
                    <>
                      <video
                        ref={recordingVideoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted
                        playsInline
                        style={{ transform: 'scaleX(-1)' }}
                      />

                      {/* Countdown overlay */}
                      {recordingState === 'countdown' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <div className="text-7xl font-bold text-white animate-pulse">
                            {countdown}
                          </div>
                        </div>
                      )}

                      {/* Recording indicator */}
                      {recordingState === 'recording' && (
                        <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-full">
                          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          <span className="font-medium text-sm">{formatRecordingTime(recordingTime)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Script Panel */}
                <div className="bg-gray-800 rounded-xl p-4 max-h-64 overflow-y-auto">
                  <h4 className="text-emerald-400 font-medium text-sm mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Script
                  </h4>
                  <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                    {recordingData.script}
                  </div>
                </div>
              </div>

              {/* Recording Controls */}
              <div className="flex justify-center gap-3 mt-4">
                {recordingState === 'idle' && (
                  <button
                    onClick={startRecordingCountdown}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-all hover:scale-105"
                  >
                    <div className="w-3 h-3 rounded-full bg-white" />
                    Start Recording
                  </button>
                )}

                {recordingState === 'countdown' && (
                  <button
                    disabled
                    className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-full font-medium cursor-not-allowed"
                  >
                    Get Ready...
                  </button>
                )}

                {recordingState === 'recording' && (
                  <button
                    onClick={stopVideoRecording}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-medium transition-all hover:scale-105"
                  >
                    <div className="w-3 h-3 rounded bg-red-500" />
                    Stop Recording
                  </button>
                )}

                {recordingState === 'preview' && (
                  <>
                    <button
                      onClick={retakeRecording}
                      className="px-5 py-2.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      Retake
                    </button>
                    <button
                      onClick={saveRecording}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Save Video
                    </button>
                    <button
                      onClick={finishRecording}
                      className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                    >
                      Done
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? 'Listening...' : 'Ask Avi about your content...'}
              disabled={loading || isListening}
              className={`flex-1 bg-gray-50 border rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all disabled:opacity-50 ${
                isListening ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-200'
              }`}
            />

            {/* Microphone button */}
            {speechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={loading}
                className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100 shadow-sm ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200'
                }`}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isListening ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  )}
                </svg>
              </button>
            )}

            {loading ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="px-5 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 bg-red-500 hover:bg-red-600 text-white shadow-sm"
                title="Stop generating"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || isListening}
                className="px-5 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            )}
          </form>

          {/* Footer hint */}
          <div className="mt-3 text-center">
            <span className="text-xs text-gray-400">
              {isListening ? (
                <span className="text-red-500 font-medium">🎤 Speak now...</span>
              ) : (
                <>Powered by Claude • Analyzing {platforms.length} platforms</>
              )}
            </span>
          </div>
        </div>
      </div>
      </div>

      {/* Right Sidebar - Tools */}
      <div className={`${rightSidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden flex-shrink-0`}>
        <div className="w-72 h-full bg-gray-50 border-l border-gray-200 flex flex-col">
          {/* Right Sidebar Header */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Tools
            </h3>
          </div>

          {/* Tools List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Record Video Tool */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-red-300 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm">Record Video</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Quick record or get AI script</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setShowQuickRecordModal(true)}
                  className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Quick Record
                </button>
                <button
                  onClick={() => sendMessage("I'm ready to record a video. Help me get started with a script and talking points.")}
                  disabled={loading}
                  className="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  With Script
                </button>
              </div>
            </div>

            {/* Video Analysis Tool */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-purple-300 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                    Video Analysis
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-[10px] rounded font-medium">Gemini</span>
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">AI feedback on delivery & pacing</p>
                </div>
              </div>
              <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-500">Record a video first, then click &quot;Get AI Feedback&quot; on the video card.</p>
              </div>
            </div>

            {/* Content Ideas Tool */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-yellow-300 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm">Content Ideas</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Generate video ideas from your data</p>
                </div>
              </div>
              <button
                onClick={() => sendMessage("Give me 5 video ideas based on my analytics and what's performing well.")}
                disabled={loading}
                className="w-full mt-3 px-3 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                Generate Ideas
              </button>
            </div>

            {/* Analytics Summary Tool */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm">Analytics Summary</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Cross-platform performance overview</p>
                </div>
              </div>
              <button
                onClick={() => sendMessage("Give me a summary of my performance across all connected platforms.")}
                disabled={loading}
                className="w-full mt-3 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                View Summary
              </button>
            </div>

            {/* Script Generator Tool */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-sm">Script Generator</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Create scripts from topics</p>
                </div>
              </div>
              <button
                onClick={() => sendMessage("Help me write a video script. Ask me what topic I want to cover.")}
                disabled={loading}
                className="w-full mt-3 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                Write Script
              </button>
            </div>

            {/* My Videos Section */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                  My Videos
                </h4>
                <button
                  onClick={loadCloudVideos}
                  disabled={loadingCloudVideos}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Refresh"
                >
                  <svg className={`w-4 h-4 ${loadingCloudVideos ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {loadingCloudVideos ? (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-gray-500 mt-2">Loading videos...</p>
                </div>
              ) : cloudVideos.length === 0 ? (
                <div className="text-center py-4 bg-gray-100 rounded-lg">
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-gray-500">No saved videos yet</p>
                  <p className="text-[10px] text-gray-400 mt-1">Record and save videos to see them here</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cloudVideos.map((video) => (
                    <div
                      key={video.id}
                      className="bg-white rounded-lg border border-gray-200 p-3 hover:border-green-300 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-10 bg-gray-900 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <video
                            src={video.fileUrl}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-medium text-gray-900 truncate">{video.title}</h5>
                          <p className="text-[10px] text-gray-500">
                            {formatRecordingTime(Math.round(video.duration))} • {new Date(video.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={video.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] font-medium text-center transition-colors"
                        >
                          Play
                        </a>
                        <button
                          onClick={() => {
                            // Load video into completedVideos for editing
                            fetch(video.fileUrl)
                              .then(res => res.blob())
                              .then(blob => {
                                const newVideo = {
                                  url: video.fileUrl,
                                  blob,
                                  title: video.title,
                                  duration: video.duration,
                                };
                                setCompletedVideos(prev => [newVideo, ...prev]);
                                // Set the analysis if available
                                if (video.analysis) {
                                  setVideoAnalysis(prev => ({ ...prev, [0]: video.analysis as VideoAnalysis }));
                                }
                                // Open editor
                                setEditingVideoIndex(0);
                              });
                          }}
                          className="flex-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-[10px] font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Delete this video?')) {
                              try {
                                const res = await fetch(`/api/videos?id=${video.id}`, { method: 'DELETE' });
                                if (res.ok) {
                                  loadCloudVideos();
                                }
                              } catch (err) {
                                console.error('Delete failed:', err);
                              }
                            }
                          }}
                          className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[10px] font-medium transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar Footer */}
          <div className="p-3 border-t border-gray-200 text-xs text-gray-400 text-center">
            Powered by Claude & Gemini
          </div>
        </div>
      </div>

      {/* Quick Record Modal */}
      {showQuickRecordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Quick Record</h3>
                    <p className="text-white/70 text-xs">Start recording immediately</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowQuickRecordModal(false);
                    setQuickRecordTitle('');
                  }}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Title
                </label>
                <input
                  type="text"
                  value={quickRecordTitle}
                  onChange={(e) => setQuickRecordTitle(e.target.value)}
                  placeholder="e.g., 5 Tips for Better Content"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && quickRecordTitle.trim()) {
                      startQuickRecord();
                    }
                  }}
                />
              </div>

              {/* Recording Source Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recording Source
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordingSource('camera')}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      recordingSource === 'camera'
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium">Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordingSource('screen')}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      recordingSource === 'screen'
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium">Screen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordingSource('screen-camera')}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      recordingSource === 'screen-camera'
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    <span className="text-xs font-medium">Both</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {recordingSource === 'camera' && 'Record using your webcam'}
                  {recordingSource === 'screen' && 'Record your screen with voiceover'}
                  {recordingSource === 'screen-camera' && 'Screen recording with camera overlay (PiP)'}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => {
                  setShowQuickRecordModal(false);
                  setQuickRecordTitle('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startQuickRecord}
                disabled={!quickRecordTitle.trim()}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Start Recording
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Export Modal */}
      {showYouTubeExportModal !== null && completedVideos[showYouTubeExportModal] && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Post to YouTube</h3>
                    <p className="text-white/70 text-xs">Upload your video to YouTube</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowYouTubeExportModal(null)}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Title
                </label>
                <input
                  type="text"
                  value={youtubeExportForm.title}
                  onChange={(e) => setYoutubeExportForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter video title"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={youtubeExportForm.description}
                  onChange={(e) => setYoutubeExportForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your video..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Privacy
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setYoutubeExportForm(prev => ({ ...prev, privacy: 'private' }))}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      youtubeExportForm.privacy === 'private'
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-xs font-medium">Private</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setYoutubeExportForm(prev => ({ ...prev, privacy: 'unlisted' }))}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      youtubeExportForm.privacy === 'unlisted'
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                    <span className="text-xs font-medium">Unlisted</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setYoutubeExportForm(prev => ({ ...prev, privacy: 'public' }))}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      youtubeExportForm.privacy === 'public'
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium">Public</span>
                  </button>
                </div>
              </div>

              {/* Error display */}
              {showYouTubeExportModal !== null && youtubeExportError[showYouTubeExportModal] && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-600 text-sm">{youtubeExportError[showYouTubeExportModal]}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowYouTubeExportModal(null)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => showYouTubeExportModal !== null && exportToYouTube(showYouTubeExportModal)}
                disabled={!youtubeExportForm.title.trim() || exportingToYouTube !== null}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {exportingToYouTube !== null ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    Upload to YouTube
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
