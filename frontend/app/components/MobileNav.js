'use client';

import { useState } from 'react';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';
import { useTheme } from '../context/ThemeContext';
import { doSignOut } from '../firebase/auth';
import toast from 'react-hot-toast';

export default function MobileNav() {
    const {
        activePanel,
        setActivePanel,
        optimizedRoute,
        isSidebarOpen,
        setIsSidebarOpen,
        isChatOpen,
        setIsChatOpen,
        chatHeight,
        sidebarHeight,
        routeHeight,
        clearAllLocations,
        setWeatherData
    } = useTrip();
    const { userLoggedIn, openLoginModal, currentUser, openSavedTripsModal } = useAuth();
    const { resolvedTheme, toggleTheme } = useTheme();
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    // Compact nav whenever any panel is open
    const isFullPanelOpen = activePanel !== 'none';

    const handleTabClick = (panel) => {
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
            setIsProfileModalOpen(true);
        }
    };

    const handleLogout = async () => {
        try {
            await doSignOut();
            toast.success('Logged out successfully');
            setIsProfileModalOpen(false);
            clearAllLocations();
            setWeatherData(null);
        } catch (error) {
            toast.error('Error logging out');
        }
    };

    // Get initials for profile button
    const getInitials = () => {
        if (!userLoggedIn) return null; // Will render user icon instead
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
        <>
            <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 flex items-center gap-2 bg-gradient-to-t from-white dark:from-gray-900 via-white dark:via-gray-900 to-transparent transition-all duration-300 ${isFullPanelOpen ? 'pb-2 pt-1' : 'pb-4 pt-2 gap-3'}`}>
                {/* Floating Profile Button */}
                <button
                    onClick={handleProfileClick}
                    className={`rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105 shrink-0 ${userLoggedIn ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white font-medium' : 'bg-gray-400 dark:bg-gray-600'} ${isFullPanelOpen ? 'w-9 h-9 text-xs' : 'w-12 h-12 text-sm'}`}
                    aria-label="Profile"
                >
                    {userLoggedIn ? (
                        getInitials()
                    ) : (
                        <svg className={`text-white ${isFullPanelOpen ? 'w-5 h-5' : 'w-6 h-6'}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                    )}
                </button>

                {/* Tab Group - fills remaining space */}
                <div className={`flex flex-1 bg-white dark:bg-gray-800 shadow-lg overflow-hidden transition-all duration-300 ${isFullPanelOpen ? 'rounded-xl' : 'rounded-2xl'}`}>
                    {/* Itinerary Tab */}
                    <button
                        onClick={() => handleTabClick('itinerary')}
                        className={`flex-1 flex items-center justify-center gap-1.5 transition-all duration-300 ${isFullPanelOpen ? 'py-2' : 'py-3 flex-col gap-0'} ${activePanel === 'itinerary'
                            ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                            : 'text-gray-500 dark:text-gray-400'
                            }`}
                        aria-label="View itinerary"
                    >
                        <svg className={`transition-all duration-300 ${isFullPanelOpen ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span className={`font-medium transition-all duration-300 ${isFullPanelOpen ? 'text-xs' : 'text-[10px] mt-0.5'}`}>Trip</span>
                    </button>

                    {/* Divider */}
                    <div className={`w-px bg-gray-200 dark:bg-gray-700 transition-all duration-300 ${isFullPanelOpen ? 'my-2' : 'my-2'}`}></div>

                    {/* Route Tab */}
                    <button
                        onClick={() => handleTabClick('route')}
                        className={`flex-1 flex items-center justify-center gap-1.5 transition-all duration-300 ${isFullPanelOpen ? 'py-2' : 'py-3 flex-col gap-0'} ${activePanel === 'route'
                            ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                            : optimizedRoute
                                ? 'text-gray-500 dark:text-gray-400'
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                        aria-label="View optimized route"
                        disabled={!optimizedRoute}
                    >
                        <svg className={`transition-all duration-300 ${isFullPanelOpen ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <span className={`font-medium transition-all duration-300 ${isFullPanelOpen ? 'text-xs' : 'text-[10px] mt-0.5'}`}>Route</span>
                    </button>

                    {/* Divider */}
                    <div className={`w-px bg-gray-200 dark:bg-gray-700 transition-all duration-300 ${isFullPanelOpen ? 'my-2' : 'my-2'}`}></div>

                    {/* AI Chat Tab */}
                    <button
                        onClick={() => handleTabClick('chat')}
                        className={`flex-1 flex items-center justify-center gap-1.5 transition-all duration-300 ${isFullPanelOpen ? 'py-2' : 'py-3 flex-col gap-0'} ${activePanel === 'chat'
                            ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                            : 'text-gray-500 dark:text-gray-400'
                            }`}
                        aria-label="Open AI assistant"
                    >
                        <svg className={`transition-all duration-300 ${isFullPanelOpen ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <span className={`font-medium transition-all duration-300 ${isFullPanelOpen ? 'text-xs' : 'text-[10px] mt-0.5'}`}>AI</span>
                    </button>
                </div>
            </nav>

            {/* Profile Modal for Mobile */}
            {isProfileModalOpen && userLoggedIn && (
                <div
                    className="md:hidden fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setIsProfileModalOpen(false)}
                >
                    <div
                        className="w-full bg-white dark:bg-gray-800 rounded-t-2xl p-4 pb-8 animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Handle */}
                        <div className="flex justify-center mb-4">
                            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                        </div>

                        {/* User Info */}
                        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold">
                                {getInitials()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-gray-900 dark:text-gray-100 font-medium truncate">
                                    {currentUser?.displayName || 'User'}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {currentUser?.email}
                                </p>
                            </div>
                        </div>

                        {/* Dark Mode Toggle */}
                        <div className="flex items-center justify-between py-3 px-2">
                            <span className="text-gray-700 dark:text-gray-300 flex items-center gap-3">
                                {resolvedTheme === 'dark' ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                )}
                                Dark Mode
                            </span>
                            <button
                                onClick={toggleTheme}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${resolvedTheme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${resolvedTheme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Saved Trips Button */}
                        <button
                            onClick={() => {
                                setIsProfileModalOpen(false);
                                openSavedTripsModal();
                            }}
                            className="w-full flex items-center gap-3 py-3 px-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            Saved Trips
                        </button>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 py-3 px-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

