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
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-4 pt-2 px-3 flex items-center gap-3 bg-gradient-to-t from-white via-white to-transparent">
            {/* Floating Profile Button */}
            <button
                onClick={handleProfileClick}
                className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white text-sm font-medium transition-all duration-200 hover:scale-105 shrink-0 ${userLoggedIn ? 'bg-gradient-to-br from-blue-500 to-blue-700' : 'bg-gray-400'}`}
                aria-label="Profile"
            >
                {getInitials()}
            </button>

            {/* Tab Group - fills remaining space */}
            <div className="flex flex-1 bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Itinerary Tab */}
                <button
                    onClick={() => handleTabClick('itinerary')}
                    className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${activePanel === 'itinerary'
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-500'
                        }`}
                    aria-label="View itinerary"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="text-[10px] mt-0.5 font-medium">Trip</span>
                </button>

                {/* Divider */}
                <div className="w-px bg-gray-200 my-2"></div>

                {/* Route Tab */}
                <button
                    onClick={() => handleTabClick('route')}
                    className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${activePanel === 'route'
                        ? 'text-blue-600 bg-blue-50'
                        : optimizedRoute
                            ? 'text-gray-500'
                            : 'text-gray-300'
                        }`}
                    aria-label="View optimized route"
                    disabled={!optimizedRoute}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span className="text-[10px] mt-0.5 font-medium">Route</span>
                </button>

                {/* Divider */}
                <div className="w-px bg-gray-200 my-2"></div>

                {/* AI Chat Tab */}
                <button
                    onClick={() => handleTabClick('chat')}
                    className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${activePanel === 'chat'
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-500'
                        }`}
                    aria-label="Open AI assistant"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="text-[10px] mt-0.5 font-medium">AI</span>
                </button>
            </div>
        </nav>
    );
}
