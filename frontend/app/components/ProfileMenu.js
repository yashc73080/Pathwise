'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { doSignOut } from '../firebase/auth';
import toast from 'react-hot-toast';

export default function ProfileMenu() {
    const { currentUser, userLoggedIn, openLoginModal, openSavedTripsModal } = useAuth();
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
        if (!userLoggedIn) return '?';
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
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-md hover:shadow-lg transition-shadow focus:outline-none ring-2 ring-transparent focus:ring-blue-500 overflow-hidden"
            >
                {userLoggedIn && currentUser?.photoURL ? (
                    <img
                        src={currentUser.photoURL}
                        alt="Profile"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className={`w-full h-full flex items-center justify-center text-white font-semibold text-sm ${userLoggedIn ? 'bg-blue-600' : 'bg-gray-400'}`}>
                        {getInitials()}
                    </div>
                )}
            </button>

            {isOpen && userLoggedIn && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-1 border border-gray-100 transform origin-top-right transition-all">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm text-gray-900 font-medium truncate">
                            {currentUser.displayName || 'User'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                            {currentUser.email}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            openSavedTripsModal();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Saved Trips
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
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
