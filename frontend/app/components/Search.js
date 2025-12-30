'use client';

import { useEffect, useRef } from 'react';
import { useTrip } from '../context/TripContext';

export default function Search() {
    const {
        mapLoaded,
        map,
        setSearchBox,
        setCurrentPlace,
        setCurrentMarker,
        currentMarker,
        addToItinerary,
        currentPlace
    } = useTrip();

    const inputRef = useRef(null);

    useEffect(() => {
        if (!mapLoaded || !inputRef.current) return;

        const input = inputRef.current;

        // Check if SearchBox already exists is handled by logic? 
        // Usually safe to re-create if input changes, but here input is ref.
        const newSearchBox = new window.google.maps.places.SearchBox(input);
        setSearchBox(newSearchBox);

        const listener = newSearchBox.addListener('places_changed', () => {
            const places = newSearchBox.getPlaces();
            if (places.length === 0) return;

            const place = places[0];
            if (!place.geometry || !place.geometry.location) {
                console.log('Returned place contains no geometry');
                return;
            }

            const placeData = {
                name: place.name,
                address: place.formatted_address,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
            };

            setCurrentPlace(placeData);

            if (currentMarker) {
                currentMarker.setMap(null);
            }

            if (map) {
                const newMarker = new window.google.maps.Marker({
                    map: map,
                    position: place.geometry.location,
                    title: place.name,
                    animation: window.google.maps.Animation.DROP,
                });

                setCurrentMarker(newMarker);

                if (place.geometry.viewport) {
                    map.fitBounds(place.geometry.viewport);
                } else {
                    map.setCenter(place.geometry.location);
                    map.setZoom(17);
                }
            }
        });

        return () => {
            // Cleanup listeners if necessary, though google maps listeners are tricky with react lifecycles
            window.google.maps.event.clearInstanceListeners(newSearchBox);
        };
    }, [mapLoaded, map, setCurrentPlace, setCurrentMarker, setSearchBox, currentMarker]); // Added dependencies

    // Clear input when added? logic was in addToItinerary but it manipulated DOM directly.
    // We can leave it or manage input value state.
    // The original code: document.getElementById('pac-input').value = ''; inside addToItinerary.
    // I should probably expose a ref or way to clear it.

    // Actually, let's use a controlled input or ref to clear it.
    // Context's addToItinerary doesn't have access to this input ref.
    // Maybe I should watch `currentPlace`? If it becomes null, clear input?
    // In `TripContext`, `addToItinerary` sets `currentPlace(null)`.

    useEffect(() => {
        if (currentPlace === null && inputRef.current) {
            inputRef.current.value = '';
        }
    }, [currentPlace]);

    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-full max-w-xl z-10 px-4">
            <div className="bg-white rounded-lg shadow-lg flex items-center p-1">
                <input
                    ref={inputRef}
                    id="pac-input" // Keeping ID for compatibility if needed, but ref is better
                    className="flex-1 p-3 bg-transparent border-none focus:ring-0 text-gray-900"
                    type="text"
                    placeholder="Search for a location"
                />
                <button
                    onClick={addToItinerary}
                    disabled={!currentPlace}
                    className={`p-3 rounded-lg transition-colors ${currentPlace
                            ? 'text-blue-600 hover:bg-gray-100'
                            : 'text-gray-400'
                        }`}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
