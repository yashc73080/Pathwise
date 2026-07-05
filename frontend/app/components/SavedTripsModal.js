'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { useTrip } from '../context/TripContext';
import { getUserTrips, deleteTrip, setTripVisibility } from '../firebase/firestore';
import { doSignOut } from '../firebase/auth';
import toast from 'react-hot-toast';
import { getOrderedStops } from '../utils/tripModel';
import { copyToClipboard, getShareUrl } from '../utils/share';

export default function SavedTripsModal() {
    const { currentUser, isSavedTripsModalOpen, closeSavedTripsModal } = useAuth();
    const { loadTrip } = useTrip();

    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTrips = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const userTrips = await getUserTrips(currentUser);
            setTrips(userTrips);
        } catch (error) {
            toast.error('Failed to fetch saved trips');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSavedTripsModalOpen) {
            fetchTrips();
        }
    }, [isSavedTripsModalOpen, currentUser]);

    const handleLoadTrip = (trip) => {
        loadTrip(trip);
        closeSavedTripsModal();
    };

    const handleDeleteTrip = async (tripId, e) => {
        e.stopPropagation(); // Prevent loading the trip when trying to delete
        // if (!window.confirm('Are you sure you want to delete this trip?')) return;

        try {
            await deleteTrip(currentUser, tripId);
            toast.success('Trip deleted');
            fetchTrips(); // Refresh list
        } catch (error) {
            toast.error('Failed to delete trip');
        }
    };

    const handleShare = async (trip, e) => {
        e.stopPropagation();
        try {
            if (trip.visibility !== 'link') {
                await setTripVisibility(currentUser, trip.id, 'link');
                setTrips(prev => prev.map(existing =>
                    existing.id === trip.id ? { ...existing, visibility: 'link' } : existing
                ));
            }
            await copyToClipboard(getShareUrl(trip.id));
            toast.success('Share link copied!');
        } catch (error) {
            toast.error('Failed to create share link');
        }
    };

    const handleExport = (trip, e) => {
        e.stopPropagation();

        // Construct Google Maps URL based on trip data
        // Similar to TripContext exportToGoogleMaps
        const day = trip.days?.find(candidate => candidate.route?.order?.length) || trip.days?.[0];
        if (!day || day.stops.length < 2) return;

        const optimizedCoords = getOrderedStops(day);
        const baseUrl = "https://www.google.com/maps/dir/";
        const waypoints = optimizedCoords
            .map(loc => loc.address ? encodeURIComponent(`${loc.name}, ${loc.address}`) : `${loc.lat},${loc.lng}`)
            .join('/');

        const googleMapsUrl = `${baseUrl}${waypoints}`;
        window.open(googleMapsUrl, '_blank');
    };

    const handleLogout = async () => {
        try {
            await doSignOut();
            toast.success('Logged out successfully');
            closeSavedTripsModal();
        } catch (error) {
            toast.error('Error logging out');
        }
    };

    if (!isSavedTripsModalOpen) return null;

    return (
        <div onClick={closeSavedTripsModal} className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 md:pb-4 bg-black bg-opacity-50 backdrop-blur-sm cursor-pointer">
            <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl h-[70vh] md:h-[80vh] flex flex-col overflow-hidden cursor-default">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Saved Trips</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleLogout}
                            className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign out
                        </button>
                        <button
                            onClick={closeSavedTripsModal}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : trips.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <p className="text-lg">No saved trips yet</p>
                            <p className="text-sm">Create and optimize a route to save it here</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {trips.map((trip, index) => (
                                <div
                                    key={trip.id}
                                    onClick={() => handleLoadTrip(trip)}
                                    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all cursor-pointer group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{trip.title || trip.name || `Trip ${trips.length - index}`}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {trip.createdAt?.seconds
                                                    ? `${new Date(trip.createdAt.seconds * 1000).toLocaleDateString()} at ${new Date(trip.createdAt.seconds * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                                                    : 'Just now'}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => handleShare(trip, e)}
                                                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                title="Copy share link"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => handleExport(trip, e)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                title="Open in Google Maps"
                                            >
                                                <svg className="w-5 h-5" viewBox="0 0 92.3 132.3">
                                                    <path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z" />
                                                    <path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z" />
                                                    <path fill="#4285f4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3" />
                                                    <path fill="#fbbc04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3" />
                                                    <path fill="#34a853" d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.4 14.5 6.8 23.1 12.8 23.1s3.4-8.7 12.8-23.2" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteTrip(trip.id, e)}
                                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                title="Delete Trip"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                        {(() => {
                                            const days = (trip.days || []).filter(day => day.stops?.length);
                                            const maxDaysShown = 3;
                                            const maxStopsPerDay = 3;
                                            const shownDays = days.slice(0, maxDaysShown);
                                            const extraDays = days.length - shownDays.length;

                                            return (
                                                <>
                                                    {shownDays.map((day, dayIdx) => {
                                                        const stops = getOrderedStops(day);
                                                        const shownStops = stops.slice(0, maxStopsPerDay);
                                                        const extraStops = stops.length - shownStops.length;
                                                        return (
                                                            <div key={day.id || dayIdx} className="flex flex-wrap items-center gap-1">
                                                                {days.length > 1 && (
                                                                    <span className="font-medium text-gray-500 dark:text-gray-400 mr-1">
                                                                        Day {dayIdx + 1}:
                                                                    </span>
                                                                )}
                                                                {shownStops.map((loc, i) => (
                                                                    <span key={loc.id || i} className="flex items-center">
                                                                        {loc.name}
                                                                        {i < shownStops.length - 1 && (
                                                                            <svg className="w-4 h-4 mx-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                            </svg>
                                                                        )}
                                                                    </span>
                                                                ))}
                                                                {extraStops > 0 && (
                                                                    <span className="text-gray-400">+{extraStops} more</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {extraDays > 0 && (
                                                        <div className="text-gray-400">+{extraDays} more day{extraDays > 1 ? 's' : ''}</div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
