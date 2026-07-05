'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/authContext';
import { useTrip } from '../context/TripContext';
import { addTrip, setTripVisibility } from '../firebase/firestore';
import { copyToClipboard, getShareUrl } from '../utils/share';

const shareIcon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
);

// Copies a share link for the current trip, saving it first if it has never
// been persisted and flipping visibility to "link" if it is private.
export default function ShareTripButton({ variant = 'icon' }) {
    const { currentUser, userLoggedIn, openLoginModal } = useAuth();
    const { trip, setTrip, serializeCurrentTrip, markTripSaved } = useTrip();
    const [isSharing, setIsSharing] = useState(false);

    const handleShare = async () => {
        if (!userLoggedIn) {
            openLoginModal();
            return;
        }

        setIsSharing(true);
        try {
            let tripId = trip.id;
            if (!tripId) {
                tripId = await addTrip(currentUser, serializeCurrentTrip());
                markTripSaved(tripId);
            }

            if (trip.visibility !== 'link') {
                await setTripVisibility(currentUser, tripId, 'link');
                setTrip(prev => ({ ...prev, visibility: 'link' }));
            }

            await copyToClipboard(getShareUrl(tripId));
            toast.success('Share link copied!');
        } catch (error) {
            console.error('Failed to create share link:', error);
            toast.error('Failed to create share link');
        } finally {
            setIsSharing(false);
        }
    };

    if (variant === 'block') {
        return (
            <button
                onClick={handleShare}
                disabled={isSharing}
                className={`flex-1 py-2.5 px-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${isSharing ? 'opacity-75 cursor-not-allowed' : ''}`}
                title="Copy share link"
            >
                {isSharing ? (
                    <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                ) : shareIcon}
                Share
            </button>
        );
    }

    return (
        <button
            onClick={handleShare}
            disabled={isSharing}
            className={`p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-200 ${isSharing ? 'opacity-75 cursor-not-allowed' : ''}`}
            title="Copy share link"
            aria-label="Copy share link"
        >
            {isSharing ? (
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            ) : shareIcon}
        </button>
    );
}
