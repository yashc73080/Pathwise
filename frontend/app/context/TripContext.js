'use client';

import { createContext, useContext, useState, useRef, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';

const TripContext = createContext();

export function TripProvider({ children }) {
    const [mapLoaded, setMapLoaded] = useState(false);
    const [selectedLocations, setSelectedLocations] = useState([]);
    const [currentPlace, setCurrentPlace] = useState(null);
    const [map, setMap] = useState(null);
    const [searchBox, setSearchBox] = useState(null);
    const [currentMarker, setCurrentMarker] = useState(null);
    const [optimizedRoute, setOptimizedRoute] = useState(null);
    const [routePolyline, setRoutePolyline] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isLocationSelected, setIsLocationSelected] = useState(true);
    const [startIndex, setStartIndex] = useState(null);
    const [endIndex, setEndIndex] = useState(null);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
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
            const marker = new window.google.maps.Marker({
                map: map,
                position: { lat: locationToAdd.lat, lng: locationToAdd.lng },
                title: locationToAdd.name,
                icon: {
                    url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                }
            });

            setSelectedLocations(prev => [...prev, { ...locationToAdd, marker }]);
            setCurrentPlace(null);

            // Clear the temporary marker (red one)
            // Use explicitly passed marker or fallback to state
            const markerToClear = markerToRemove || currentMarker;
            if (markerToClear) {
                markerToClear.setMap(null);
            }
            setCurrentMarker(null);

            toast.success('Added to itinerary!');
        } else if (selectedLocations.some(loc => loc.name === locationToAdd?.name)) {
            toast.error('Location already in itinerary');
        }
    };

    const removeLocation = (index) => {
        const locationToRemove = selectedLocations[index];
        if (locationToRemove.marker) {
            locationToRemove.marker.setMap(null);
        }

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
            if (location.marker) {
                location.marker.setMap(null);
            }
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

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/submit-itinerary`, {
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

                const routeCoordinates = data.optimized_route.map(index => ({
                    lat: selectedLocations[index].lat,
                    lng: selectedLocations[index].lng
                }));

                // Only complete the cycle if no end_index is specified (path vs cycle)
                if (endIndex === null) {
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

                const bounds = new window.google.maps.LatLngBounds();
                routeCoordinates.forEach(coord => bounds.extend(coord));
                map.fitBounds(bounds);

                toast.success("Route optimized!");
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

        return optimizedRoute.map(index => ({
            name: selectedLocations[index].name,
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

        const waypoints = optimizedCoords
            .map(loc => `${loc.lat},${loc.lng}`)
            .join('/');

        const googleMapsUrl = `${baseUrl}${waypoints}`;

        window.open(googleMapsUrl, '_blank');
        toast.success("Opening in Google Maps!");
    };

    const loadTrip = (trip) => {
        // Clear current state first
        clearAllLocations();

        // Restore locations and create markers
        const newLocations = trip.locations.map(loc => {
            const marker = new window.google.maps.Marker({
                map: map,
                position: { lat: loc.lat, lng: loc.lng },
                title: loc.name,
                icon: {
                    url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                }
            });
            return { ...loc, marker };
        });

        setSelectedLocations(newLocations);
        setOptimizedRoute(trip.optimizedRoute);
        if (trip.startIndex !== undefined) setStartIndex(trip.startIndex);
        if (trip.endIndex !== undefined) setEndIndex(trip.endIndex);

        // Re-draw polyline
        const routeCoordinates = trip.optimizedRoute.map(index => ({
            lat: newLocations[index].lat,
            lng: newLocations[index].lng
        }));

        if (trip.endIndex === undefined || trip.endIndex === null) {
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

        toast.success(`Trip loaded!`);
    };

    const value = {
        mapLoaded,
        selectedLocations,
        currentPlace,
        setCurrentPlace,
        map,
        setMap,
        searchBox,
        setSearchBox,
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
        loadTrip
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
