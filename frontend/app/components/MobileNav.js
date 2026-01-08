'use client';

import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';

export default function MobileNav() {
    const { activePanel, setActivePanel, optimizedRoute, isSidebarOpen, setIsSidebarOpen, isChatOpen, setIsChatOpen } = useTrip();
    const { userLoggedIn, openLoginModal, currentUser, openSavedTripsModal } = useAuth();

    const handleTabClick = (panel) => {
        if (panel === 'chat' && !userLoggedIn) {
            openLoginModal();
            return;
        }

        // Toggle panel off if already active, otherwise switch to it
        if (activePanel === panel) {
            setActivePanel('none');
            if (panel === 'itinerary') setIsSidebarOpen(false);
            if (panel === 'chat') setIsChatOpen(false);
        } else {
            setActivePanel(panel);
            // Sync with existing state management
            if (panel === 'itinerary') {
                setIsSidebarOpen(true);
                setIsChatOpen(false);
            } else if (panel === 'chat') {
                setIsChatOpen(true);
                setIsSidebarOpen(false);
            } else if (panel === 'route') {
                setIsSidebarOpen(false);
                setIsChatOpen(false);
            }
        }
    };

    const handleProfileClick = () => {
        if (!userLoggedIn) {
            openLoginModal();
        } else {
            openSavedTripsModal();
        }
    };

    // Get initials for profile button
    const getInitials = () => {
        if (!userLoggedIn) return '?';
        if (currentUser?.displayName) {
            return currentUser.displayName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        }
        return currentUser?.email ? currentUser.email[0].toUpperCase() : 'U';
    };

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
            <div className="flex justify-around items-center h-16">
                {/* Profile Tab */}
                <button
                    onClick={handleProfileClick}
                    className={`flex flex-col items-center justify-center flex-1 h-full transition-colors text-gray-500 hover:text-gray-700`}
                    aria-label="Profile"
                >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium ${userLoggedIn ? 'bg-blue-600' : 'bg-gray-400'}`}>
                        {getInitials()}
                    </div>
                    <span className="text-xs mt-1 font-medium">Profile</span>
                </button>

                {/* Itinerary Tab */}
                <button
                    onClick={() => handleTabClick('itinerary')}
                    className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${activePanel === 'itinerary'
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    aria-label="View itinerary"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="text-xs mt-1 font-medium">Itinerary</span>
                </button>

                {/* Route Tab */}
                <button
                    onClick={() => handleTabClick('route')}
                    className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${activePanel === 'route'
                        ? 'text-blue-600 bg-blue-50'
                        : optimizedRoute
                            ? 'text-gray-500 hover:text-gray-700'
                            : 'text-gray-300'
                        }`}
                    aria-label="View optimized route"
                    disabled={!optimizedRoute}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span className="text-xs mt-1 font-medium">Route</span>
                </button>

                {/* AI Chat Tab */}
                <button
                    onClick={() => handleTabClick('chat')}
                    className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${activePanel === 'chat'
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    aria-label="Open AI assistant"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="text-xs mt-1 font-medium">AI Chat</span>
                </button>
            </div>
        </nav>
    );
}
