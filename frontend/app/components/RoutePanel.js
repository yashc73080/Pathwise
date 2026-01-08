'use client';

import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { addTrip, updateTripName } from '../firebase/firestore';

export default function RoutePanel() {
    const { optimizedRoute, selectedLocations, optimizedCoords, exportToGoogleMaps, startIndex, endIndex } = useTrip();
    const { userLoggedIn, currentUser, openLoginModal } = useAuth();
    const [isSaving, setIsSaving] = useState(false);

    // Logging
    useEffect(() => {
        if (optimizedRoute) {
            console.log('Selected Locations:', selectedLocations);
            console.log('Optimized Route in RoutePanel:', optimizedRoute);
            console.log('Optimized Coordinates in RoutePanel:', optimizedCoords);
        }
    }, [optimizedRoute]);

    const handleSaveTrip = async () => {
        if (!userLoggedIn) {
            openLoginModal();
            return;
        }

        setIsSaving(true);
        try {
            // Prepare trip data with null name (AI will generate it in background)
            const tripData = {
                name: null,
                locations: selectedLocations.map(loc => ({
                    name: loc.name,
                    lat: loc.lat,
                    lng: loc.lng,
                    address: loc.address || ''
                })),
                optimizedRoute,
                startIndex,
                endIndex
            };

            const tripId = await addTrip(currentUser.uid, tripData);
            toast.success('Trip saved successfully!');

            // Generate AI name in background (non-blocking)
            fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/generate-trip-name`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locations: tripData.locations })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.name && data.name !== 'My Trip') {
                        updateTripName(tripId, data.name);
                    }
                })
                .catch(err => console.error('Background name generation failed:', err));

        } catch (error) {
            toast.error('Failed to save trip');
        } finally {
            setIsSaving(false);
        }
    };

    if (!optimizedRoute) return null;

    return (
        <div className="absolute top-20 right-4 w-80 bg-white rounded-lg shadow-lg z-10">
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Optimized Route</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveTrip}
                            disabled={isSaving}
                            className={`p-2 text-green-600 hover:text-green-700 hover:bg-gray-100 rounded transition-colors ${isSaving ? 'opacity-75 cursor-not-allowed' : ''}`}
                            title="Save Trip"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                            )}
                        </button>
                        <button
                            onClick={exportToGoogleMaps}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-gray-100 rounded transition-colors"
                            title="Export to Google Maps"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="space-y-2">
                    {optimizedCoords.map((location, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                                {i + 1}
                            </span>
                            <span className="text-gray-700">{location.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
