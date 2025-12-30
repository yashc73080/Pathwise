'use client';

import { useTrip } from '../context/TripContext';

export default function RoutePanel() {
    const { optimizedRoute, selectedLocations } = useTrip();

    if (!optimizedRoute) return null;

    return (
        <div className="absolute top-20 right-4 w-80 bg-white rounded-lg shadow-lg z-10">
            <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Optimized Route</h3>
                <div className="space-y-2">
                    {optimizedRoute.map((index, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                                {i + 1}
                            </span>
                            <span className="text-gray-700">{selectedLocations[index]?.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
