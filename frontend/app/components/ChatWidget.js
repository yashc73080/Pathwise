'use client';

import { useTrip } from '../context/TripContext';
import ChatInterface from './ChatInterface';

export default function ChatWidget() {
    const { isChatOpen, setIsChatOpen, selectedLocations } = useTrip();

    return (
        <div className="absolute bottom-4 right-4 flex flex-col items-end z-10">
            {isChatOpen && (
                <div className="mb-4 w-88 bg-white rounded-lg shadow-lg">
                    <div className="h-96 flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="font-semibold text-gray-900">TripWhiz AI Assistant</h2>
                            <button
                                onClick={() => setIsChatOpen(false)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 p-4 overflow-hidden">
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
                <span className="font-medium">TripWhiz AI</span>
            </button>
        </div>
    );
}
