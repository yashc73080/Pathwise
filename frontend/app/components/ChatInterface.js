'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/authContext';
import { useTrip } from '../context/TripContext';
import { toast } from 'react-hot-toast';
import { getBackendUrl } from '../utils/backendUrl';

export default function ChatInterface({ selectedLocations, onNewChat, onShowHistory, showHistoryProp, setShowHistoryProp, newChatTrigger }) {
  const { currentUser } = useAuth();
  const { setCurrentPlace, setCurrentMarker, currentMarker, map, setChatHeight, setActivePanel, activePanel, currentChatSessionId, setCurrentChatSessionId, addToItinerary, submitItinerary } = useTrip();
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

  // Parse message content to extract structured place data and agent commands
  const parseMessageContent = (content) => {
    const placesMatch = content.match(/<!--PLACES_DATA:(.*?):PLACES_DATA-->/);
    const addLocationsMatch = content.match(/<!--ADD_LOCATIONS:(.*?):ADD_LOCATIONS-->/);
    const optimizeRouteMatch = content.match(/<!--OPTIMIZE_ROUTE:(.*?):OPTIMIZE_ROUTE-->/);

    let places = null;
    let addLocations = null;
    let shouldOptimize = false;
    let textContent = content;

    if (placesMatch) {
      try {
        places = JSON.parse(placesMatch[1]);
        textContent = textContent.replace(/<!--PLACES_DATA:.*?:PLACES_DATA-->/g, '');
      } catch (e) {
        console.error('Error parsing places data:', e);
      }
    }

    if (addLocationsMatch) {
      try {
        addLocations = JSON.parse(addLocationsMatch[1]);
        textContent = textContent.replace(/<!--ADD_LOCATIONS:.*?:ADD_LOCATIONS-->/g, '');
      } catch (e) {
        console.error('Error parsing add locations data:', e);
      }
    }

    if (optimizeRouteMatch) {
      shouldOptimize = optimizeRouteMatch[1] === 'true';
      textContent = textContent.replace(/<!--OPTIMIZE_ROUTE:.*?:OPTIMIZE_ROUTE-->/g, '');
    }

    return { places, addLocations, shouldOptimize, textContent: textContent.trim() };
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
        className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 md:p-3 mb-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{place.name}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{place.address}</p>
            {place.rating && (
              <div className="flex items-center mt-0.5">
                <span className="text-yellow-500 text-xs">★</span>
                <span className="text-xs text-gray-600 dark:text-gray-400 ml-0.5">{place.rating}</span>
              </div>
            )}
          </div>
          {/* Mobile: icon-only buttons side-by-side, Desktop: stacked buttons with text */}
          <div className="flex flex-row md:flex-col gap-1.5 ml-2 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); handleShowOnMap(); }}
              className="p-2 md:px-3 md:py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
              title="Show on map"
            >
              <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden md:inline text-xs font-medium">Show</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAddToItinerary(); }}
              className="p-2 md:px-3 md:py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
              title="Add to itinerary"
            >
              <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden md:inline text-xs font-medium">Add</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Handler to add all suggested places at once
  const handleAddAllLocations = (places) => {
    if (!places || places.length === 0) return;

    let addedCount = 0;
    places.forEach(place => {
      const lat = place.location?.lat || place.lat;
      const lng = place.location?.lng || place.lng;

      if (lat && lng) {
        addToItinerary({
          name: place.name,
          address: place.address,
          lat: lat,
          lng: lng,
          placeId: place.place_id
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      toast.success(`Added ${addedCount} locations to itinerary!`);
      // On mobile, minimize chat to show map
      if (window.innerWidth < 768 && activePanel === 'chat') {
        setChatHeight('partial');
      }
    }
  };

  // Process agent tool commands when messages change
  const processedMessagesRef = useRef(new Set());

  useEffect(() => {
    // Find the latest assistant message with commands
    const latestAssistantIndex = messages.findLastIndex(m => m.role === 'assistant');
    if (latestAssistantIndex < 0) return;

    const latestMessage = messages[latestAssistantIndex];
    const messageKey = `${latestAssistantIndex}-${latestMessage.content.slice(0, 50)}`;

    // Skip if we've already processed this message
    if (processedMessagesRef.current.has(messageKey)) return;

    const { addLocations, shouldOptimize } = parseMessageContent(latestMessage.content);

    // Process add locations command
    if (addLocations && addLocations.length > 0) {
      processedMessagesRef.current.add(messageKey);
      console.log('Agent auto-adding locations:', addLocations.length);
      handleAddAllLocations(addLocations);
    }

    // Process optimize route command
    if (shouldOptimize) {
      processedMessagesRef.current.add(messageKey);
      console.log('Agent triggering route optimization');
      // Small delay to let locations be added first
      setTimeout(() => {
        submitItinerary();
      }, 500);
    }
  }, [messages]);

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

  // Watch for valuable content to trigger sign-in prompt


  const loadMostRecentSession = async () => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${getBackendUrl()}/chat/sessions`, {
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
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${getBackendUrl()}/chat/sessions`, {
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
      const response = await fetch(`${getBackendUrl()}/chat/sessions/${sessionId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Historical messages may still contain agent command markers
        // (ADD_LOCATIONS / OPTIMIZE_ROUTE). Mark them as processed so loading
        // an old session never re-executes commands against the current trip.
        data.messages.forEach((m, i) => {
          if (m.role === 'assistant') {
            processedMessagesRef.current.add(`${i}-${m.content.slice(0, 50)}`);
          }
        });
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

      const backendUrl = getBackendUrl();
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
      <div className="flex flex-col h-full bg-white dark:bg-gray-800">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">Chat History</h3>
          <button
            onClick={() => setShowHistory(false)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">No previous chats found.</div>
          ) : (
            sessions.map(session => (
              <button
                key={session.id}
                onClick={() => loadSession(session.id)}
                className="w-full text-left p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                  {getCleanPreview(session.lastMessage)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(session.timestamp).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
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
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
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
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Suggested Locations:</p>
                    {places.map((place, placeIndex) => (
                      <LocationCard key={placeIndex} place={place} />
                    ))}
                    {/* Add All button - shown when 2+ locations */}
                    {places.length >= 2 && (
                      <button
                        onClick={() => handleAddAllLocations(places)}
                        className="w-full mt-2 py-2 px-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium shadow-sm hover:shadow-md"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add All {places.length} to Itinerary
                      </button>
                    )}
                  </div>
                )}

                {/* Render text content */}
                {textContent && (
                  <div
                    className={`rounded-lg px-4 py-2 shadow-sm ${message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
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
            <div className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none min-h-[44px] max-h-[120px] overflow-y-auto placeholder-gray-400 dark:placeholder-gray-500"
            disabled={isLoading}
            rows={1}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`w-[44px] h-[44px] rounded-lg flex items-center justify-center transition-all duration-200 shrink-0 ${isLoading || !input.trim()
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 active:scale-95'
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-center">Press Enter to send, Shift+Enter for newline</p>
      </form>
    </div>
  );
}