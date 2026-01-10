'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { useTheme } from '../context/ThemeContext';
import { doSignOut } from '../firebase/auth';
import toast from 'react-hot-toast';
import { useTrip } from '../context/TripContext';

export default function ProfileMenu() {
    const { clearAllLocations, setWeatherData } = useTrip();
    const { currentUser, userLoggedIn, openLoginModal, openSavedTripsModal } = useAuth();
    const { resolvedTheme, toggleTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = async () => {
        try {
            await doSignOut();
            toast.success('Logged out successfully');
            setIsOpen(false);
            clearAllLocations();
            setWeatherData(null);
        } catch (error) {
            toast.error('Error logging out');
        }
    };

    const handleProfileClick = () => {
        if (!userLoggedIn) {
            openLoginModal();
        } else {
            setIsOpen(!isOpen);
        }
    };

    // Get initials if no photoURL
    const getInitials = () => {
        if (!userLoggedIn) return null; // Will render user icon instead
        if (currentUser && currentUser.displayName) {
            return currentUser.displayName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        }
        return currentUser && currentUser.email ? currentUser.email[0].toUpperCase() : 'U';
    };

    return (
        <div className="absolute top-4 right-4 md:top-4 md:right-4 z-20 hidden md:block" ref={menuRef}>
            <button
                onClick={handleProfileClick}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow focus:outline-none ring-2 ring-transparent focus:ring-blue-500 overflow-hidden"
            >
                {userLoggedIn && currentUser?.photoURL ? (
                    <img
                        src={currentUser.photoURL}
                        alt="Profile"
                        className="w-full h-full object-cover"
                    />
                ) : userLoggedIn ? (
                    <div className="w-full h-full flex items-center justify-center text-white font-semibold text-sm bg-blue-600">
                        {getInitials()}
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-400 dark:bg-gray-600">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                    </div>
                )}
            </button>

            {isOpen && userLoggedIn && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl py-1 border border-gray-100 dark:border-gray-700 transform origin-top-right transition-all">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">
                            {currentUser.displayName || 'User'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {currentUser.email}
                        </p>
                    </div>

                    {/* Dark Mode Toggle */}
                    <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            {resolvedTheme === 'dark' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            )}
                            Dark Mode
                        </span>
                        <button
                            onClick={toggleTheme}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${resolvedTheme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${resolvedTheme === 'dark' ? 'translate-x-4' : 'translate-x-0.5'
                                    }`}
                            />
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            setIsOpen(false);
                            openSavedTripsModal();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Saved Trips
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}

