'use client';

import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';
import { useDraggablePanel } from '../hooks/useDraggablePanel';
import { useState } from 'react';
import ChatInterface from './ChatInterface';

export default function ChatWidget() {
    const { isChatOpen, setIsChatOpen, selectedLocations, activePanel, setActivePanel, chatHeight, setChatHeight, optimizedRoute } = useTrip();
    const { userLoggedIn, openLoginModal } = useAuth();

    // State for controlling ChatInterface history view from mobile header
    const [mobileShowHistory, setMobileShowHistory] = useState(false);
    // Trigger to start new chat (increment to trigger)
    const [newChatTrigger, setNewChatTrigger] = useState(0);

    const toggleChat = () => {
        if (!userLoggedIn) {
            openLoginModal();
            return;
        }
        setIsChatOpen(!isChatOpen);
        // Sync mobile panel state
        setActivePanel(isChatOpen ? 'none' : 'chat');
        setChatHeight('full');
    };

    // State for controlling ChatInterface history view from desktop header
    const [desktopShowHistory, setDesktopShowHistory] = useState(false);

    // Determine visibility: on mobile, use activePanel; on desktop, use isChatOpen
    const isMobileVisible = activePanel === 'chat';

    // Draggable panel hook
    const { panelRef, handleDragStart } = useDraggablePanel({
        initialHeight: chatHeight,
        onHeightChange: (newHeight) => {
            setChatHeight(newHeight);
            // If dragging to minimize, we don't close, just minimize
            // logic is handled by state
        }
    });

    // Get height class based on chatHeight state
    const getMobileHeightClass = () => {
        switch (chatHeight) {
            case 'minimized':
                return 'h-24';
            case 'partial':
                return 'h-[40vh]';
            case 'full':
            default:
                return 'h-[85vh]';
        }
    };

    if (!userLoggedIn) {
        return (
            <div className="hidden md:flex absolute bottom-4 right-4 flex-col items-end z-10">
                <button
                    onClick={openLoginModal}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg shadow-lg hover:bg-gray-700 flex items-center gap-2 transition-all duration-200 hover:scale-105"
                    aria-label="Login to access AI chat"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="font-medium">Login to Chat</span>
                </button>
            </div>
        );
    }

    return (
        <>
            {/* Mobile: Partial-height chat panel with drag handle */}
            <div
                ref={panelRef}
                className={`
                md:hidden fixed left-0 right-0 bottom-[72px] z-40 bg-white rounded-t-2xl shadow-xl flex flex-col
                transition-all duration-300 ease-in-out
                ${isMobileVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}
                ${getMobileHeightClass()}
            `}>
                {/* Drag Handle */}
                <div
                    className="flex justify-center py-5 cursor-grab active:cursor-grabbing touch-none w-full"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                >
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full hover:bg-gray-400 transition-colors"></div>
                </div>

                <div className="px-4 pb-2 flex justify-between items-center border-b">
                    <h2 className="font-semibold text-gray-900">Pathwise AI</h2>
                    <div className="flex gap-1">
                        {/* New Chat button */}
                        <button
                            onClick={() => {
                                setMobileShowHistory(false);
                                setNewChatTrigger(prev => prev + 1);
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                            aria-label="New chat"
                            title="New chat"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        {/* History button */}
                        <button
                            onClick={() => setMobileShowHistory(true)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                            aria-label="Chat history"
                            title="Chat history"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                        {chatHeight !== 'full' && (
                            <button
                                onClick={() => setChatHeight('full')}
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                                aria-label="Expand chat"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setIsChatOpen(false);
                                setActivePanel('none');
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                            aria-label="Close chat"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden">
                    {chatHeight !== 'minimized' ? (
                        <ChatInterface
                            selectedLocations={selectedLocations}
                            showHistoryProp={mobileShowHistory}
                            setShowHistoryProp={setMobileShowHistory}
                            newChatTrigger={newChatTrigger}
                        />
                    ) : (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            Drag up to continue chatting
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop: Floating chat widget */}
            <div className="hidden md:flex absolute bottom-4 right-4 flex-col items-end z-10">
                {isChatOpen && (
                    <div className="mb-4 bg-white shadow-xl rounded-lg w-96 overflow-hidden">
                        <div className="h-[600px] flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-lg">
                                <h2 className="font-semibold text-white">Pathwise AI</h2>
                                <div className="flex gap-1">
                                    {/* New Chat button */}
                                    <button
                                        onClick={() => {
                                            setDesktopShowHistory(false);
                                            setNewChatTrigger(prev => prev + 1);
                                        }}
                                        className="p-1.5 hover:bg-blue-800 rounded text-white"
                                        aria-label="New chat"
                                        title="New chat"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                    {/* History button */}
                                    <button
                                        onClick={() => setDesktopShowHistory(true)}
                                        className="p-1.5 hover:bg-blue-800 rounded text-white"
                                        aria-label="Chat history"
                                        title="Chat history"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => setIsChatOpen(false)}
                                        className="p-1.5 hover:bg-blue-800 rounded transition-colors text-white"
                                        aria-label="Close chat"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <ChatInterface
                                    selectedLocations={selectedLocations}
                                    showHistoryProp={desktopShowHistory}
                                    setShowHistoryProp={setDesktopShowHistory}
                                    newChatTrigger={newChatTrigger}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <button
                    onClick={toggleChat}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 transition-all duration-200 hover:scale-105"
                    aria-label={isChatOpen ? 'Close AI chat' : 'Open AI chat'}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="font-medium">Pathwise AI</span>
                </button>
            </div>
        </>
    );
}
