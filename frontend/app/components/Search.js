'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTrip } from '../context/TripContext';
import { createPreviewMarker, createLocationDot, clearMarker } from '../utils/markers';

export default function Search() {
    const {
        mapLoaded,
        map,
        setCurrentPlace,
        setCurrentMarker,
        currentMarker,
        addToItinerary,
        currentPlace
    } = useTrip();

    const inputRef = useRef(null);
    const [isLocating, setIsLocating] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const placesLibRef = useRef(null);
    const sessionTokenRef = useRef(null);
    const debounceRef = useRef(null);
    const requestIdRef = useRef(0);

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

                    createLocationDot({
                        map: map,
                        position: pos,
                        title: "Your Location",
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
        if (!mapLoaded) return;
        let cancelled = false;
        window.google.maps.importLibrary('places').then((placesLib) => {
            if (!cancelled) placesLibRef.current = placesLib;
        });
        return () => {
            cancelled = true;
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [mapLoaded]);

    const fetchSuggestions = async (input) => {
        const placesLib = placesLibRef.current;
        if (!placesLib) return;

        if (!sessionTokenRef.current) {
            sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }

        const request = {
            input,
            sessionToken: sessionTokenRef.current,
        };
        const bounds = map?.getBounds();
        if (bounds) {
            request.locationBias = bounds;
        }

        const requestId = ++requestIdRef.current;
        try {
            const { suggestions: results } =
                await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
            if (requestId !== requestIdRef.current) return; // stale response
            setSuggestions(results.filter((s) => s.placePrediction));
            setActiveIndex(-1);
        } catch (error) {
            console.error('Autocomplete request failed:', error);
            if (requestId === requestIdRef.current) setSuggestions([]);
        }
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!value.trim()) {
            requestIdRef.current++;
            setSuggestions([]);
            setActiveIndex(-1);
            return;
        }
        debounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
    };

    const handleSelectSuggestion = async (suggestion) => {
        setSuggestions([]);
        setActiveIndex(-1);
        // A details fetch ends the autocomplete billing session
        sessionTokenRef.current = null;

        try {
            const place = suggestion.placePrediction.toPlace();
            await place.fetchFields({
                fields: ['displayName', 'formattedAddress', 'location', 'viewport', 'id'],
            });

            if (!place.location) {
                console.log('Returned place contains no location');
                return;
            }

            const placeData = {
                name: place.displayName,
                address: place.formattedAddress,
                lat: place.location.lat(),
                lng: place.location.lng(),
                placeId: place.id
            };

            if (inputRef.current) {
                inputRef.current.value = placeData.name;
            }

            setCurrentPlace(placeData);

            clearMarker(currentMarker);

            if (map) {
                const newMarker = createPreviewMarker({
                    map: map,
                    position: place.location,
                    title: placeData.name,
                });

                setCurrentMarker(newMarker);

                if (place.viewport) {
                    map.fitBounds(place.viewport);
                } else {
                    map.setCenter(place.location);
                    map.setZoom(17);
                }
            }
        } catch (error) {
            console.error('Failed to fetch place details:', error);
            toast.error('Could not load place details');
        }
    };

    const handleKeyDown = (e) => {
        if (suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSelectSuggestion(suggestions[activeIndex >= 0 ? activeIndex : 0]);
        } else if (e.key === 'Escape') {
            setSuggestions([]);
            setActiveIndex(-1);
        }
    };

    const handleInputBlur = () => {
        // Delay so a click on a suggestion registers before the dropdown closes
        setTimeout(() => {
            setSuggestions([]);
            setActiveIndex(-1);
        }, 150);
    };

    useEffect(() => {
        if (currentPlace === null && inputRef.current) {
            inputRef.current.value = '';
        }
    }, [currentPlace]);

    const handleClearPlace = (e) => {
        e.stopPropagation();
        setCurrentPlace(null);
        if (currentMarker) {
            clearMarker(currentMarker);
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg flex items-center p-1.5 transition-all duration-200 hover:shadow-xl">
                <div className="flex-1 flex items-center">
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 ml-2 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        ref={inputRef}
                        id="pac-input"
                        className="flex-1 p-2.5 bg-transparent border-none focus:ring-0 focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        type="text"
                        placeholder="Search or click on the map"
                        aria-label="Search for a location"
                        autoComplete="off"
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onBlur={handleInputBlur}
                        role="combobox"
                        aria-controls="search-suggestions"
                        aria-expanded={suggestions.length > 0}
                        aria-autocomplete="list"
                    />
                </div>

                <button
                    onClick={handleCurrentLocation}
                    disabled={isLocating}
                    className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-200"
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

                <div className="h-6 w-px bg-gray-200 dark:bg-gray-600 mx-1"></div>

                <button
                    onClick={addToItinerary}
                    disabled={!currentPlace}
                    className={`p-2.5 rounded-lg transition-all duration-200 ${currentPlace
                        ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                        : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        }`}
                    title="Add to itinerary"
                    aria-label="Add location to itinerary"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            {/* Autocomplete suggestions dropdown */}
            {suggestions.length > 0 && (
                <ul
                    id="search-suggestions"
                    role="listbox"
                    className="mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-700"
                >
                    {suggestions.map((suggestion, index) => {
                        const prediction = suggestion.placePrediction;
                        const mainText = prediction.mainText?.text ?? prediction.text.text;
                        const secondaryText = prediction.secondaryText?.text;
                        return (
                            <li
                                key={prediction.placeId}
                                role="option"
                                aria-selected={index === activeIndex}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectSuggestion(suggestion);
                                }}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={`px-4 py-2.5 cursor-pointer transition-colors ${index === activeIndex
                                    ? 'bg-blue-50 dark:bg-blue-900/30'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                            >
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{mainText}</p>
                                {secondaryText && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{secondaryText}</p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Place Preview Card - Click anywhere except buttons to open Google Maps */}
            {currentPlace && (
                <div
                    onClick={handleOpenGoogleMaps}
                    className="mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 flex items-start gap-3 animate-fade-in cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{currentPlace.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{currentPlace.address}</p>
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
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
