'use client';

import { createContext, useContext, useState, useRef, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { getBackendUrl } from '../utils/backendUrl';
import { createItineraryMarker, setMarkerNumber, clearMarker } from '../utils/markers';

const TripContext = createContext();

export function TripProvider({ children }) {
    const [mapLoaded, setMapLoaded] = useState(false);
    const [selectedLocations, setSelectedLocations] = useState([]);
    const [currentPlace, setCurrentPlace] = useState(null);
    const [map, setMap] = useState(null);
    const [currentMarker, setCurrentMarker] = useState(null);
    const [optimizedRoute, setOptimizedRoute] = useState(null);
    const [routePolyline, setRoutePolyline] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isLocationSelected, setIsLocationSelected] = useState(true);
    const [startIndex, setStartIndex] = useState(null);
    const [endIndex, setEndIndex] = useState(null);
    // Mobile panel navigation: 'none' | 'itinerary' | 'route' | 'chat'
    const [activePanel, setActivePanel] = useState('none');
    // Chat height for mobile: 'minimized' | 'partial' | 'full'
    const [chatHeight, setChatHeight] = useState('full');
    // Sidebar and Route panel heights for mobile: 'partial' | 'full'
    const [sidebarHeight, setSidebarHeight] = useState('full');
    const [routeHeight, setRouteHeight] = useState('full');
    // Weather state
    const [weatherData, setWeatherData] = useState(null);
    const [isLoadingWeather, setIsLoadingWeather] = useState(false);
    // Chat session ID for trip association
    const [currentChatSessionId, setCurrentChatSessionId] = useState(null);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // Track if we've already restored from localStorage to prevent duplicate restoration
    // Also controls when saves are allowed (only after restore attempt)
    const hasRestoredRef = useRef(false);

    // Save itinerary state to localStorage whenever it changes
    useEffect(() => {
        // Don't save until restore has been attempted (prevents overwriting saved data on initial load)
        if (!hasRestoredRef.current) return;

        const stateToSave = {
            selectedLocations: selectedLocations.map(loc => ({
                name: loc.name,
                lat: loc.lat,
                lng: loc.lng,
                address: loc.address || '',
                placeId: loc.placeId || null
            })),
            optimizedRoute,
            startIndex,
            endIndex,
            weatherData,
            currentChatSessionId
        };

        localStorage.setItem('pathwise_itinerary', JSON.stringify(stateToSave));
    }, [selectedLocations, optimizedRoute, startIndex, endIndex, weatherData, currentChatSessionId]);

    // Restore itinerary state from localStorage when map is ready
    useEffect(() => {
        if (!map || !mapLoaded || hasRestoredRef.current) return;

        // Mark restore as attempted (allows saving to begin)
        hasRestoredRef.current = true;

        const savedState = localStorage.getItem('pathwise_itinerary');
        if (!savedState) return;

        try {
            const parsed = JSON.parse(savedState);

            // Only restore if there are locations saved
            if (!parsed.selectedLocations || parsed.selectedLocations.length === 0) return;

            // Create a map from original index to route position for numbering (if optimized route exists)
            const routePositionMap = {};
            if (parsed.optimizedRoute) {
                parsed.optimizedRoute.forEach((originalIndex, routePosition) => {
                    routePositionMap[originalIndex] = routePosition + 1;
                });
            }

            // Restore locations and create markers
            const restoredLocations = parsed.selectedLocations.map((loc, index) => {
                const marker = createItineraryMarker({
                    map: map,
                    position: { lat: loc.lat, lng: loc.lng },
                    title: loc.name,
                    number: routePositionMap[index] || null
                });
                return { ...loc, marker };
            });

            setSelectedLocations(restoredLocations);

            if (parsed.optimizedRoute) {
                setOptimizedRoute(parsed.optimizedRoute);

                // Re-draw polyline (guard against stale saved state)
                const routeCoordinates = parsed.optimizedRoute
                    .filter(index => restoredLocations[index])
                    .map(index => ({
                        lat: restoredLocations[index].lat,
                        lng: restoredLocations[index].lng
                    }));

                // Only complete the cycle if no end_index is specified
                if (routeCoordinates.length > 0 && (parsed.endIndex === undefined || parsed.endIndex === null)) {
                    routeCoordinates.push(routeCoordinates[0]);
                }

                const newPolyline = new window.google.maps.Polyline({
                    path: routeCoordinates,
                    geodesic: true,
                    strokeColor: '#FF0000',
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                    map: map
                });

                setRoutePolyline(newPolyline);

                // Fit bounds to show the route
                const bounds = new window.google.maps.LatLngBounds();
                routeCoordinates.forEach(coord => bounds.extend(coord));
                map.fitBounds(bounds);
            } else {
                // Just fit bounds to show all locations
                if (restoredLocations.length > 0) {
                    const bounds = new window.google.maps.LatLngBounds();
                    restoredLocations.forEach(loc => bounds.extend({ lat: loc.lat, lng: loc.lng }));
                    map.fitBounds(bounds);
                }
            }

            if (parsed.startIndex !== undefined) setStartIndex(parsed.startIndex);
            if (parsed.endIndex !== undefined) setEndIndex(parsed.endIndex);
            if (parsed.weatherData) setWeatherData(parsed.weatherData);
            if (parsed.currentChatSessionId) setCurrentChatSessionId(parsed.currentChatSessionId);

            toast.success('Previous itinerary restored');
        } catch (error) {
            console.error('Error restoring itinerary from localStorage:', error);
        }
    }, [map, mapLoaded]);

    // Re-attach markers and polyline when the map instance is recreated
    // (Map.js rebuilds the map on theme change since colorScheme is set at construction)
    const prevMapRef = useRef(null);
    useEffect(() => {
        const prevMap = prevMapRef.current;
        prevMapRef.current = map;
        if (!map || !prevMap || prevMap === map) return;

        selectedLocations.forEach(location => {
            if (location.marker) location.marker.map = map;
        });
        if (currentMarker) currentMarker.map = map;
        if (routePolyline) routePolyline.setMap(map);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);


    // Load Google Maps Script
    useEffect(() => {
        if (window.google?.maps) {
            setMapLoaded(true);
            return;
        }

        const existingScript = document.querySelector(`script[src^="https://maps.googleapis.com/maps/api/js"]`);
        if (existingScript) {
            if (!window.google?.maps) {
                existingScript.addEventListener('load', () => setMapLoaded(true));
            } else {
                setMapLoaded(true);
            }
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => setMapLoaded(true);
        document.head.appendChild(script);
    }, [apiKey]);


    const addToItinerary = (placeOrEvent = null, markerToRemove = null) => {
        let place = placeOrEvent;
        // Check if the argument is a synthetic event or missing location data
        if (place && (place.nativeEvent || typeof place.lat === 'undefined')) {
            place = null;
        }

        const locationToAdd = place || currentPlace;

        if (locationToAdd && !selectedLocations.some(loc => loc.name === locationToAdd.name)) {
            const marker = createItineraryMarker({
                map: map,
                position: { lat: locationToAdd.lat, lng: locationToAdd.lng },
                title: locationToAdd.name
            });

            setSelectedLocations(prev => [...prev, { ...locationToAdd, marker }]);
            setCurrentPlace(null);

            // Clear the temporary marker (red one)
            // Use explicitly passed marker or fallback to state
            clearMarker(markerToRemove || currentMarker);
            setCurrentMarker(null);

            toast.success('Added to itinerary!');
        } else if (selectedLocations.some(loc => loc.name === locationToAdd?.name)) {
            toast.error('Location already in itinerary');
        }
    };

    const removeLocation = (index) => {
        const locationToRemove = selectedLocations[index];
        clearMarker(locationToRemove.marker);

        const newLocations = selectedLocations.filter((_, i) => i !== index);
        setSelectedLocations(newLocations);

        // Update start/end indices if they are affected
        if (startIndex !== null) {
            if (startIndex === index) {
                setStartIndex(null);
            } else if (startIndex > index) {
                setStartIndex(startIndex - 1);
            }
        }
        if (endIndex !== null) {
            if (endIndex === index) {
                setEndIndex(null);
            } else if (endIndex > index) {
                setEndIndex(endIndex - 1);
            }
        }

        // Clear the optimized route when locations are modified
        setOptimizedRoute(null);
        if (routePolyline) {
            routePolyline.setMap(null);
            setRoutePolyline(null);
        }
        toast.success('Removed from itinerary');
    };

    const clearAllLocations = () => {
        // Clear all markers from the map
        selectedLocations.forEach(location => {
            clearMarker(location.marker);
        });

        // Clear the optimized route
        if (routePolyline) {
            routePolyline.setMap(null);
            setRoutePolyline(null);
        }

        // Reset states
        setSelectedLocations([]);
        setOptimizedRoute(null);
        setStartIndex(null);
        setEndIndex(null);
        toast.success('All locations cleared');
    };

    const reorderLocations = (sourceIndex, destinationIndex) => {
        const result = Array.from(selectedLocations);
        const [removed] = result.splice(sourceIndex, 1);
        result.splice(destinationIndex, 0, removed);

        // Update start/end indices if they were affected by the reorder
        let newStartIndex = startIndex;
        let newEndIndex = endIndex;

        if (startIndex !== null) {
            if (startIndex === sourceIndex) {
                // Start location was moved
                newStartIndex = destinationIndex;
            } else if (sourceIndex < startIndex && destinationIndex >= startIndex) {
                // Item moved from before start to after start
                newStartIndex = startIndex - 1;
            } else if (sourceIndex > startIndex && destinationIndex <= startIndex) {
                // Item moved from after start to before start
                newStartIndex = startIndex + 1;
            }
        }

        if (endIndex !== null) {
            if (endIndex === sourceIndex) {
                // End location was moved
                newEndIndex = destinationIndex;
            } else if (sourceIndex < endIndex && destinationIndex >= endIndex) {
                // Item moved from before end to after end
                newEndIndex = endIndex - 1;
            } else if (sourceIndex > endIndex && destinationIndex <= endIndex) {
                // Item moved from after end to before end
                newEndIndex = endIndex + 1;
            }
        }

        setSelectedLocations(result);
        if (startIndex !== null) setStartIndex(newStartIndex);
        if (endIndex !== null) setEndIndex(newEndIndex);

        // Clear optimized route when reordering
        setOptimizedRoute(null);
        if (routePolyline) {
            routePolyline.setMap(null);
            setRoutePolyline(null);
        }
    };

    const setStartLocation = (index) => {
        if (index === startIndex) {
            setStartIndex(null);
        } else {
            setStartIndex(index);
        }
        // Clear optimized route when start/end changes
        setOptimizedRoute(null);
        if (routePolyline) {
            routePolyline.setMap(null);
            setRoutePolyline(null);
        }
    };

    const setEndLocation = (index) => {
        if (index === endIndex) {
            setEndIndex(null);
        } else {
            setEndIndex(index);
        }
        // Clear optimized route when start/end changes
        setOptimizedRoute(null);
        if (routePolyline) {
            routePolyline.setMap(null);
            setRoutePolyline(null);
        }
    };

    const submitItinerary = async () => {
        if (selectedLocations.length === 0) {
            toast.error("No locations to submit.");
            return;
        }

        setIsSubmitting(true);

        const itineraryData = selectedLocations.map(location => ({
            name: location.name,
            lat: location.lat,
            lng: location.lng
        }));

        try {
            const requestBody = { locations: itineraryData };
            if (startIndex !== null) {
                requestBody.start_index = startIndex;
            }
            if (endIndex !== null) {
                requestBody.end_index = endIndex;
            }

            const response = await fetch(`${getBackendUrl()}/submit-itinerary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (response.ok) {
                const data = await response.json();
                setOptimizedRoute(data.optimized_route);

                if (routePolyline) {
                    routePolyline.setMap(null);
                }

                const routeCoordinates = data.optimized_route
                    .filter(index => selectedLocations[index])
                    .map(index => ({
                        lat: selectedLocations[index].lat,
                        lng: selectedLocations[index].lng
                    }));

                // Only complete the cycle if no end_index is specified (path vs cycle)
                if (routeCoordinates.length > 0 && endIndex === null) {
                    routeCoordinates.push(routeCoordinates[0]);
                }

                const newPolyline = new window.google.maps.Polyline({
                    path: routeCoordinates,
                    geodesic: true,
                    strokeColor: '#FF0000',
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                    map: map
                });

                setRoutePolyline(newPolyline);

                // Update markers with numbered labels based on optimized route order
                data.optimized_route.forEach((originalIndex, routePosition) => {
                    const location = selectedLocations[originalIndex];
                    if (location.marker) {
                        setMarkerNumber(location.marker, routePosition + 1);
                    }
                });

                const bounds = new window.google.maps.LatLngBounds();
                routeCoordinates.forEach(coord => bounds.extend(coord));
                map.fitBounds(bounds);

                // Auto-switch to route panel on mobile
                setActivePanel('route');

                toast.success("Route optimized!");

                // Fetch weather asynchronously (non-blocking)
                fetchWeather(data.optimized_route.map(i => selectedLocations[i]).filter(Boolean));
            } else {
                toast.error('Failed to submit itinerary.');
            }
        } catch (error) {
            console.error('Error submitting itinerary:', error);
            toast.error('Error submitting itinerary.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const optimizedCoords = useMemo(() => {
        if (!optimizedRoute || !selectedLocations.length) return [];

        // Route indices can briefly point past the array when locations change
        // between an optimize request and its response — skip stale entries
        return optimizedRoute
            .filter(index => selectedLocations[index])
            .map(index => ({
                name: selectedLocations[index].name,
                address: selectedLocations[index].address || '',
                lat: selectedLocations[index].lat,
                lng: selectedLocations[index].lng
            }));
    }, [optimizedRoute, selectedLocations]);

    const exportToGoogleMaps = () => {
        if (!optimizedCoords || optimizedCoords.length === 0) {
            toast.error("No optimized route to export");
            return;
        }

        const baseUrl = "https://www.google.com/maps/dir/";
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Always use name + address for meaningful location names in Google Maps
        // (coordinates result in "Dropped pin" which isn't useful to users)
        const waypoints = optimizedCoords
            .map(loc => {
                if (loc.address) {
                    return encodeURIComponent(`${loc.name}, ${loc.address}`);
                }
                return encodeURIComponent(loc.name);
            })
            .join('/');

        const googleMapsUrl = `${baseUrl}${waypoints}`;

        // On mobile, use direct navigation to avoid blank intermediate page
        if (isMobile) {
            window.location.href = googleMapsUrl;
        } else {
            window.open(googleMapsUrl, '_blank');
        }
        toast.success("Opening in Google Maps!");
    };

    // Reorder the optimized route (for manual adjustments after optimization)
    const reorderOptimizedRoute = (sourceIndex, destinationIndex) => {
        if (!optimizedRoute || !optimizedCoords) return;

        // Create new ordered array based on current optimizedCoords
        const newOptimizedCoords = Array.from(optimizedCoords);
        const [moved] = newOptimizedCoords.splice(sourceIndex, 1);
        newOptimizedCoords.splice(destinationIndex, 0, moved);

        // Find the original indices that correspond to the new order,
        // dropping any entries that no longer exist in selectedLocations
        const newOptimizedRoute = newOptimizedCoords.map(coord => {
            return selectedLocations.findIndex(loc =>
                loc.lat === coord.lat && loc.lng === coord.lng && loc.name === coord.name
            );
        }).filter(index => index !== -1);

        setOptimizedRoute(newOptimizedRoute);

        // Update marker labels to reflect new order
        newOptimizedRoute.forEach((originalIndex, routePosition) => {
            const location = selectedLocations[originalIndex];
            if (location?.marker) {
                setMarkerNumber(location.marker, routePosition + 1);
            }
        });

        // Redraw polyline with new order
        if (routePolyline) {
            routePolyline.setMap(null);
        }

        const routeCoordinates = newOptimizedRoute
            .filter(index => selectedLocations[index])
            .map(index => ({
                lat: selectedLocations[index].lat,
                lng: selectedLocations[index].lng
            }));

        // Only complete the cycle if no end_index is specified
        if (routeCoordinates.length > 0 && endIndex === null) {
            routeCoordinates.push(routeCoordinates[0]);
        }

        const newPolyline = new window.google.maps.Polyline({
            path: routeCoordinates,
            geodesic: true,
            strokeColor: '#FF0000',
            strokeOpacity: 1.0,
            strokeWeight: 2,
            map: map
        });

        setRoutePolyline(newPolyline);
    };

    const loadTrip = (trip) => {
        // Clear current state first
        clearAllLocations();

        // Create a map from original index to route position for numbering
        const routePositionMap = {};
        trip.optimizedRoute.forEach((originalIndex, routePosition) => {
            routePositionMap[originalIndex] = routePosition + 1;
        });

        // Restore locations and create markers with numbered labels
        const newLocations = trip.locations.map((loc, index) => {
            const marker = createItineraryMarker({
                map: map,
                position: { lat: loc.lat, lng: loc.lng },
                title: loc.name,
                number: routePositionMap[index] || null
            });
            return { ...loc, marker };
        });

        setSelectedLocations(newLocations);
        setOptimizedRoute(trip.optimizedRoute);
        if (trip.startIndex !== undefined) setStartIndex(trip.startIndex);
        if (trip.endIndex !== undefined) setEndIndex(trip.endIndex);

        // Re-draw polyline (guard against corrupt docs whose route outruns locations)
        const routeCoordinates = trip.optimizedRoute
            .filter(index => newLocations[index])
            .map(index => ({
                lat: newLocations[index].lat,
                lng: newLocations[index].lng
            }));

        if (routeCoordinates.length > 0 && (trip.endIndex === undefined || trip.endIndex === null)) {
            routeCoordinates.push(routeCoordinates[0]);
        }

        const newPolyline = new window.google.maps.Polyline({
            path: routeCoordinates,
            geodesic: true,
            strokeColor: '#FF0000',
            strokeOpacity: 1.0,
            strokeWeight: 2,
            map: map
        });

        setRoutePolyline(newPolyline);

        // Fit bounds
        const bounds = new window.google.maps.LatLngBounds();
        routeCoordinates.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds);

        // Clear old weather and fetch new weather for loaded trip
        setWeatherData(null);
        fetchWeather(newLocations);

        // Set chat session ID if saved with trip (will trigger ChatInterface to load it)
        if (trip.chatSessionId) {
            setCurrentChatSessionId(trip.chatSessionId);
        } else {
            setCurrentChatSessionId(null);
        }

        toast.success(`Trip loaded!`);
    };

    // Fetch weather for optimized route locations (async, non-blocking)
    const fetchWeather = async (locations) => {
        if (!locations || locations.length === 0) return;

        setIsLoadingWeather(true);
        setWeatherData(null);

        try {
            const response = await fetch(`${getBackendUrl()}/weather`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    locations: locations.map(loc => ({
                        name: loc.name,
                        lat: loc.lat,
                        lng: loc.lng
                    }))
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setWeatherData(data);
                toast.success('Weather forecast loaded!');
            } else {
                console.error('Weather fetch failed:', response.status);
                toast.error('Failed to load weather');
            }
        } catch (error) {
            console.error('Error fetching weather:', error);
            toast.error('Error loading weather');
        } finally {
            setIsLoadingWeather(false);
        }
    };

    const value = {
        mapLoaded,
        selectedLocations,
        currentPlace,
        setCurrentPlace,
        map,
        setMap,
        currentMarker,
        setCurrentMarker,
        optimizedRoute,
        routePolyline,
        isSubmitting,
        isChatOpen,
        setIsChatOpen,
        isSidebarOpen,
        setIsSidebarOpen,
        isLocationSelected,
        setIsLocationSelected,
        startIndex,
        endIndex,
        addToItinerary,
        removeLocation,
        clearAllLocations,
        submitItinerary,
        reorderLocations,
        setStartLocation,
        setEndLocation,
        optimizedCoords,
        exportToGoogleMaps,
        reorderOptimizedRoute,
        loadTrip,
        activePanel,
        setActivePanel,
        chatHeight,
        setChatHeight,
        sidebarHeight,
        setSidebarHeight,
        routeHeight,
        setRouteHeight,
        weatherData,
        isLoadingWeather,
        fetchWeather,
        setWeatherData,
        currentChatSessionId,
        setCurrentChatSessionId
    };

    return (
        <TripContext.Provider value={value}>
            {children}
        </TripContext.Provider>
    );
}

export function useTrip() {
    return useContext(TripContext);
}
