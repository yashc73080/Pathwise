'use client';

import { createContext, useContext, useState, useRef, useEffect } from 'react';
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

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // Load Google Maps Script
    useEffect(() => {
        if (window.google?.maps) {
            setMapLoaded(true);
            return;
        }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => setMapLoaded(true);
        document.head.appendChild(script);
    }, [apiKey]);


    const addToItinerary = (place = null) => {
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

            // We don't clear the input directly here anymore, the component should handle it or observe state
            if (currentMarker) {
                currentMarker.setMap(null);
                setCurrentMarker(null);
            }
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
        toast.success('All locations cleared');
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
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/submit-itinerary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ locations: itineraryData }),
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

                routeCoordinates.push(routeCoordinates[0]);

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
        addToItinerary,
        removeLocation,
        clearAllLocations,
        submitItinerary
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
