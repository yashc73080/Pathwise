'use client';

import { useTrip } from '../context/TripContext';
import { useEffect } from 'react';

export default function RoutePanel() {
    const { optimizedRoute, selectedLocations, optimizedCoords, exportToGoogleMaps } = useTrip();

    // Logging
    useEffect(() => {
        if (optimizedRoute) {
            console.log('Selected Locations:', selectedLocations);
            console.log('Optimized Route in RoutePanel:', optimizedRoute);
            console.log('Optimized Coordinates in RoutePanel:', optimizedCoords);
        }
    }, [optimizedRoute]);

    if (!optimizedRoute) return null;

    return (
        <div className="absolute top-20 right-4 w-80 bg-white rounded-lg shadow-lg z-10">
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Optimized Route</h3>
                    <button
                        onClick={exportToGoogleMaps}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                        Export to Maps
                    </button>
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
