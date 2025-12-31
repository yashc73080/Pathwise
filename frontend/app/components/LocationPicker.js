'use client';

import { useState } from 'react';
import { useTrip } from '../context/TripContext';

export default function LocationPicker() {
    const { map, mapLoaded, isLocationSelected, setIsLocationSelected } = useTrip();
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (isLocationSelected) return null;

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!input.trim() || !map || !mapLoaded) return;

        setIsLoading(true);
        setError('');

        const geocoder = new window.google.maps.Geocoder();

        geocoder.geocode({ address: input }, (results, status) => {
            setIsLoading(false);
            if (status === 'OK' && results[0]) {
                const { geometry } = results[0];

                if (geometry.viewport) {
                    map.fitBounds(geometry.viewport);
                    const listener = window.google.maps.event.addListenerOnce(map, 'idle', () => {
                        map.setZoom(map.getZoom() + 2);
                    });
                } else {
                    map.setCenter(geometry.location);
                    map.setZoom(14);
                }

                setIsLocationSelected(true);
            } else {
                setError('Could not find that location. Please try again.');
            }
        });
    };

    const handleCurrentLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.');
            return;
        }

        setIsLoading(true);
        setError('');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };

                if (map) {
                    map.setCenter(pos);
                    map.setZoom(16);
                    setIsLocationSelected(true);
                }
                setIsLoading(false);
            },
            () => {
                setError('Unable to retrieve your location.');
                setIsLoading(false);
            }
        );
    };

    // If map isn't loaded yet, we can show a loading state or just the modal waiting
    if (!mapLoaded) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
                <div className="text-white text-xl font-medium animate-pulse">Loading Map...</div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-md transition-all duration-500">
            <div className="w-full max-w-md p-8 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl transform transition-all scale-100 border border-white/20">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Explore the World</h2>
                    <p className="text-gray-500">Where would you like to start your journey?</p>
                </div>

                <form onSubmit={handleSearch} className="space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="e.g. Paris, Tokyo, New York"
                            className="w-full px-5 py-4 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm text-lg"
                            autoFocus
                        />
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg flex justify-center items-center gap-2"
                    >
                        {isLoading ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            'Go'
                        )}
                    </button>
                </form>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-3 bg-white/95 text-gray-400">or</span>
                    </div>
                </div>

                <button
                    onClick={handleCurrentLocation}
                    disabled={isLoading}
                    className="w-full py-3 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                >
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Use current location
                </button>

                {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center animate-fade-in">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
