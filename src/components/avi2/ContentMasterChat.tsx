'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Avi2Message, VideoIdea, TeleprompterScript } from '@/types/avi2';

interface ContentMasterChatProps {
  messages: Avi2Message[];
  setMessages: (messages: Avi2Message[] | ((prev: Avi2Message[]) => Avi2Message[])) => void;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  onVideoIdeas: (ideas: VideoIdea[]) => void;
  onSetTeleprompter: (script: TeleprompterScript) => void;
  videoIdeas: VideoIdea[];
}

const initialGreeting = `Hey! I'm your Content Master.

I can help you:
- Check your **platform stats** (YouTube, Instagram, TikTok, X, Medium)
- Generate **video ideas** based on what's working
- Create **scripts** for your teleprompter

What would you like to work on?`;

export default function ContentMasterChat({
  messages,
  setMessages,
  isStreaming,
  setIsStreaming,
  onVideoIdeas,
  onSetTeleprompter,
  videoIdeas,
}: ContentMasterChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize with greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: initialGreeting,
        timestamp: new Date(),
      }]);
    }
  }, [messages.length, setMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    abortControllerRef.current = new AbortController();
    setIsStreaming(true);

    const userMessage: Avi2Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const assistantMessage: Avi2Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');

    try {
      // Build conversation history for API
      const conversationHistory = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/avi2/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory }),
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
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      content: fullContent,
                    };
                    return updated;
                  });
                } else if (data.type === 'tool' && data.tool === 'show_video_ideas') {
                  onVideoIdeas(data.data.ideas || []);
                } else if (data.type === 'tool' && data.tool === 'set_teleprompter') {
                  onSetTeleprompter({
                    title: data.data.title,
                    sections: data.data.sections,
                  });
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      console.error('Chat error:', error);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Sorry, I encountered an error. Please try again.',
        };
        return updated;
      });
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, [messages, isStreaming, setMessages, setIsStreaming, onVideoIdeas, onSetTeleprompter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleIdeaSelect = (idea: VideoIdea) => {
    sendMessage(`I want to create a video about: "${idea.title}". Create a script for the teleprompter.`);
  };

  const quickActions = [
    { label: 'YouTube stats', prompt: "What's working on my YouTube channel?" },
    { label: 'Video ideas', prompt: 'Give me 5 video ideas based on my performance' },
    { label: 'Content gaps', prompt: 'What content gaps should I fill?' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-sm">Content Master</h2>
            <p className="text-xs text-gray-400">Claude AI</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-100'
              }`}
            >
              {message.role === 'assistant' ? (
                <ReactMarkdown
                  className="prose prose-sm prose-invert max-w-none"
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-purple-300">{children}</strong>,
                  }}
                >
                  {message.content || (isStreaming ? '...' : '')}
                </ReactMarkdown>
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}

        {/* Video Ideas Cards */}
        {videoIdeas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-medium">Select an idea:</p>
            {videoIdeas.map((idea, index) => (
              <button
                key={index}
                onClick={() => handleIdeaSelect(idea)}
                className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors border border-gray-600 hover:border-purple-500"
              >
                <p className="font-medium text-sm text-white">{idea.title}</p>
                <p className="text-xs text-gray-400 mt-1">{idea.description}</p>
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => sendMessage(action.prompt)}
                className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your content..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
