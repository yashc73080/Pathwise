'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/authContext';
import { useTrip } from '../context/TripContext';
import { toast } from 'react-hot-toast';

export default function ChatInterface({ selectedLocations, onNewChat, onShowHistory, showHistoryProp, setShowHistoryProp, newChatTrigger }) {
  const { currentUser } = useAuth();
  const { setCurrentPlace, setCurrentMarker, currentMarker, map, setChatHeight, setActivePanel, activePanel, currentChatSessionId, setCurrentChatSessionId, addToItinerary } = useTrip();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [internalShowHistory, setInternalShowHistory] = useState(false);

  // Use external showHistory control if provided (for mobile header integration)
  const showHistory = showHistoryProp !== undefined ? showHistoryProp : internalShowHistory;
  const setShowHistory = setShowHistoryProp || setInternalShowHistory;

  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const isNewChatRef = useRef(false); // Prevents auto-loading after starting new chat

  // Parse message content to extract structured place data
  const parseMessageContent = (content) => {
    const placesMatch = content.match(/<!--PLACES_DATA:(.*?):PLACES_DATA-->/);
    let places = null;
    let textContent = content;

    if (placesMatch) {
      try {
        places = JSON.parse(placesMatch[1]);
        textContent = content.replace(/<!--PLACES_DATA:.*?:PLACES_DATA-->/g, '').trim();
      } catch (e) {
        console.error('Error parsing places data:', e);
      }
    }

    return { places, textContent };
  };

  // Location Card component
  const LocationCard = ({ place }) => {
    const handleShowOnMap = () => {
      if (!map) {
        toast.error('Map not ready');
        return;
      }

      const lat = place.location?.lat;
      const lng = place.location?.lng;

      if (!lat || !lng) {
        toast.error('Location coordinates not available');
        return;
      }

      // Clear any existing preview marker
      if (currentMarker) {
        currentMarker.setMap(null);
      }

      // Set the current place for the sidebar/popup
      setCurrentPlace({
        name: place.name,
        address: place.address,
        lat: lat,
        lng: lng,
        placeId: place.place_id
      });

      // Create a red preview marker
      const marker = new window.google.maps.Marker({
        map: map,
        position: { lat, lng },
        title: place.name,
        animation: window.google.maps.Animation.DROP
      });

      setCurrentMarker(marker);

      // Pan to the location
      map.panTo({ lat, lng });
      map.setZoom(18);

      // On mobile, minimize chat to partial height to show the map
      if (window.innerWidth < 768 && activePanel === 'chat') {
        setChatHeight('partial');
      }

      toast.success(`Showing ${place.name} on map`);
    };

    const handleAddToItinerary = () => {
      const lat = place.location?.lat;
      const lng = place.location?.lng;

      if (!lat || !lng) {
        toast.error('Location coordinates not available');
        return;
      }

      addToItinerary({
        name: place.name,
        address: place.address,
        lat: lat,
        lng: lng,
        placeId: place.place_id
      });

      // On mobile, minimize chat to partial height to show the map
      if (window.innerWidth < 768 && activePanel === 'chat') {
        setChatHeight('partial');
      }
    };

    const handleOpenDetails = () => {
      // Open Google Maps with place details
      // Use place_id on desktop (better UX), search query on mobile (app compatibility)
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const url = place.place_id && !isMobile
        ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + (place.address || ''))}`;

      // On mobile, use direct navigation to avoid blank intermediate page
      if (isMobile) {
        window.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    };

    return (
      <div
        onClick={handleOpenDetails}
        className="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 text-sm truncate">{place.name}</h4>
            <p className="text-xs text-gray-500 truncate mt-0.5">{place.address}</p>
            {place.rating && (
              <div className="flex items-center mt-1">
                <span className="text-yellow-500 text-xs">★</span>
                <span className="text-xs text-gray-600 ml-1">{place.rating}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 ml-2 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); handleShowOnMap(); }}
              className="w-full px-4 py-2 md:px-3 md:py-1.5 bg-blue-600 text-white text-sm md:text-xs font-medium rounded-lg md:rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 md:gap-1"
            >
              <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Show
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAddToItinerary(); }}
              className="w-full px-4 py-2 md:px-3 md:py-1.5 bg-green-600 text-white text-sm md:text-xs font-medium rounded-lg md:rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5 md:gap-1"
            >
              <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  // Auto-load most recent session on mount, or specific session if set from loaded trip
  useEffect(() => {
    if (currentUser && currentChatSessionId && currentChatSessionId !== currentSessionId) {
      // Load the specific session from a loaded trip
      isNewChatRef.current = false;
      loadSession(currentChatSessionId);
    } else if (currentUser && !currentSessionId && !currentChatSessionId && !isNewChatRef.current) {
      loadMostRecentSession();
    }
  }, [currentUser, currentChatSessionId]);

  // Watch for new chat trigger from mobile header
  useEffect(() => {
    if (newChatTrigger > 0) {
      // Mark that we intentionally started a new chat
      isNewChatRef.current = true;
      // Start new chat inline
      setMessages([]);
      setCurrentSessionId(null);
      setCurrentChatSessionId(null);
      setShowHistory(false);
      setInput('');
    }
  }, [newChatTrigger]);

  const loadMostRecentSession = async () => {
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.sessions && data.sessions.length > 0) {
          // Load the most recent session
          const mostRecent = data.sessions[0];
          await loadSession(mostRecent.id);
        }
      }
    } catch (error) {
      console.error('Error loading recent session:', error);
    }
  };

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
        setCurrentChatSessionId(sessionId); // Sync with context for trip saving
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
    isNewChatRef.current = true; // Prevent auto-reload
    setMessages([]);
    setCurrentSessionId(null);
    setCurrentChatSessionId(null); // Clear from context
    setShowHistory(false);
    setInput('');
    if (onNewChat) onNewChat();
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
        setCurrentChatSessionId(sessionId); // Sync with context for trip saving
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      // Serialize locations to JSON to preserve coordinates
      const locationsData = selectedLocations.map(loc => ({
        name: loc.name,
        address: loc.address,
        lat: loc.lat || loc.location?.lat,
        lng: loc.lng || loc.location?.lng
      }));
      const locationsString = JSON.stringify(locationsData);

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (showHistory) {
    // Helper to clean message content for preview display
    const getCleanPreview = (message) => {
      if (!message) return 'New Chat';

      // Remove places data markers, handling truncated tags at end of string
      const cleaned = message.replace(/<!--PLACES_DATA:[\s\S]*?(?::PLACES_DATA-->|$)/g, '').trim();

      if (!cleaned) {
        // If cleaned is empty, it means the message was just data (or data was truncated).
        // Try to extract place names from the raw data to show something useful.
        const nameMatch = message.match(/"name":\s*"([^"]+)"/);
        if (nameMatch && nameMatch[1]) {
          return `📍 ${nameMatch[1]}...`;
        }
        return '📍 Location suggestions';
      }

      return cleaned.length > 50 ? cleaned.substring(0, 50) + '...' : cleaned;
    };

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
                  {getCleanPreview(session.lastMessage)}
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
        {messages.map((message, index) => {
          const isAssistant = message.role === 'assistant';
          const { places, textContent } = isAssistant
            ? parseMessageContent(message.content)
            : { places: null, textContent: message.content };

          return (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[85%]">
                {/* Render Location Cards if places exist */}
                {isAssistant && places && places.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-2 font-medium">Suggested Locations:</p>
                    {places.map((place, placeIndex) => (
                      <LocationCard key={placeIndex} place={place} />
                    ))}
                  </div>
                )}

                {/* Render text content */}
                {textContent && (
                  <div
                    className={`rounded-lg px-4 py-2 shadow-sm ${message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                      }`}
                  >
                    <ReactMarkdown className="text-sm prose prose-sm max-w-none">
                      {textContent}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="flex-1 p-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none min-h-[44px] max-h-[120px] overflow-y-auto"
            disabled={isLoading}
            rows={1}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`p-3 rounded-lg font-medium transition-colors shrink-0 ${isLoading || !input.trim()
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">Press Enter to send, Shift+Enter for newline</p>
      </form>
    </div>
  );
}