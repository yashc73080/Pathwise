'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { useTrip } from '../context/TripContext';
import { getUserTrips, deleteTrip } from '../firebase/firestore';
import { doSignOut } from '../firebase/auth';
import toast from 'react-hot-toast';

export default function SavedTripsModal() {
    const { currentUser, isSavedTripsModalOpen, closeSavedTripsModal } = useAuth();
    const { loadTrip } = useTrip();

    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTrips = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const userTrips = await getUserTrips(currentUser.uid);
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
            await deleteTrip(tripId);
            toast.success('Trip deleted');
            fetchTrips(); // Refresh list
        } catch (error) {
            toast.error('Failed to delete trip');
        }
    };

    const handleExport = (trip, e) => {
        e.stopPropagation();

        // Construct Google Maps URL based on trip data
        // Similar to TripContext exportToGoogleMaps
        if (!trip.optimizedRoute || !trip.locations) return;

        const optimizedCoords = trip.optimizedRoute.map(index => trip.locations[index]);
        const baseUrl = "https://www.google.com/maps/dir/";
        const waypoints = optimizedCoords
            .map(loc => `${loc.lat},${loc.lng}`)
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 md:pb-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl h-[70vh] md:h-[80vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900">Saved Trips</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleLogout}
                            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign out
                        </button>
                        <button
                            onClick={closeSavedTripsModal}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : trips.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 text-lg">{trip.name || `Trip ${trips.length - index}`}</h3>
                                            <p className="text-xs text-gray-500">
                                                {trip.createdAt?.seconds ? new Date(trip.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => handleExport(trip, e)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Export to Maps"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteTrip(trip.id, e)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete Trip"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                                        {trip.optimizedRoute.map((locIndex, i) => (
                                            <span key={i} className="flex items-center">
                                                {trip.locations[locIndex].name}
                                                {i < trip.optimizedRoute.length - 1 && (
                                                    <svg className="w-4 h-4 mx-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                )}
                                            </span>
                                        ))}
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
