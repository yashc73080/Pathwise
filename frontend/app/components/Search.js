'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
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
    const [isLocating, setIsLocating] = useState(false);

    const handleCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        setIsLocating(true);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };

                if (map) {
                    map.setCenter(pos);
                    map.setZoom(15);

                    new window.google.maps.Marker({
                        position: pos,
                        map: map,
                        title: "Your Location",
                        icon: {
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: '#4285F4',
                            fillOpacity: 1,
                            strokeColor: 'white',
                            strokeWeight: 2,
                        },
                    });
                }
                setIsLocating(false);
            },
            (error) => {
                setIsLocating(false);
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        toast.error('Location access denied. Please enable location permissions.');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        toast.error('Location unavailable. Try again later.');
                        break;
                    case error.TIMEOUT:
                        toast.error('Location request timed out. Try again.');
                        break;
                    default:
                        // HTTPS is required for geolocation on mobile
                        toast.error('Location access requires HTTPS connection.');
                        break;
                }
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    useEffect(() => {
        if (!mapLoaded || !inputRef.current) return;

        const input = inputRef.current;

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
                placeId: place.place_id
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
            window.google.maps.event.clearInstanceListeners(newSearchBox);
        };
    }, [mapLoaded, map, setCurrentPlace, setCurrentMarker, setSearchBox, currentMarker]);

    useEffect(() => {
        if (currentPlace === null && inputRef.current) {
            inputRef.current.value = '';
        }
    }, [currentPlace]);

    const handleClearPlace = (e) => {
        e.stopPropagation();
        setCurrentPlace(null);
        if (currentMarker) {
            currentMarker.setMap(null);
            setCurrentMarker(null);
        }
    };

    const handleAddToItinerary = (e) => {
        e.stopPropagation();
        addToItinerary();
    };

    const handleOpenGoogleMaps = () => {
        if (!currentPlace) return;
        // Use place_id on desktop (better UX), search query on mobile (app compatibility)
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const url = currentPlace.placeId && !isMobile
            ? `https://www.google.com/maps/place/?q=place_id:${currentPlace.placeId}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentPlace.name + ' ' + (currentPlace.address || ''))}`;

        // On mobile, use direct navigation to avoid blank intermediate page
        if (isMobile) {
            window.location.href = url;
        } else {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-full max-w-xl z-10 px-4">
            <div className="bg-white rounded-xl shadow-lg flex items-center p-1.5 transition-all duration-200 hover:shadow-xl">
                <div className="flex-1 flex items-center">
                    <svg className="w-5 h-5 text-gray-400 ml-2 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        ref={inputRef}
                        id="pac-input"
                        className="flex-1 p-2.5 bg-transparent border-none focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-400"
                        type="text"
                        placeholder="Search or click on the map"
                        aria-label="Search for a location"
                    />
                </div>

                <button
                    onClick={handleCurrentLocation}
                    disabled={isLocating}
                    className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                    title="Use my current location"
                    aria-label="Use my current location"
                >
                    {isLocating ? (
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    )}
                </button>

                <div className="h-6 w-px bg-gray-200 mx-1"></div>

                <button
                    onClick={addToItinerary}
                    disabled={!currentPlace}
                    className={`p-2.5 rounded-lg transition-all duration-200 ${currentPlace
                        ? 'text-blue-600 hover:bg-blue-50'
                        : 'text-gray-300 cursor-not-allowed'
                        }`}
                    title="Add to itinerary"
                    aria-label="Add location to itinerary"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            {/* Place Preview Card - Click anywhere except buttons to open Google Maps */}
            {currentPlace && (
                <div
                    onClick={handleOpenGoogleMaps}
                    className="mt-2 bg-white rounded-lg shadow-md p-3 flex items-start gap-3 animate-fade-in cursor-pointer hover:bg-gray-50 transition-colors"
                >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{currentPlace.name}</p>
                        <p className="text-sm text-gray-500 truncate">{currentPlace.address}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                        <button
                            onClick={handleAddToItinerary}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Add
                        </button>
                        <button
                            onClick={handleClearPlace}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="Clear selection"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
