'use client';

import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';
import ChatInterface from './ChatInterface';

export default function ChatWidget() {
    const { isChatOpen, setIsChatOpen, selectedLocations, activePanel, setActivePanel, chatHeight, setChatHeight, optimizedRoute } = useTrip();
    const { userLoggedIn, openLoginModal } = useAuth();

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

    // Determine visibility: on mobile, use activePanel; on desktop, use isChatOpen
    const isMobileVisible = activePanel === 'chat';

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

    const handleDragStart = (e) => {
        e.preventDefault();
        const startY = e.touches ? e.touches[0].clientY : e.clientY;
        const container = e.currentTarget.parentElement;
        const startHeight = container.offsetHeight;

        const handleMove = (moveEvent) => {
            const currentY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
            const deltaY = startY - currentY;
            const newHeight = startHeight + deltaY;
            const viewportHeight = window.innerHeight;
            const heightPercent = (newHeight / viewportHeight) * 100;

            if (heightPercent > 70) {
                setChatHeight('full');
            } else if (heightPercent > 30) {
                setChatHeight('partial');
            } else {
                setChatHeight('minimized');
            }
        };

        const handleEnd = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleEnd);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleMove);
        document.addEventListener('touchend', handleEnd);
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
            <div className={`
                md:hidden fixed left-0 right-0 bottom-16 z-40 bg-white rounded-t-2xl shadow-xl flex flex-col
                transition-all duration-300 ease-in-out
                ${isMobileVisible ? 'translate-y-0' : 'translate-y-full'}
                ${getMobileHeightClass()}
            `}>
                {/* Drag Handle */}
                <div
                    className="flex justify-center py-2 cursor-grab active:cursor-grabbing touch-none"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                >
                    <div className="w-10 h-1.5 bg-gray-300 rounded-full hover:bg-gray-400 transition-colors"></div>
                </div>

                <div className="px-4 pb-2 flex justify-between items-center border-b">
                    <h2 className="font-semibold text-gray-900">Pathwise AI</h2>
                    <div className="flex gap-2">
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
                        <ChatInterface selectedLocations={selectedLocations} />
                    ) : (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            Drag up to continue chatting
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop: Floating chat widget */}
            <div className={`hidden md:flex absolute bottom-4 flex-col items-end z-10 ${optimizedRoute ? 'right-[340px]' : 'right-4'}`}>
                {isChatOpen && (
                    <div className="mb-4 bg-white shadow-xl rounded-lg w-96 overflow-hidden">
                        <div className={`${optimizedRoute ? 'h-[400px]' : 'h-[500px]'} flex flex-col`}>
                            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-lg">
                                <h2 className="font-semibold text-white">Pathwise AI Assistant</h2>
                                <button
                                    onClick={() => setIsChatOpen(false)}
                                    className="p-1 hover:bg-blue-800 rounded transition-colors text-white"
                                    aria-label="Close chat"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <ChatInterface selectedLocations={selectedLocations} />
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
