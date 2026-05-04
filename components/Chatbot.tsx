'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GoogleGenAI } from '@google/genai';
import { useAuth } from '@/context/AuthContext';
import {
  appendChatExchange,
  createChatSession,
  getChatMessages,
  getOrCreateChatClientId,
  listChatSessions,
} from '@/lib/chat-history';

const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

interface Message {
  role: 'user' | 'model';
  text: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTemporaryModelUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = error.message.toLowerCase();
  return text.includes('503')
    || text.includes('unavailable')
    || text.includes('high demand')
    || text.includes('experiencing high demand');
}

async function sendWithRetry(chat: any, userMessage: string): Promise<string> {
  const delays = [0, 800, 1500];

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) {
      await sleep(delays[attempt]);
    }

    try {
      const response = await chat.sendMessage({ message: userMessage });
      return response.text || 'Sorry, I could not process that.';
    } catch (error) {
      const isLastAttempt = attempt === delays.length - 1;
      if (!isTemporaryModelUnavailable(error) || isLastAttempt) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw new Error('Assistant is temporarily unavailable.');
}

export function Chatbot() {
  const { accessToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hi! I am the Gebiya assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const chatRef = useRef<any>(null);
  const clientIdRef = useRef<string>('');

  // Initialize chat session
  useEffect(() => {
    if (!geminiApiKey) {
      return;
    }

    if (!chatRef.current) {
      aiRef.current = new GoogleGenAI({ apiKey: geminiApiKey });
      chatRef.current = aiRef.current.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: 'You are a helpful customer support assistant for Gebiya, a modern e-commerce store selling electronics, jewelry, and clothing. Be concise, friendly, and helpful. Keep responses short.',
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = getOrCreateChatClientId();
    }

    const bootstrapHistory = async () => {
      setIsHistoryLoading(true);

      try {
        const sessions = await listChatSessions({
          accessToken,
          clientId: clientIdRef.current,
        });

        let activeSession = sessions[0];
        if (!activeSession) {
          activeSession = await createChatSession({
            accessToken,
            clientId: clientIdRef.current,
            title: 'Gebiya assistant chat',
            metadata: { source: 'web-chatbot' },
          });
        }

        setSessionId(activeSession.id);
        const persistedMessages = await getChatMessages({
          sessionId: activeSession.id,
          accessToken,
          clientId: clientIdRef.current,
        });

        if (persistedMessages.length > 0) {
          setMessages(
            persistedMessages
              .filter((msg) => msg.role === 'user' || msg.role === 'model')
              .map((msg) => ({ role: msg.role as 'user' | 'model', text: msg.content }))
          );
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    void bootstrapHistory();
  }, [accessToken]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);
    const startedAt = Date.now();

    try {
      if (!chatRef.current) {
        throw new Error('Gemini API key is missing. Set NEXT_PUBLIC_GEMINI_API_KEY to enable chat.');
      }
      
      const assistantMessage = await sendWithRetry(chatRef.current, userMessage);
      
      setMessages(prev => [...prev, { role: 'model', text: assistantMessage }]);

      let activeSessionId = sessionId;
      if (!activeSessionId) {
        const session = await createChatSession({
          accessToken,
          clientId: clientIdRef.current || getOrCreateChatClientId(),
          title: 'Gebiya assistant chat',
          metadata: { source: 'web-chatbot' },
        });
        activeSessionId = session.id;
        setSessionId(session.id);
      }

      await appendChatExchange({
        sessionId: activeSessionId,
        accessToken,
        clientId: clientIdRef.current || getOrCreateChatClientId(),
        userMessage,
        assistantMessage,
        modelName: 'gemini-3-flash-preview',
        latencyMs: Date.now() - startedAt,
        metadata: { source: 'web-chatbot' },
      });
    } catch (error) {
      console.error('Chat error:', error);
      const temporaryBusy = isTemporaryModelUnavailable(error);
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          text: temporaryBusy
            ? 'The assistant is experiencing high demand right now. Please try again in a few seconds.'
            : 'Sorry, I encountered an error. Please try again later.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105 z-50 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex h-[500px] w-[350px] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl transition-all duration-300 sm:w-[400px] ${
          isOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-10 opacity-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-gradient-to-r from-cyan-700 via-sky-700 to-blue-800 p-4 text-white">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <h3 className="font-medium">Gebiya Assistant</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50">
          {isHistoryLoading && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-zinc-900 text-white rounded-br-sm'
                    : 'bg-white border text-zinc-900 rounded-bl-sm shadow-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border text-zinc-900 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="border-t bg-white p-4">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={geminiApiKey ? 'Type your message...' : 'Chat unavailable: missing API key'}
              className="flex-1"
              disabled={isLoading || !geminiApiKey}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading || !geminiApiKey}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
