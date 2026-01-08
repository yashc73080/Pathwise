'use client';

import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/authContext';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { addTrip, updateTripName } from '../firebase/firestore';

export default function RoutePanel() {
    const { optimizedRoute, selectedLocations, optimizedCoords, exportToGoogleMaps, startIndex, endIndex, activePanel, setActivePanel } = useTrip();
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

    const handleClose = () => {
        setActivePanel('none');
    };

    // Determine visibility based on mobile (activePanel) or desktop (optimizedRoute exists)
    const isMobileVisible = activePanel === 'route';

    // Empty state component
    const EmptyState = () => (
        <div className="p-6 flex flex-col items-center justify-center text-center">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h3 className="font-medium text-gray-700 mb-2">No Route Yet</h3>
            <p className="text-sm text-gray-500">Add locations and click "Optimize Route" to see your optimized path here.</p>
        </div>
    );

    // Route list component
    const RouteList = () => (
        <div className="space-y-2">
            {optimizedCoords.map((location, i) => (
                <div key={i} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <span className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full flex items-center justify-center text-sm font-medium shadow-sm">
                        {i + 1}
                    </span>
                    <span className="text-gray-700 flex-1 truncate">{location.name}</span>
                </div>
            ))}
        </div>
    );

    return (
        <>
            {/* Mobile only: Bottom sheet panel - Desktop uses Sidebar tabs */}
            <div
                className={`
                    md:hidden fixed z-40 bg-white shadow-xl flex flex-col
                    inset-x-0 bottom-0 max-h-[60vh] rounded-t-2xl
                    transition-transform duration-300 ease-in-out
                    ${isMobileVisible ? 'translate-y-0' : 'translate-y-full'}
                `}
                style={{ paddingBottom: '4rem' }}
            >
                {/* Handle indicator */}
                <div className="flex justify-center pt-2 pb-1">
                    <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
                </div>

                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">Optimized Route</h3>
                    <div className="flex gap-2">
                        {optimizedRoute && (
                            <>
                                <button
                                    onClick={handleSaveTrip}
                                    disabled={isSaving}
                                    className={`p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all duration-200 ${isSaving ? 'opacity-75 cursor-not-allowed' : ''}`}
                                    title="Save Trip"
                                    aria-label="Save trip"
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
                                    className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                    title="Export to Google Maps"
                                    aria-label="Export to Google Maps"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </button>
                            </>
                        )}
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="Close route panel"
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {optimizedRoute ? <RouteList /> : <EmptyState />}
                </div>
            </div>
            {/* Desktop RoutePanel removed - now integrated into Sidebar tabs */}
        </>
    );
}
