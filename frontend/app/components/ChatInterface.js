'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/authContext';
import { toast } from 'react-hot-toast';

export default function ChatInterface({ selectedLocations }) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch chat history sessions
  useEffect(() => {
    if (showHistory && currentUser) {
      fetchSessions();
    }
  }, [showHistory, currentUser]);

  const fetchSessions = async () => {
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      setIsLoading(true);
      const token = await currentUser.getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat/sessions/${sessionId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        setCurrentSessionId(sessionId);
        setShowHistory(false);
      }
    } catch (error) {
      console.error('Error loading session:', error);
      toast.error("Failed to load chat");
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowHistory(false);
    setInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Generate Session ID if new
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = Date.now().toString();
        setCurrentSessionId(sessionId);
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      const locationsString = selectedLocations.map(loc => loc.name).join(', ');

      const token = currentUser ? await currentUser.getIdToken() : '';

      const response = await fetch(`${backendUrl}/chat?locations=${encodeURIComponent(locationsString)}&chatId=${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify([
          ...messages,
          userMessage
        ]),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = { role: 'assistant', content: '' };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        assistantMessage.content += text;

        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = { ...assistantMessage };
          } else {
            newMessages.push({ ...assistantMessage });
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, there was an error. ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (showHistory) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-3 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-700">Chat History</h3>
          <button
            onClick={() => setShowHistory(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No previous chats found.</div>
          ) : (
            sessions.map(session => (
              <button
                key={session.id}
                onClick={() => loadSession(session.id)}
                className="w-full text-left p-3 border-b hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900 truncate">
                  {session.lastMessage ? session.lastMessage.substring(0, 50) + '...' : 'New Chat'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(session.timestamp).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="p-3 border-t">
          <button
            onClick={startNewChat}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Start New Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Toolbar */}
      <div className="absolute top-2 right-4 z-10">
        <button
          onClick={() => setShowHistory(true)}
          className="text-gray-400 hover:text-blue-600 p-1 bg-white/80 rounded-full shadow-sm backdrop-blur-sm"
          title="History"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto space-y-4 mb-4 p-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <p>Start a conversation with Pathwise AI</p>
            <p className="mt-2 text-xs">Ask for recommendations, routes, or local tips.</p>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 shadow-sm ${message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800'
                }`}
            >
              <ReactMarkdown className="text-sm prose prose-sm max-w-none">
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 rounded-lg px-4 py-2 text-sm">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 p-2 border-t bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 p-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${isLoading || !input.trim()
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}