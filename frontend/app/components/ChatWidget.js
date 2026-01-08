'use client';

import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';
import ChatInterface from './ChatInterface';

export default function ChatWidget() {
    const { isChatOpen, setIsChatOpen, selectedLocations } = useTrip();
    const { userLoggedIn, openLoginModal } = useAuth();

    const toggleChat = () => {
        if (!userLoggedIn) {
            openLoginModal();
            return;
        }
        setIsChatOpen(!isChatOpen);
    };

    if (!userLoggedIn) {
        return (
            <div className="absolute bottom-4 right-4 flex flex-col items-end z-10">
                <button
                    onClick={openLoginModal}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg shadow-lg hover:bg-gray-700 flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="font-medium">Login to Chat</span>
                </button>
            </div>
        )
    }

    return (
        <div className="absolute bottom-4 right-4 flex flex-col items-end z-10">
            {isChatOpen && (
                <div className="mb-4 w-96 bg-white rounded-lg shadow-lg">
                    <div className="h-[500px] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-blue-600 rounded-t-lg">
                            <h2 className="font-semibold text-white">Pathwise AI Assistant</h2>
                            <button
                                onClick={() => setIsChatOpen(false)}
                                className="p-1 hover:bg-blue-700 rounded text-white"
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
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 flex items-center gap-2"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="font-medium">Pathwise AI</span>
            </button>
        </div>
    );
}
