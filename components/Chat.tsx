// components/Chat.tsx
'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import ParticleOrb from './ParticleOrb';
import TopNav from './TopNav';
import LeftToolbar, { ToolbarSettings } from './LeftToolbar';
import { useVoiceFlow } from '@/app/lib/voice/useVoiceFlow';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  feedback?: 'positive' | 'negative' | null;
  decisionId?: string; // For tracking strategy decisions and manual mode feedback
  learningContext?: {
    theme?: string;
    complexity?: number;
    temperature?: number;
    maxTokens?: number;
    toolsEnabled?: boolean;
    modelUsed?: string;
    responseTime?: number;
    tokensUsed?: number;
    mode?: string; // Track interaction mode (clinical-consult, surgical-planning, complications-risk, imaging-dx, rehab-rtp, evidence-brief, auto)
  };
}

export default function Chat() {
  const DEFAULT_MODEL = 'biomistral-7b-instruct';
  const WORKFLOW_LABEL = 'BioGPT + BioMistral';

  // State Management - Chat owns conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Settings come from LeftToolbar
  const [currentSettings, setCurrentSettings] = useState<ToolbarSettings>({
    manualMode: '',
    enableTools: false,
    voiceEnabled: false,
    memoryConsent: false,
  });
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userHasScrolledUp = useRef(false);

  // Voice flow hook - handles STT, TTS, and seamless conversation loop
  const voice = useVoiceFlow({
    onTranscript: (text) => {
      console.log('[Chat] Voice transcript received:', text);
      // Auto-send transcript to LLM
      handleSendMessage(text);
    },
    onError: (error) => {
      console.error('[Chat] Voice error:', error);
      // Error already displayed in voice hook state
    },
    onStateChange: (state) => {
      console.log('[Chat] Voice state changed:', state);
      // For orb visualization updates
    }
  });

  // Auto-scroll to bottom of messages (only if user hasn't scrolled up)
  const scrollToBottom = useCallback(() => {
    if (!userHasScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Detect when user scrolls up manually
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Check if user is scrolled to bottom (within 50px threshold)
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    userHasScrolledUp.current = !isAtBottom;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Store voice functions in refs to avoid infinite loops
  const voiceRef = useRef(voice);

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  // Handle voice toggle
  useEffect(() => {
    if (currentSettings.voiceEnabled) {
      console.log('[Chat] Voice enabled - starting listening');
      voiceRef.current.startListening();
    } else {
      console.log('[Chat] Voice disabled - stopping');
      voiceRef.current.stopListening();
    }
  }, [currentSettings.voiceEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[Chat] Cleanup - stopping voice');
      voiceRef.current.stopListening();
    };
  }, []);

  // Memory consent is now handled by LeftToolbar

  /**
   * Strip markdown formatting for TTS (so it sounds natural when spoken)
   */
  const stripMarkdownForSpeech = useCallback((text: string): string => {
    return text
      // Remove code blocks entirely
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove bold/italic
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove list markers
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }, []);

  /**
   * Send message to LLM (called by text input or voice transcript)
   */
  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || input;
    if (!messageText.trim() || isLoading) return;

    const userId = Date.now().toString();
    const userMsg: Message = { id: userId, role: 'user', content: messageText };

    // Update messages and clear input
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Reset scroll flag so auto-scroll resumes for new messages
    userHasScrolledUp.current = false;

    try {
      // Notify voice system that LLM is thinking
      if (currentSettings.voiceEnabled) {
        voice.setThinking();
      }

      // Send to LLM API
      // Combined workflow is non-streaming by design
      const shouldStream = false;

      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: [...messages, userMsg],
          stream: shouldStream,
          enableTools: currentSettings.enableTools,
          useMemory: currentSettings.memoryConsent,
          manualModeOverride: currentSettings.manualMode || undefined,
          conversationId: conversationId || undefined
        })
      });

      if (!response.ok) throw new Error('API error');

      const aiId = (Date.now() + 1).toString();
      const requestStartTime = Date.now();

      if (!shouldStream) {
        // Non-streaming response (tools enabled)
        const data = await response.json();
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
        const content = data.content || '';
        const responseTime = Date.now() - requestStartTime;

        const aiMsg: Message = {
          id: aiId,
          role: 'assistant',
          content,
          decisionId: data.decisionId || aiId, // Use decisionId or fallback to message ID
          learningContext: {
            theme: data.metadata?.detectedTheme,
            complexity: data.metadata?.complexityScore,
            temperature: data.metadata?.temperature,
            maxTokens: data.metadata?.maxTokens,
            toolsEnabled: currentSettings.enableTools,
            modelUsed: data.model || data.autoSelectedModel || DEFAULT_MODEL,
            responseTime,
            tokensUsed: Math.floor(content.length / 4), // Rough estimate
            mode: data.modeUsed || currentSettings.manualMode || 'auto' // Track which mode was used
          }
        };

        setMessages(prev => [...prev, aiMsg]);

        // Speak response if voice enabled (strip markdown for natural speech)
        if (currentSettings.voiceEnabled && content) {
          const cleanedContent = stripMarkdownForSpeech(content);
          await voice.speakResponse(cleanedContent, true); // true = auto-resume after speaking
        }
      } else {
        // Streaming response (tools disabled)
        let streamDecisionId: string | undefined = undefined;
        let streamLearningContext: any = undefined;

        const aiMsg: Message = { id: aiId, role: 'assistant', content: '' };
        setMessages(prev => [...prev, aiMsg]);

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullContent = '';

          try {
            while (true) {
              const { done, value} = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = (buffer + chunk).split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') break;

                  try {
                    const parsed = JSON.parse(data);

                    // Check for metadata message with decision ID
                    if (parsed.type === 'metadata' && parsed.decisionId) {
                      streamDecisionId = parsed.decisionId;
                      if (parsed.conversationId) {
                        setConversationId(parsed.conversationId);
                      }
                      streamLearningContext = {
                        theme: parsed.theme,
                        complexity: parsed.complexity,
                        temperature: parsed.temperature,
                        maxTokens: parsed.maxTokens,
                        toolsEnabled: currentSettings.enableTools,
                        modelUsed: parsed.modelUsed || DEFAULT_MODEL,
                        responseTime: 0,
                        tokensUsed: 0,
                        mode: currentSettings.manualMode || 'auto'
                      };
                      continue; // Skip rendering this metadata chunk
                    }

                    const content = parsed.choices?.[0]?.delta?.content || '';
                    if (content) {
                      fullContent += content;
                      setMessages(prev => prev.map(msg =>
                        msg.id === aiId
                          ? { ...msg, content: fullContent }
                          : msg
                      ));
                    }
                  } catch {
                    // Skip invalid JSON lines
                  }
                }
              }
            }

            // Handle any remaining buffered line
            const finalLine = buffer.trim();
            if (finalLine.startsWith('data: ')) {
              const data = finalLine.slice(6);
              if (data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === 'metadata' && parsed.decisionId) {
                    streamDecisionId = parsed.decisionId;
                    if (parsed.conversationId) {
                      setConversationId(parsed.conversationId);
                    }
                    streamLearningContext = {
                      theme: parsed.theme,
                      complexity: parsed.complexity,
                      temperature: parsed.temperature,
                      maxTokens: parsed.maxTokens,
                      toolsEnabled: currentSettings.enableTools,
                        modelUsed: parsed.modelUsed || DEFAULT_MODEL,
                      responseTime: 0,
                      tokensUsed: 0,
                      mode: currentSettings.manualMode || 'auto'
                    };
                  } else {
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    if (content) {
                      fullContent += content;
                      setMessages(prev => prev.map(msg =>
                        msg.id === aiId
                          ? { ...msg, content: fullContent }
                          : msg
                      ));
                    }
                  }
                } catch {
                  // Skip invalid JSON lines
                }
              }
            }

            // After streaming completes, update message with decision ID and learning context
            // Always set decisionId (even for manual mode) to enable voting
            const finalDecisionId = streamDecisionId || aiId;
            const responseTime = Date.now() - requestStartTime;
            setMessages(prev => prev.map(msg =>
              msg.id === aiId
                ? {
                    ...msg,
                    decisionId: finalDecisionId,
                    learningContext: streamLearningContext || {
                      modelUsed: DEFAULT_MODEL,
                      responseTime,
                      tokensUsed: Math.floor(fullContent.length / 4),
                      mode: currentSettings.manualMode || 'auto'
                    }
                  }
                : msg
            ));
          } finally {
            reader.releaseLock();
          }

          // Speak full response if voice enabled (strip markdown for natural speech)
          if (currentSettings.voiceEnabled && fullContent) {
            const cleanedContent = stripMarkdownForSpeech(fullContent);
            await voice.speakResponse(cleanedContent, true); // true = auto-resume after speaking
          }
        }
      }

    } catch (error: unknown) {
      console.error('[Chat] Send message error:', error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${(error as Error).message}`
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle user feedback for continuous learning
  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.decisionId) return;

    // Find the corresponding user message for context
    const messageIndex = messages.findIndex(m => m.id === messageId);
    const userMessage = messageIndex > 0 ? messages[messageIndex - 1] : null;

    // Update UI immediately
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, feedback } : msg
    ));

    // Send feedback to backend for learning
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          decisionId: message.decisionId,
          feedback,
          content: message.content,
          timestamp: new Date().toISOString(),
          // Learning context for continuous improvement
          userMessage: userMessage?.content,
          ...message.learningContext
        })
      });
      console.log('[Feedback] Feedback submitted successfully with learning context');
    } catch (error) {
      console.error('[Feedback] Error submitting feedback:', error);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Sticky Top Navigation */}
      <TopNav
        messageCount={messages.length}
      />

      {/* Main Chat Container - Professional Light Background */}
      <div className="flex-1 min-h-0 px-6 pb-8 pt-6 overflow-hidden box-border bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50">
        <div className="max-w-6xl mx-auto flex flex-col gap-4 h-full min-h-0 overflow-hidden">
          <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
            <LeftToolbar
              onSettingsChange={setCurrentSettings}
            />
            <div className="flex-1 flex flex-col gap-6 min-h-0">

              {/* Messages Container */}
              <div className="flex-1 flex flex-col bg-gradient-to-br from-orange-50/95 to-rose-50/85 backdrop-blur-lg rounded-3xl p-8 border border-orange-200/60 shadow-inner shadow-orange-100/40 overflow-hidden min-h-0">
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-orange-400/60 scrollbar-track-transparent space-y-5"
                >
                  {messages.length === 0 ? (
                    // Empty State
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <div className="w-24 h-24 mb-6 rounded-2xl bg-gradient-to-r from-cyan-light/30 to-teal/30 border-2 border-cyan-light/40 animate-pulse shadow-lg" />
                      <p className="text-lg font-bold text-slate-500 tracking-tight">
                        Select your OrthoAI mode
                      </p>
                      <p className="text-xs mt-3 opacity-70 font-medium text-slate-400">
                        Clinical consult • Surgical planning • Complications • Imaging • Rehab • Evidence
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Message List */}
                      {messages.map((msg: Message) => (
                        <div
                          key={msg.id}
                          className={`flex ${
                            msg.role === 'user' ? 'justify-end' : 'justify-start'
                          } animate-in slide-in-from-bottom-3 duration-300 ease-out`}
                        >
                          {msg.role === 'user' ? (
                            // User Message - Right aligned with teal/cyan gradient
                            <div className="max-w-2xl p-6 rounded-2xl shadow-lg border-2 border-teal/50 bg-gradient-to-br from-teal/90 to-cyan-light/80 text-white hover:shadow-xl hover:shadow-teal/40 transition-all duration-200 hover:border-teal/70">
                              <div className="prose prose-sm prose-invert max-w-none">
                                <ReactMarkdown
                                  components={{
                                    p: ({children}) => <p className="whitespace-pre-wrap leading-relaxed font-medium text-white text-sm mb-2 last:mb-0">{children}</p>,
                                    code: ({children}) => <code className="text-cyan-light bg-white/20 px-1.5 py-0.5 rounded text-xs">{children}</code>,
                                    pre: ({children}) => <pre className="bg-slate-900/50 text-cyan-light p-3 rounded-lg overflow-x-auto text-xs my-2">{children}</pre>
                                  }}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ) : (
                            // Assistant Message - Left aligned with slate background
                            <div className="max-w-2xl">
                              <div className="p-6 rounded-2xl shadow-md border-2 border-slate-200 bg-slate-100/80 text-slate-900 hover:shadow-lg hover:shadow-teal/20 transition-all duration-200 hover:bg-slate-100 hover:border-slate-300">
                                <div className="prose prose-sm prose-slate max-w-none">
                                  <ReactMarkdown
                                    components={{
                                      p: ({children}) => <p className="whitespace-pre-wrap leading-relaxed font-normal text-slate-900 text-sm mb-2 last:mb-0">{children}</p>,
                                      code: ({children}) => <code className="text-teal bg-slate-200 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                                      pre: ({children}) => <pre className="bg-slate-800 text-white p-4 rounded-lg overflow-x-auto text-xs my-3 border-2 border-slate-300">{children}</pre>,
                                      ul: ({children}) => <ul className="list-disc list-inside text-slate-900 text-sm space-y-1 my-2">{children}</ul>,
                                      ol: ({children}) => <ol className="list-decimal list-inside text-slate-900 text-sm space-y-1 my-2">{children}</ol>,
                                      li: ({children}) => <li className="text-slate-900">{children}</li>,
                                      h1: ({children}) => <h1 className="text-lg font-bold text-slate-900 mt-3 mb-2">{children}</h1>,
                                      h2: ({children}) => <h2 className="text-base font-bold text-slate-900 mt-2 mb-1">{children}</h2>,
                                      h3: ({children}) => <h3 className="text-sm font-bold text-slate-900 mt-2 mb-1">{children}</h3>,
                                      strong: ({children}) => <strong className="font-bold text-slate-900">{children}</strong>,
                                      em: ({children}) => <em className="italic text-slate-700">{children}</em>,
                                      a: ({children, href}) => <a href={href} className="text-teal hover:text-cyan-light underline" target="_blank" rel="noopener noreferrer">{children}</a>
                                    }}
                                  >
                                    {msg.content}
                                  </ReactMarkdown>
                                </div>
                              </div>

                              {/* Feedback Buttons - Continuous Learning UI - Now available for ALL modes! */}
                              {msg.decisionId && (
                                <div className="flex gap-2 mt-2 ml-2">
                                  <button
                                    onClick={() => handleFeedback(msg.id, 'positive')}
                                    disabled={msg.feedback !== undefined}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                                      msg.feedback === 'positive'
                                        ? 'bg-green-500 text-white shadow-md'
                                        : 'bg-slate-200 text-slate-600 hover:bg-green-100 hover:text-green-700 disabled:opacity-40'
                                    }`}
                                    title="Good response - helps the AI learn"
                                  >
                                    👍 Helpful
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(msg.id, 'negative')}
                                    disabled={msg.feedback !== undefined}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                                      msg.feedback === 'negative'
                                        ? 'bg-red-500 text-white shadow-md'
                                        : 'bg-slate-200 text-slate-600 hover:bg-red-100 hover:text-red-700 disabled:opacity-40'
                                    }`}
                                    title="Poor response - helps the AI improve"
                                  >
                                    👎 Not Helpful
                                  </button>
                                </div>
                              )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Loading Indicator */}
                  {isLoading && (
                    <div className="flex justify-start animate-in slide-in-from-bottom-3 duration-300">
                      <div className="p-6 rounded-2xl bg-slate-100/80 text-slate-900 border-2 border-slate-200 shadow-md">
                        <div className="flex items-center gap-3">
                          <div className="flex space-x-2">
                            <div className="w-2.5 h-2.5 bg-cyan-light rounded-full animate-bounce [animation-delay:0s]" />
                            <div className="w-2.5 h-2.5 bg-teal rounded-full animate-bounce [animation-delay:0.1s]" />
                            <div className="w-2.5 h-2.5 bg-yellow rounded-full animate-bounce [animation-delay:0.2s]" />
                          </div>
                          <span className="text-xs font-medium text-slate-600 ml-1">
                            {currentSettings.voiceEnabled ? 'Listening...' : 'Thinking...'} ({WORKFLOW_LABEL})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Scroll Anchor */}
              <div ref={messagesEndRef} />
            </div>
          </div>
            </div>
          </div>

          {/* Input Area - Voice or Text Mode */}
          {currentSettings.voiceEnabled ? (
            // Voice Mode - Seamless Conversation Loop
            <div className="flex flex-col items-center gap-6 py-6">
              <ParticleOrb
                state={voice.state === 'auto-resuming' ? 'listening' : (voice.state as any)}
                audioLevel={voice.audioLevel}
                beat={voice.audioFrequency.beat}
                disabled={isLoading || !currentSettings.voiceEnabled}
                onClick={() => {
                  // Toggle voice on/off via the orb - update via LeftToolbar settings
                  setCurrentSettings(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }));
                }}
              />

              {/* Voice Error Display */}
              {voice.error && (
                <div className="text-center text-red-600 text-sm font-medium">
                  {voice.error}
                </div>
              )}

              {/* Auto-Resume Status */}
              {voice.state === 'auto-resuming' && (
                <div className="text-center text-teal/70 text-xs font-medium animate-pulse">
                  Ready to listen...
                </div>
              )}
            </div>
          ) : (
            // Text Mode - Input Area
            <div className="flex gap-3 p-2 bg-white/80 backdrop-blur-lg rounded-2xl border-2 border-cyan-light/40 shadow-xl hover:border-cyan-light/60 transition-all duration-200 hover:shadow-2xl">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about orthopedic cases, surgical planning, complications, imaging, rehab, or evidence... (Enter to send)"
                className="flex-1 p-5 bg-transparent text-slate-900 placeholder-slate-400 border-0 resize-none focus:outline-none focus:ring-2 focus:ring-teal/60 rounded-xl min-h-11 max-h-32 font-medium text-sm transition-all duration-200"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !input.trim()}
                className="px-8 py-5 bg-gradient-to-r from-yellow/90 to-peach/90 text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-yellow/40 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap hover:scale-105 active:scale-95 text-sm tracking-wide border-2 border-slate-900/20"
              >
                Send
              </button>
            </div>
          )}

          {/* Footer - Status Info */}
          <div className="text-xs text-slate-500 text-center pt-4 border-t border-cyan-light/20 font-medium tracking-widest">
            🔒 Offline • M4 Optimized • {WORKFLOW_LABEL} • {messages.length} messages
            {currentSettings.manualMode && ` • ${
              currentSettings.manualMode === 'clinical-consult'
                ? '🩺'
                : currentSettings.manualMode === 'surgical-planning'
                ? '🧰'
                : currentSettings.manualMode === 'complications-risk'
                ? '⚠️'
                : currentSettings.manualMode === 'imaging-dx'
                ? '🧠'
                : currentSettings.manualMode === 'rehab-rtp'
                ? '🏃'
                : '📌'
            } ${currentSettings.manualMode}`}
            {currentSettings.voiceEnabled && ' • 🎤 Voice Active'}
          </div>
        </div>
      </div>
    </div>
  );
}
