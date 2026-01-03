'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { doSignOut } from '../firebase/auth';
import toast from 'react-hot-toast';

export default function ProfileMenu() {
    const { currentUser, userLoggedIn } = useAuth();
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

    if (!userLoggedIn || !currentUser) return null;

    // Get initials if no photoURL
    const getInitials = () => {
        if (currentUser.displayName) {
            return currentUser.displayName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        }
        return currentUser.email ? currentUser.email[0].toUpperCase() : 'U';
    };

    return (
        <div className="absolute top-4 right-4 z-20" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-md hover:shadow-lg transition-shadow focus:outline-none ring-2 ring-transparent focus:ring-blue-500 overflow-hidden"
            >
                {currentUser.photoURL ? (
                    <img
                        src={currentUser.photoURL}
                        alt="Profile"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                        {getInitials()}
                    </div>
                )}
            </button>

            {isOpen && (
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
